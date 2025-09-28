// backend/services/webSocketServer.js
const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const url = require('url');

const ACCESS_TOKEN_SECRET = process.env.JWT_SECRET;
let wss;

const clients = new Map(); // Map<ws, {id: string, role: string}>

/**
 * Initialise le serveur WebSocket et l'attache au serveur HTTP existant.
 * @param {http.Server} server - L'instance du serveur HTTP.
 * @returns {WebSocket.Server} L'instance du serveur WebSocket.
 */
function initializeWebSocketServer(server) {
    wss = new WebSocket.Server({ noServer: true });

    server.on('upgrade', (request, socket, head) => {
        const { query } = url.parse(request.url, true);
        const token = query.token;

        if (!token) {
            socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
            socket.destroy();
            return;
        }

        jwt.verify(token, ACCESS_TOKEN_SECRET, (err, decoded) => {
            if (err) {
                socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
                socket.destroy();
                return;
            }

            // Si le token est valide, on "upgrade" la connexion en WebSocket
            wss.handleUpgrade(request, socket, head, (ws) => {
                ws.user = decoded; // Attache les infos user au client ws
                wss.emit('connection', ws, request);
            });
        });
    });

    wss.on('connection', (ws) => {
        console.log(`[WS] Client connected: User ID ${ws.user.id}, Role ${ws.user.role}`);
        clients.set(ws, { id: ws.user.id, role: ws.user.role });

        // FIX: When an agent connects, immediately broadcast their 'En Attente' status
        // to supervisors so they appear on the real-time dashboard right away.
        if (ws.user.role === 'Agent') {
            const connectEvent = {
                type: 'agentStatusUpdate',
                payload: {
                    agentId: ws.user.id,
                    status: 'En Attente'
                }
            };
            broadcastToRoom('superviseur', connectEvent);
        }

        ws.on('message', (message) => {
            try {
                const event = JSON.parse(message.toString());
                // Handle agent-initiated status changes and broadcast to supervisors
                if (event.type === 'agentStatusChange' && ws.user.role === 'Agent') {
                    console.log(`[WS] Received agentStatusChange from ${ws.user.id}: ${event.payload.status}`);
                    const broadcastEvent = {
                        type: 'agentStatusUpdate', // The event supervisors listen for
                        payload: {
                            agentId: ws.user.id,
                            status: event.payload.status
                        }
                    };
                    broadcastToRoom('superviseur', broadcastEvent);
                }
            } catch (e) {
                console.error('[WS] Error processing message:', e);
            }
        });

        ws.on('close', () => {
            console.log(`[WS] Client disconnected: User ID ${ws.user.id}`);
            // FIX: When an agent disconnects, broadcast this to supervisors so they disappear
            // from the real-time dashboard immediately.
            if (ws.user.role === 'Agent') {
                const disconnectEvent = {
                    type: 'agentStatusUpdate',
                    payload: {
                        agentId: ws.user.id,
                        status: 'Déconnecté'
                    }
                };
                broadcastToRoom('superviseur', disconnectEvent);
            }
            clients.delete(ws);
        });

        ws.on('error', (error) => {
            console.error('[WS] Error for client:', ws.user.id, error);
        });
    });
    
    console.log('[WS] WebSocket Server initialized.');
    return wss;
}

/**
 * Diffuse un événement à tous les clients connectés.
 * @param {object} event - L'objet événement à envoyer.
 */
function broadcast(event) {
    if (!wss) {
        console.error("[WS] WebSocket server is not initialized for broadcast.");
        return;
    }
    const message = JSON.stringify(event);
    clients.forEach((_, clientWs) => {
        if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(message);
        }
    });
}

/**
 * Envoie un événement à un utilisateur spécifique par son ID.
 * @param {string} userId - L'ID de l'utilisateur cible.
 * @param {object} event - L'objet événement à envoyer.
 */
function sendToUser(userId, event) {
    if (!wss) {
        console.error("[WS] WebSocket server is not initialized for targeted send.");
        return;
    }
    const message = JSON.stringify(event);
    for (const [clientWs, clientInfo] of clients.entries()) {
        if (clientInfo.id === userId && clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(message);
            // On peut s'arrêter si on suppose qu'un utilisateur n'a qu'une seule connexion
            // break; 
        }
    }
}


/**
 * Diffuse un événement à tous les clients connectés dans une "room" spécifique.
 * Les rooms sont basées sur le rôle de l'utilisateur.
 * @param {string} room - Le nom de la room (ex: 'superviseur', 'admin').
 * @param {object} event - L'objet événement à envoyer.
 */
function broadcastToRoom(room, event) {
    if (!wss) {
        console.error("[WS] WebSocket server is not initialized.");
        return;
    }

    const message = JSON.stringify(event);
    const targetRoles = new Set();
    if (room === 'superviseur') targetRoles.add('Superviseur').add('Administrateur').add('SuperAdmin');
    if (room === 'admin') targetRoles.add('Administrateur').add('SuperAdmin');
    
    clients.forEach((clientInfo, clientWs) => {
        if (targetRoles.has(clientInfo.role) && clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(message);
        }
    });
}

module.exports = {
    initializeWebSocketServer,
    broadcastToRoom,
    sendToUser,
    broadcast
};