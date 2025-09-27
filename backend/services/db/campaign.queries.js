const pool = require('./connection');
const { keysToCamel } = require('./utils');

const getCampaigns = async () => {
    const res = await pool.query('SELECT * FROM campaigns ORDER BY name');
    // Fetch contacts for each campaign separately. In a high-performance scenario,
    // this could be optimized with a single JOIN query and data aggregation in JS.
    for (const campaign of res.rows) {
        const contactsRes = await pool.query('SELECT * FROM contacts WHERE campaign_id = $1', [campaign.id]);
        campaign.contacts = contactsRes.rows.map(keysToCamel);
    }
    return res.rows.map(keysToCamel);
};

const saveCampaign = async (campaign, id) => {
    const { name, description, scriptId, qualificationGroupId, callerId, isActive, dialingMode, wrapUpTime, quotaRules, filterRules } = campaign;
    if (id) {
        const res = await pool.query(
            'UPDATE campaigns SET name=$1, description=$2, script_id=$3, qualification_group_id=$4, caller_id=$5, is_active=$6, dialing_mode=$7, wrap_up_time=$8, quota_rules=$9, filter_rules=$10, updated_at=NOW() WHERE id=$11 RETURNING *',
            [name, description, scriptId, qualificationGroupId, callerId, isActive, dialingMode, wrapUpTime, JSON.stringify(quotaRules), JSON.stringify(filterRules), id]
        );
        return keysToCamel(res.rows[0]);
    }
    const res = await pool.query(
        'INSERT INTO campaigns (id, name, description, script_id, qualification_group_id, caller_id, is_active, dialing_mode, wrap_up_time, quota_rules, filter_rules) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *',
        [campaign.id, name, description, scriptId, qualificationGroupId, callerId, isActive, dialingMode, wrapUpTime, JSON.stringify(quotaRules), JSON.stringify(filterRules)]
    );
    return keysToCamel(res.rows[0]);
};

const deleteCampaign = async (id) => {
    await pool.query('DELETE FROM campaigns WHERE id = $1', [id]);
};

const importContacts = async (campaignId, contactsToValidate, deduplicationConfig) => {
    const client = await pool.connect();
    const valids = [];
    const invalids = [];

    try {
        await client.query('BEGIN');

        const createCompositeKey = (contact, fields) => {
            return fields.map(fieldId => {
                let value = '';
                if (contact.customFields && Object.prototype.hasOwnProperty.call(contact.customFields, fieldId)) {
                    value = String(contact.customFields[fieldId]);
                } else if (Object.prototype.hasOwnProperty.call(contact, fieldId)) {
                    value = String(contact[fieldId]);
                }
                return value.trim().toLowerCase();
            }).join('||');
        };

        const existingValues = new Set();
        if (deduplicationConfig.enabled && deduplicationConfig.fieldIds.length > 0) {
            const { rows: existingContacts } = await client.query('SELECT * FROM contacts WHERE campaign_id = $1', [campaignId]);
            const camelCasedExisting = existingContacts.map(keysToCamel);
            
            camelCasedExisting.forEach(c => {
                const key = createCompositeKey(c, deduplicationConfig.fieldIds);
                if (key) existingValues.add(key);
            });
        }
        
        for (const contact of contactsToValidate) {
            if (!contact.phoneNumber) {
                invalids.push({ row: contact.originalRow, reason: "Le numéro de téléphone est manquant." });
                continue;
            }

            let isDuplicate = false;
            if (deduplicationConfig.enabled && deduplicationConfig.fieldIds.length > 0) {
                const key = createCompositeKey(contact, deduplicationConfig.fieldIds);
                if (key && existingValues.has(key)) {
                    isDuplicate = true;
                    invalids.push({ row: contact.originalRow, reason: "Doublon détecté dans la base existante." });
                }
            }

            if (!isDuplicate) {
                await client.query(
                    'INSERT INTO contacts (id, campaign_id, first_name, last_name, phone_number, postal_code, status, custom_fields) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
                    [contact.id, campaignId, contact.firstName, contact.lastName, contact.phoneNumber, contact.postalCode, 'pending', JSON.stringify(contact.customFields || {})]
                );
                valids.push(contact);

                if (deduplicationConfig.enabled && deduplicationConfig.fieldIds.length > 0) {
                    const key = createCompositeKey(contact, deduplicationConfig.fieldIds);
                    if (key) existingValues.add(key);
                }
            }
        }

        await client.query('COMMIT');
        return { valids, invalids };

    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
};

const getNextContactForCampaign = async (agentId) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Find campaigns assigned to the agent that are active
        const assignedCampaignsRes = await client.query(
            `SELECT c.* FROM campaigns c
             JOIN campaign_agents ca ON c.id = ca.campaign_id
             WHERE ca.user_id = $1 AND c.is_active = TRUE
             ORDER BY c.priority DESC, c.name`,
            [agentId]
        );

        if (assignedCampaignsRes.rows.length === 0) {
            await client.query('COMMIT');
            return { contact: null, campaign: null };
        }

        for (const campaign of assignedCampaignsRes.rows) {
            // Find one pending contact, lock it for update, and return it.
            // FOR UPDATE SKIP LOCKED is crucial for concurrency.
            const contactRes = await client.query(
                `SELECT * FROM contacts 
                 WHERE campaign_id = $1 AND status = 'pending' 
                 LIMIT 1 
                 FOR UPDATE SKIP LOCKED`,
                [campaign.id]
            );
            
            if (contactRes.rows.length > 0) {
                const contact = contactRes.rows[0];
                // Mark the contact as 'called' to prevent others from picking it up
                await client.query(
                    "UPDATE contacts SET status = 'called', updated_at = NOW() WHERE id = $1",
                    [contact.id]
                );
                await client.query('COMMIT');
                return { contact: keysToCamel(contact), campaign: keysToCamel(campaign) };
            }
        }

        // No contacts found in any assigned campaigns
        await client.query('COMMIT');
        return { contact: null, campaign: null };

    } catch (e) {
        await client.query('ROLLBACK');
        console.error("Error in getNextContactForCampaign transaction:", e);
        throw e;
    } finally {
        client.release();
    }
};

const qualifyContact = async (contactId, { qualificationId, campaignId, agentId }) => {
    const query = `
        UPDATE contacts 
        SET status = 'qualified', updated_at = NOW() 
        WHERE id = $1
    `;
    await pool.query(query, [contactId]);
    
    // Here you would also create a new entry in call_history
};

module.exports = {
    getCampaigns,
    saveCampaign,
    deleteCampaign,
    importContacts,
    getNextContactForCampaign,
    qualifyContact,
};