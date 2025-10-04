// backend/routes/planning.js
const express = require('express');
const router = express.Router();
const db = require('../services/db');
const { broadcast } = require('../services/webSocketServer');

/**
 * @openapi
 * /planning-events:
 *   post:
 *     summary: Crée un ou plusieurs événements de planning, y compris récurrents.
 *     tags: [Planning]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PlanningEvent'
 *     responses:
 *       '201':
 *         description: 'Événement(s) créé(s)'
 */
router.post('/', async (req, res) => {
    try {
        const { eventData, targetIds, isRecurring, recurringDays, recurrenceEndDate } = req.body;
        const { activityId, startDate, endDate } = eventData;

        const agentsToSchedule = new Set();
        for (const targetId of targetIds) {
            const type = targetId.substring(0, targetId.indexOf('-'));
            const id = targetId.substring(targetId.indexOf('-') + 1);

            if (type === 'group') {
                const group = (await db.getUserGroups()).find(g => g.id === id);
                if (group) group.memberIds.forEach(mid => agentsToSchedule.add(mid));
            } else if (type === 'user') {
                agentsToSchedule.add(id);
            }
        }
        
        const agentDetails = await db.getUsers();
        const agentsWithSites = agentDetails.reduce((acc, user) => {
            acc[user.id] = user.siteId;
            return acc;
        }, {});


        const createdEvents = [];
        
        if (isRecurring && recurringDays?.length && recurrenceEndDate) {
            const recurrenceStart = new Date(startDate);
            const recurrenceEnd = new Date(recurrenceEndDate);
            recurrenceEnd.setHours(23, 59, 59, 999);
            const durationMs = new Date(endDate).getTime() - new Date(startDate).getTime();

            for (const agentId of agentsToSchedule) {
                let currentDate = new Date(recurrenceStart);
                while (currentDate <= recurrenceEnd) {
                    const dayOfWeek = currentDate.getDay() === 0 ? 7 : currentDate.getDay(); // Sunday is 7
                    if (recurringDays.includes(dayOfWeek)) {
                        const instanceStartDate = new Date(currentDate);
                        instanceStartDate.setHours(recurrenceStart.getHours(), recurrenceStart.getMinutes(), 0, 0);
                        const instanceEndDate = new Date(instanceStartDate.getTime() + durationMs);
                        
                        const eventToSave = {
                            id: `plan-${Date.now()}-${Math.random()}`,
                            agentId: agentId,
                            activityId,
                            startDate: instanceStartDate.toISOString(),
                            endDate: instanceEndDate.toISOString(),
                            siteId: agentsWithSites[agentId] || null
                        };
                        const newEvent = await db.savePlanningEvent(eventToSave);
                        createdEvents.push(newEvent);
                    }
                    currentDate.setDate(currentDate.getDate() + 1);
                }
            }
        } else {
            for (const agentId of agentsToSchedule) {
                 const eventToSave = {
                    id: `plan-${Date.now()}-${Math.random()}`,
                    agentId: agentId,
                    activityId,
                    startDate,
                    endDate,
                    siteId: agentsWithSites[agentId] || null
                };
                const newEvent = await db.savePlanningEvent(eventToSave);
                createdEvents.push(newEvent);
            }
        }

        broadcast({ type: 'planningUpdated' });
        res.status(201).json(createdEvents);

    } catch (e) {
        console.error("Error saving planning event:", e);
        res.status(500).json({ error: e.message || 'Failed to save event' });
    }
});


/**
 * @openapi
 * /planning-events/{id}:
 *   put:
 *     summary: Met à jour un événement de planning.
 *     tags: [Planning]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PlanningEvent'
 *     responses:
 *       '200':
 *         description: 'Événement mis à jour'
 */
router.put('/:id', async (req, res) => {
    try {
        const updatedEvent = await db.savePlanningEvent(req.body, req.params.id);
        broadcast({ type: 'planningUpdated' });
        res.json(updatedEvent);
    } catch (e) {
        console.error("Error updating planning event:", e);
        res.status(500).json({ error: e.message || 'Failed to save event' });
    }
});

/**
 * @openapi
 * /planning-events/{id}:
 *   delete:
 *     summary: Supprime un événement de planning.
 *     tags: [Planning]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '204':
 *         description: 'Événement supprimé'
 */
router.delete('/:id', async (req, res) => {
    try {
        await db.deletePlanningEvent(req.params.id);
        broadcast({ type: 'planningUpdated' });
        res.status(204).send();
    } catch (e) {
        console.error("Error deleting planning event:", e);
        res.status(500).json({ error: e.message || 'Failed to delete event' });
    }
});

/**
 * @openapi
 * /planning-events/bulk-delete:
 *   post:
 *     summary: Supprime plusieurs événements de planning en masse.
 *     tags: [Planning]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               eventIds:
 *                 type: array
 *                 items: { type: string }
 *     responses:
 *       '200':
 *         description: "Événements supprimés avec succès."
 */
router.post('/bulk-delete', async (req, res) => {
    const { eventIds } = req.body;
    if (!eventIds || !Array.isArray(eventIds) || eventIds.length === 0) {
        return res.status(400).json({ error: "Un tableau d'eventIds est requis." });
    }

    try {
        const deletedCount = await db.deletePlanningEventsBulk(eventIds);
        broadcast({ type: 'planningUpdated' });
        res.json({ message: `${deletedCount} événement(s) supprimé(s) avec succès.` });
    } catch (error) {
        console.error('Error bulk deleting planning events:', error);
        res.status(500).json({ error: 'Échec de la suppression des événements.' });
    }
});


/**
 * @openapi
 * /planning-events/callbacks/{id}:
 *   put:
 *     summary: Met à jour le statut d'un rappel personnel.
 *     tags: [Planning]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status: { type: string, enum: ['completed', 'cancelled'] }
 *     responses:
 *       '200':
 *         description: 'Rappel mis à jour.'
 */
router.put('/callbacks/:id', async (req, res) => {
    try {
        const { status } = req.body;
        if (!['completed', 'cancelled'].includes(status)) {
            return res.status(400).json({ error: "Statut invalide." });
        }
        const updatedCallback = await db.updatePersonalCallbackStatus(req.params.id, status);
        if (!updatedCallback) {
            return res.status(404).json({ error: "Rappel non trouvé." });
        }
        res.json(updatedCallback);
    } catch (e) {
        res.status(500).json({ error: 'Failed to update callback' });
    }
});

/**
 * @openapi
 * /planning-events/all:
 *   delete:
 *     summary: Supprime TOUS les événements du planning.
 *     tags: [Planning]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: 'Tous les événements ont été supprimés.'
 *       '403':
 *         description: 'Accès non autorisé.'
 */
router.delete('/all', async (req, res) => {
    // Restrict this highly destructive action to Admins and SuperAdmins
    const allowedRoles = ['Administrateur', 'SuperAdmin'];
    if (!req.user || !allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ error: 'Accès non autorisé.' });
    }

    try {
        await db.clearAllPlanningEvents();
        broadcast({ type: 'planningUpdated' });
        res.json({ message: 'Tous les événements du planning ont été supprimés avec succès.' });
    } catch (e) {
        console.error("Error clearing all planning events:", e);
        res.status(500).json({ error: e.message || 'Failed to clear all events' });
    }
});

module.exports = router;