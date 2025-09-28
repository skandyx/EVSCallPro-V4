import React from 'react';
import type { AgentState, User, AgentStatus } from '../types.ts';
import { MicrophoneIcon, PhoneArrowUpRightIcon, AcademicCapIcon, PauseIcon, TrashIcon, UserCircleIcon } from './Icons.tsx';

interface AgentBoardProps {
    agents: AgentState[];
    currentUser: User;
    apiCall: any; // Axios instance
}

const STATUS_CONFIG: { [key in AgentStatus]: { label: string; color: string } } = {
    'En Attente': { label: 'En Attente', color: 'bg-green-100 text-green-800' },
    'En Appel': { label: 'En Appel', color: 'bg-red-100 text-red-800' },
    'En Post-Appel': { label: 'En Post-Appel', color: 'bg-red-100 text-red-800' },
    'En Pause': { label: 'En Pause', color: 'bg-slate-200 text-slate-800' },
    'Ringing': { label: 'Sonne', color: 'bg-yellow-100 text-yellow-800' },
    'Déconnecté': { label: 'Déconnecté', color: 'bg-gray-100 text-gray-800' },
};

const getStatusLedColor = (status: AgentStatus): string => {
    switch (status) {
        case 'En Attente': return 'bg-green-500';
        case 'En Appel': return 'bg-red-500';
        case 'En Post-Appel': return 'bg-red-500';
        case 'Ringing': return 'bg-yellow-400';
        case 'En Pause': return 'bg-slate-400';
        case 'Déconnecté': return 'bg-slate-400';
        default: return 'bg-slate-400';
    }
};

const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
};

const AgentBoard: React.FC<AgentBoardProps> = ({ agents, currentUser, apiCall }) => {
    
    const hasPermission = currentUser.role === 'Administrateur' || currentUser.role === 'Superviseur' || currentUser.role === 'SuperAdmin';

    const handleSupervisorAction = async (action: string, agentId: string) => {
        try {
            await apiCall.post(`/supervisor/${action}`, { agentId });
            alert(`Action '${action}' envoyée à l'agent ${agentId}`);
        } catch (error: any) {
            console.error(`Failed to perform action ${action} on agent ${agentId}:`, error);
            alert(`Erreur: ${error.response?.data?.error || error.message}`);
        }
    };

    const handleForceLogout = async (agentId: string, agentName: string) => {
        if (window.confirm(`Êtes-vous sûr de vouloir déconnecter de force l'agent ${agentName} ?`)) {
            await handleSupervisorAction('force-logout', agentId);
        }
    };
    
    // FIX: Removed filtering of disconnected agents. The supervisor dashboard should now
    // display all agents and their real-time status, including 'Déconnecté', providing a
    // complete and instantaneous overview of the team's state and resolving the perceived
    // connection delay.
    const connectedAgents = agents;

    return (
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                    <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Agent</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Statut</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Durée</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Appels</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">TMC</th>
                        <th className="px-4 py-2 text-center text-xs font-medium text-slate-500 uppercase">Actions</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200 text-sm">
                    {connectedAgents.map(agent => {
                        const agentFullName = `${agent.firstName} ${agent.lastName}`;
                        const canCoach = hasPermission && agent.status === 'En Appel';
                        const canForcePause = hasPermission && agent.status !== 'En Pause';
                        return (
                        <tr key={agent.id}>
                            <td className="px-4 py-3">
                                <div className="flex items-center">
                                    <div className="relative flex-shrink-0">
                                        {agent.profilePictureUrl ? (
                                            <img src={agent.profilePictureUrl} alt="Avatar" className="w-10 h-10 rounded-full object-cover" />
                                        ) : (
                                            <UserCircleIcon className="w-10 h-10 text-slate-400" />
                                        )}
                                        <span className={`absolute top-0 right-0 block h-3.5 w-3.5 rounded-full border-2 border-white ${getStatusLedColor(agent.status)}`}></span>
                                    </div>
                                    <div className="ml-3">
                                        <div className="font-medium text-slate-800">{agentFullName}</div>
                                        <div className="text-sm text-slate-500 font-mono">{agent.loginId}</div>
                                    </div>
                                </div>
                            </td>
                            <td className="px-4 py-3">
                                <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${STATUS_CONFIG[agent.status].color}`}>
                                    {STATUS_CONFIG[agent.status].label}
                                </span>
                            </td>
                            <td className="px-4 py-3 font-mono text-slate-600">{formatDuration(agent.statusDuration)}</td>
                            <td className="px-4 py-3 text-slate-600">{agent.callsHandledToday}</td>
                            <td className="px-4 py-3 text-slate-600 font-mono">{formatDuration(agent.averageHandlingTime)}</td>
                            <td className="px-4 py-3 text-center space-x-1">
                                <button onClick={() => handleSupervisorAction('listen', agent.id)} disabled={!canCoach} title="Écouter (Whisper)" className="p-1 rounded-md text-slate-500 hover:bg-slate-100 disabled:text-slate-300 disabled:cursor-not-allowed"><MicrophoneIcon className="w-4 h-4"/></button>
                                <button onClick={() => handleSupervisorAction('barge', agent.id)} disabled={!canCoach} title="Intervenir (Barge)" className="p-1 rounded-md text-slate-500 hover:bg-slate-100 disabled:text-slate-300 disabled:cursor-not-allowed"><PhoneArrowUpRightIcon className="w-4 h-4"/></button>
                                <button onClick={() => handleSupervisorAction('coach', agent.id)} disabled={!canCoach} title="Coacher" className="p-1 rounded-md text-slate-500 hover:bg-slate-100 disabled:text-slate-300 disabled:cursor-not-allowed"><AcademicCapIcon className="w-4 h-4"/></button>
                                <button onClick={() => handleSupervisorAction('force-pause', agent.id)} disabled={!canForcePause} title="Forcer la Pause" className="p-1 rounded-md text-slate-500 hover:bg-slate-100 disabled:text-slate-300 disabled:cursor-not-allowed"><PauseIcon className="w-4 h-4"/></button>
                                <button onClick={() => handleForceLogout(agent.id, agentFullName)} disabled={!hasPermission} title="Forcer la Déconnexion" className="p-1 rounded-md text-red-500 hover:bg-red-100 disabled:text-red-200 disabled:cursor-not-allowed"><TrashIcon className="w-4 h-4"/></button>
                            </td>
                        </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    );
};

export default AgentBoard;