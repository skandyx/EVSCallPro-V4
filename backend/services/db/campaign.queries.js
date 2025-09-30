// backend/services/db/campaign.queries.js

const pool = require('./connection');
const { keysToCamel } = require('./utils');

const getCampaigns = async () => {
    // This query now correctly fetches assigned user IDs along with contacts.
    const query = `
        SELECT 
            c.*, 
            COALESCE(json_agg(ct.*) FILTER (WHERE ct.id IS NOT NULL), '[]') as contacts,
            COALESCE(ARRAY_AGG(ca.user_id) FILTER (WHERE ca.user_id IS NOT NULL), '{}') as assigned_user_ids
        FROM campaigns c
        LEFT JOIN contacts ct ON c.id = ct.campaign_id
        LEFT JOIN campaign_agents ca ON c.id = ca.campaign_id
        GROUP BY c.id
        ORDER BY c.name;
    `;
    const res = await pool.query(query);
    return res.rows.map(row => {
        const campaign = keysToCamel(row);
        // Ensure contacts are also camelCased if the helper doesn't handle nested objects in arrays
        campaign.contacts = campaign.contacts.map(keysToCamel);
        return campaign;
    });
};

const saveCampaign = async (campaign, id) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const { assignedUserIds, ...campaignData } = campaign;
        let savedCampaign;

        if (id) {
            const res = await client.query(
                'UPDATE campaigns SET name=$1, description=$2, script_id=$3, qualification_group_id=$4, caller_id=$5, is_active=$6, dialing_mode=$7, priority=$8, wrap_up_time=$9, quota_rules=$10, filter_rules=$11, updated_at=NOW() WHERE id=$12 RETURNING *',
                [campaignData.name, campaignData.description, campaignData.scriptId, campaignData.qualificationGroupId, campaignData.callerId, campaignData.isActive, campaignData.dialingMode, campaignData.priority, campaignData.wrapUpTime, JSON.stringify(campaignData.quotaRules), JSON.stringify(campaignData.filterRules), id]
            );
            savedCampaign = res.rows[0];
        } else {
            const res = await client.query(
                'INSERT INTO campaigns (id, name, description, script_id, qualification_group_id, caller_id, is_active, dialing_mode, priority, wrap_up_time, quota_rules, filter_rules) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *',
                [campaignData.id, campaignData.name, campaignData.description, campaignData.scriptId, campaignData.qualificationGroupId, campaignData.callerId, campaignData.isActive, campaignData.dialingMode, campaignData.priority, campaignData.wrapUpTime, JSON.stringify(campaignData.quotaRules), JSON.stringify(campaignData.filterRules)]
            );
            savedCampaign = res.rows[0];
        }
        
        const campaignId = savedCampaign.id;

        // Sync assigned agents
        await client.query('DELETE FROM campaign_agents WHERE campaign_id = $1', [campaignId]);
        if (assignedUserIds && assignedUserIds.length > 0) {
            for (const userId of assignedUserIds) {
                await client.query('INSERT INTO campaign_agents (campaign_id, user_id) VALUES ($1, $2)', [campaignId, userId]);
            }
        }
        
        await client.query('COMMIT');

        const finalCampaign = keysToCamel(savedCampaign);
        finalCampaign.assignedUserIds = assignedUserIds || [];
        finalCampaign.contacts = []; // On creation/update, we don't return all contacts
        return finalCampaign;

    } catch (e) {
        await client.query('ROLLBACK');
        console.error("Error in saveCampaign transaction:", e);
        throw e;
    } finally {
        client.release();
    }
};

const deleteCampaign = async (id) => {
    // Note: ON DELETE CASCADE will handle contacts, campaign_agents, etc.
    await pool.query('DELETE FROM campaigns WHERE id = $1', [id]);
};

