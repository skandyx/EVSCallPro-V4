const pool = require('./connection');
const { keysToCamel } = require('./utils');
const { broadcast } = require('../webSocketServer');

// --- HELPER FUNCTIONS for Quotas & Filters ---

/**
 * Sanitizes a string to be used as a JSONB key in a SQL query.
 * Prevents SQL injection on dynamic field names.
 * @param {string} identifier - The field name from the script.
 * @returns {string} A sanitized identifier.
 */
const sanitizeIdentifier = (identifier) => {
    if (!/^[a-zA-Z0-9_]+$/.test(identifier)) {
        throw new Error(`Invalid field identifier for query: ${identifier}`);
    }
    return identifier;
};

/**
 * Gets the value of a specific field from a contact object.
 * Handles both standard fields and custom fields from the JSONB column.
 * @param {object} contact - The contact object.
 * @param {string} fieldId - The ID of the field to retrieve.
 * @returns {any} The value of the field.
 */
const getContactValue = (contact, fieldId) => {
    const standardFields = {
        postalCode: contact.postalCode,
        phoneNumber: contact.phoneNumber,
        lastName: contact.lastName,
    };
    if (fieldId in standardFields) {
        return standardFields[fieldId];
    }
    return contact.customFields ? contact.customFields[fieldId] : undefined;
};

/**
 * Checks if a contact matches a single filter or quota rule.
 * @param {object} contact - The contact object.
 * @param {object} rule - The filter or quota rule object.
 * @returns {boolean} True if the contact matches the rule.
 */
const matchRule = (contact, rule) => {
    const contactValue = getContactValue(contact, rule.contactField);
    const ruleValue = rule.value;

    if (contactValue === null || contactValue === undefined) {
        // 'is_not_empty' should fail on null/undefined, others should too
        return rule.operator === 'is_not_empty' ? false : false;
    }
    const contactString = String(contactValue).trim().toLowerCase();
    const ruleString = String(ruleValue).trim().toLowerCase();

    switch (rule.operator) {
        case 'equals': return contactString === ruleString;
        case 'starts_with': return contactString.startsWith(ruleString);
        case 'contains': return contactString.includes(ruleString);
        case 'is_not_empty': return contactString !== '';
        default: return false;
    }
};

/**
 * Determines if a contact is allowed based on the campaign's filter rules.
 * @param {object} contact - The contact object.
 * @param {Array} filterRules - The array of filter rules for the campaign.
 * @returns {boolean} True if the contact should be called.
 */
const isContactAllowedByFilters = (contact, filterRules) => {
    if (!filterRules || filterRules.length === 0) return true;

    const includes = filterRules.filter(r => r.type === 'include');
    const excludes = filterRules.filter(r => r.type === 'exclude');

    let isIncluded = true;
    if (includes.length > 0) {
        isIncluded = includes.some(rule => matchRule(contact, rule));
    }
    if (!isIncluded) return false;

    const isExcluded = excludes.some(rule => matchRule(contact, rule));
    return !isExcluded;
};

/**
 * Builds a SQL WHERE clause fragment for a given rule.
 * @param {object} rule - The quota rule object.
 * @param {number} paramStartIndex - The starting index for query parameters.
 * @returns {{clause: string, params: Array}} The SQL clause and its parameters.
 */
const buildWhereClauseForRule = (rule, paramStartIndex) => {
    const fieldMap = {
        postalCode: 'c.postal_code',
        phoneNumber: 'c.phone_number',
        lastName: 'c.last_name',
    };
    
    const dbField = fieldMap[rule.contactField]
        ? fieldMap[rule.contactField]
        : `(c.custom_fields ->> '${sanitizeIdentifier(rule.contactField)}')`;
    
    const params = [];
    let clause;

    switch (rule.operator) {
        case 'equals':
            clause = `${dbField} = $${paramStartIndex}`;
            params.push(rule.value);
            break;
        case 'starts_with':
            clause = `${dbField} LIKE $${paramStartIndex}`;
            params.push(`${rule.value}%`);
            break;
        case 'contains':
            clause = `${dbField} LIKE $${paramStartIndex}`;
            params.push(`%${rule.value}%`);
            break;
        case 'is_not_empty':
            clause = `${dbField} IS NOT NULL AND ${dbField} != ''`;
            break;
        default:
            clause = 'TRUE'; // Default to a non-filtering clause
    }
    return { clause, params };
};


// --- CORE DB FUNCTIONS ---

const getCampaigns = async () => {
    // This query now fetches everything in one go: campaigns, their contacts, and their assigned user IDs.
    const query = `
        SELECT
            c.*,
            COALESCE(
                (SELECT json_agg(ct.*) FROM contacts ct WHERE ct.campaign_id = c.id),
                '[]'::json
            ) as contacts,
            COALESCE(
                ARRAY_AGG(ca.user_id) FILTER (WHERE ca.user_id IS NOT NULL),
                '{}'
            ) as assigned_user_ids
        FROM campaigns c
        LEFT JOIN campaign_agents ca ON c.id = ca.campaign_id
        GROUP BY c.id
        ORDER BY c.name;
    `;
    const res = await pool.query(query);
    // The keysToCamel util will handle nested objects correctly.
    return res.rows.map(keysToCamel);
};