const importContacts = async (campaignId, contacts, deduplicationConfig) => {
    const client = await pool.connect();
    const valids = [];
    const invalids = [];

    try {
        await client.query('BEGIN');
        
        const standardFieldMap = { phoneNumber: 'phone_number', firstName: 'first_name', lastName: 'last_name', postalCode: 'postal_code' };
        const dedupDbFields = deduplicationConfig.fieldIds.map(fid => standardFieldMap[fid] || fid);

        // Fetch existing contacts for deduplication checks if enabled
        let existingContacts = new Set();
        if (deduplicationConfig.enabled) {
            const existingQuery = `SELECT ${dedupDbFields.join(', ')} FROM contacts WHERE campaign_id = $1`;
            const { rows } = await client.query(existingQuery, [campaignId]);
            rows.forEach(row => {
                const key = dedupDbFields.map(field => row[field] || '').join('||');
                existingContacts.add(key);
            });
        }
        
        for (const contact of contacts) {
            // Basic validation
            if (!contact.phoneNumber || !/^\d+$/.test(contact.phoneNumber)) {
                invalids.push({ row: contact.originalRow, reason: "Numéro de téléphone invalide." });
                continue;
            }

            // Deduplication check
            if (deduplicationConfig.enabled) {
                const key = deduplicationConfig.fieldIds.map(fieldId => contact[fieldId] || '').join('||');
                if (existingContacts.has(key)) {
                    invalids.push({ row: contact.originalRow, reason: "Doublon détecté." });
                    continue;
                }
                existingContacts.add(key);
            }

            const { id, firstName, lastName, phoneNumber, postalCode, status, customFields } = contact;
            await client.query(
                'INSERT INTO contacts (id, campaign_id, first_name, last_name, phone_number, postal_code, status, custom_fields) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
                [id, campaignId, firstName, lastName, phoneNumber, postalCode, status, customFields || {}]
            );
            valids.push(contact);
        }
        
        await client.query('COMMIT');
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
    
    return { valids, invalids };
};

const getNextContactForCampaign = async (agentId, campaignId) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // Find one pending contact from the specified campaign and lock it
        const res = await client.query(
            `SELECT * FROM contacts WHERE campaign_id = $1 AND status = 'pending' LIMIT 1 FOR UPDATE SKIP LOCKED`,
            [campaignId]
        );

        if (res.rows.length === 0) {
            await client.query('COMMIT');
            return { contact: null, campaign: null };
        }

        const contact = res.rows[0];
        
        // Update its status to 'called' to prevent other agents from picking it
        await client.query(`UPDATE contacts SET status = 'called' WHERE id = $1`, [contact.id]);
        
        const campaignRes = await client.query('SELECT * FROM campaigns WHERE id = $1', [campaignId]);
        
        await client.query('COMMIT');

        return { contact: keysToCamel(contact), campaign: keysToCamel(campaignRes.rows[0]) };
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Error in getNextContactForCampaign:", error);
        throw error;
    } finally {
        client.release();
    }
};

const qualifyContact = async (contactId, qualificationId, campaignId, agentId) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // Update contact status
        await client.query("UPDATE contacts SET status = 'qualified', updated_at = NOW() WHERE id = $1", [contactId]);
        
        // Create a call history record (this is a simplified version)
        // A real system would get more details from AMI events
        const contactRes = await client.query("SELECT phone_number FROM contacts WHERE id = $1", [contactId]);
        const agentRes = await client.query("SELECT login_id FROM users WHERE id = $1", [agentId]);
        
        if (contactRes.rows.length === 0 || agentRes.rows.length === 0) {
            throw new Error("Contact or Agent not found for call history creation.");
        }
        
        const now = new Date();
        const callHistoryQuery = `
            INSERT INTO call_history 
            (id, start_time, end_time, duration, billable_duration, direction, call_status, source, destination, agent_id, contact_id, campaign_id, qualification_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        `;
        await client.query(callHistoryQuery, [
            `call-${Date.now()}`, now, now, 0, 0, 'outbound', 'ANSWERED',
            agentRes.rows[0].login_id, contactRes.rows[0].phone_number,
            agentId, contactId, campaignId, qualificationId
        ]);

        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Error qualifying contact:", error);
        throw error;
    } finally {
        client.release();
    }
};

const getCallHistoryForContact = async (contactId) => {
    const query = `
        SELECT *
        FROM call_history
        WHERE contact_id = $1
        ORDER BY start_time DESC;
    `;
    const res = await pool.query(query, [contactId]);
    return res.rows.map(keysToCamel);
};

const updateContact = async (contactId, contactData) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const standardFieldMap = { firstName: 'first_name', lastName: 'last_name', phoneNumber: 'phone_number', postalCode: 'postal_code' };
        const standardFieldsToUpdate = {};
        
        Object.keys(standardFieldMap).forEach(key => {
            if (contactData[key] !== undefined) {
                standardFieldsToUpdate[standardFieldMap[key]] = contactData[key];
            }
        });

        // Clean the customFields object to prevent saving standard fields inside the JSONB column
        const cleanCustomFields = { ...contactData.customFields };
        Object.values(standardFieldMap).forEach(dbKey => delete cleanCustomFields[dbKey]);
        Object.keys(standardFieldMap).forEach(jsKey => delete cleanCustomFields[jsKey]);

        const setClauses = [];
        const values = [contactId];
        
        Object.entries(standardFieldsToUpdate).forEach(([key, value]) => {
            setClauses.push(`${key} = $${values.length + 1}`);
            values.push(value);
        });
        
        setClauses.push(`custom_fields = custom_fields || $${values.length + 1}`);
        values.push(cleanCustomFields);

        const query = `
            UPDATE contacts SET
                ${setClauses.join(', ')},
                updated_at = NOW()
            WHERE id = $1
            RETURNING *;
        `;

        const { rows } = await client.query(query, values);

        await client.query('COMMIT');
        return keysToCamel(rows[0]);

    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Error updating contact:', e);
        throw e;
    } finally {
        client.release();
    }
};


module.exports = {
    getCampaigns,
    saveCampaign,
    deleteCampaign,
    importContacts,
    getNextContactForCampaign,
    qualifyContact,
    getCallHistoryForContact,
    updateContact,
};