const saveCampaign = async (campaign, id) => {
    const { name, description, scriptId, qualificationGroupId, callerId, isActive, dialingMode, wrapUpTime, quotaRules, filterRules, priority, assignedUserIds } = campaign;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        let savedCampaign;
        const campaignId = id || campaign.id;

        if (id) {
            const res = await client.query(
                'UPDATE campaigns SET name=$1, description=$2, script_id=$3, qualification_group_id=$4, caller_id=$5, is_active=$6, dialing_mode=$7, wrap_up_time=$8, quota_rules=$9, filter_rules=$10, priority=$11, updated_at=NOW() WHERE id=$12 RETURNING *',
                [name, description, scriptId, qualificationGroupId, callerId, isActive, dialingMode, wrapUpTime, JSON.stringify(quotaRules || []), JSON.stringify(filterRules || []), priority || 5, id]
            );
            savedCampaign = res.rows[0];
        } else {
            const res = await client.query(
                'INSERT INTO campaigns (id, name, description, script_id, qualification_group_id, caller_id, is_active, dialing_mode, wrap_up_time, quota_rules, filter_rules, priority) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *',
                [campaign.id, name, description, scriptId, qualificationGroupId, callerId, isActive, dialingMode, wrapUpTime, JSON.stringify(quotaRules || []), JSON.stringify(filterRules || []), priority || 5]
            );
            savedCampaign = res.rows[0];
        }

        // Now handle agent assignments
        const { rows: currentAgents } = await client.query('SELECT user_id FROM campaign_agents WHERE campaign_id = $1', [campaignId]);
        const currentAgentIds = new Set(currentAgents.map(a => a.user_id));
        const desiredAgentIds = new Set(assignedUserIds || []);

        const toAdd = [...desiredAgentIds].filter(userId => !currentAgentIds.has(userId));
        const toRemove = [...currentAgentIds].filter(userId => !desiredAgentIds.has(userId));

        if (toRemove.length > 0) {
            await client.query(`DELETE FROM campaign_agents WHERE campaign_id = $1 AND user_id = ANY($2::text[])`, [campaignId, toRemove]);
        }
        if (toAdd.length > 0) {
            for (const userId of toAdd) {
                await client.query('INSERT INTO campaign_agents (campaign_id, user_id) VALUES ($1, $2)', [campaignId, userId]);
            }
        }

        await client.query('COMMIT');
        
        const finalCampaign = keysToCamel(savedCampaign);
        finalCampaign.assignedUserIds = assignedUserIds || [];
        // Fetch contacts for the campaign to have a complete object for broadcasting
        const contactsRes = await pool.query('SELECT * FROM contacts WHERE campaign_id = $1', [finalCampaign.id]);
        finalCampaign.contacts = contactsRes.rows.map(keysToCamel);
        
        // Broadcast the update to all clients
        broadcast({ type: 'campaignUpdate', payload: finalCampaign });
        
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
                let value = getContactValue(contact, fieldId) ?? '';
                return String(value).trim().toLowerCase();
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
                    invalids.push({ row: contact.originalRow, reason: "Doublon détecté." });
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

        const assignedCampaignsRes = await client.query(
            `SELECT * FROM campaigns c
             JOIN campaign_agents ca ON c.id = ca.campaign_id
             WHERE ca.user_id = $1 AND c.is_active = TRUE
             ORDER BY c.priority DESC, c.name`,
            [agentId]
        );

        if (assignedCampaignsRes.rows.length === 0) {
            await client.query('COMMIT');
            return { contact: null, campaign: null };
        }

        for (const campaignRow of assignedCampaignsRes.rows) {
            const campaign = keysToCamel(campaignRow);
            const { filterRules, quotaRules, qualificationGroupId } = campaign;

            // 1. Pre-calculate quota counts for this campaign
            const quotaCounts = {};
            if (quotaRules && quotaRules.length > 0 && qualificationGroupId) {
                const { rows: positiveQuals } = await client.query("SELECT id FROM qualifications WHERE group_id = $1 AND type = 'positive'", [qualificationGroupId]);
                const positiveQualIds = positiveQuals.map(q => q.id);

                if (positiveQualIds.length > 0) {
                    for (const rule of quotaRules) {
                        const { clause, params } = buildWhereClauseForRule(rule, 3);
                        const countQuery = `
                            SELECT COUNT(DISTINCT ch.contact_id) FROM call_history ch
                            JOIN contacts c ON ch.contact_id = c.id
                            WHERE ch.campaign_id = $1 AND ch.qualification_id = ANY($2::text[]) AND ${clause}
                        `;
                        const countRes = await client.query(countQuery, [campaign.id, positiveQualIds, ...params]);
                        quotaCounts[rule.id] = parseInt(countRes.rows[0].count, 10);
                    }
                }
            }

            // 2. Fetch all pending contacts for this campaign
            const pendingContactsRes = await client.query(`SELECT * FROM contacts WHERE campaign_id = $1 AND status = 'pending'`, [campaign.id]);
            const pendingContacts = pendingContactsRes.rows.map(keysToCamel);

            // 3. Find the first contact that passes all rules
            for (const contact of pendingContacts) {
                // 3a. Check filters
                if (!isContactAllowedByFilters(contact, filterRules)) {
                    continue; // Skip this contact
                }

                // 3b. Check quotas
                let isQuotaReached = false;
                if (quotaRules && quotaRules.length > 0) {
                    for (const rule of quotaRules) {
                        if (matchRule(contact, rule)) { // If contact matches a rule's segment
                            if ((quotaCounts[rule.id] || 0) >= rule.limit) {
                                isQuotaReached = true;
                                break; // Quota for this segment is full, skip contact
                            }
                        }
                    }
                }
                if (isQuotaReached) {
                    continue; // Skip this contact
                }

                // 4. Try to lock and claim the contact
                const lockRes = await client.query(`SELECT id FROM contacts WHERE id = $1 FOR UPDATE SKIP LOCKED`, [contact.id]);
                if (lockRes.rows.length > 0) {
                    await client.query(`UPDATE contacts SET status = 'called', updated_at = NOW() WHERE id = $1`, [contact.id]);
                    await client.query('COMMIT');
                    return { contact, campaign };
                }
                // If lock failed, another process got it. Continue to the next contact.
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