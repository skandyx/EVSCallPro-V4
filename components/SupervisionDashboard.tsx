
import React, { useState, useMemo } from 'react';
import type { Feature, AgentState, ActiveCall, CampaignState, User, Campaign } from '../types.ts';
import AgentBoard from './AgentBoard.tsx';
import CallBoard from './CallBoard.tsx';
import CampaignBoard from './CampaignBoard.tsx';
import { UsersIcon, PhoneIcon, ChartBarIcon } from './Icons.tsx';

interface SupervisionDashboardProps {
    feature: Feature;
    users: User[];
    campaigns: Campaign[];
    currentUser: User | null;
    agentStates: AgentState[];
    activeCalls: ActiveCall[];
    campaignStates: CampaignState[];
}

type Tab = 'live' | 'agents' | 'calls' | 'campaigns';

const KpiCard: React.FC<{ title: string; value: string | number; icon: React.FC<any> }> = ({ title, value, icon: Icon }) => (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
        <div className="flex items-center">
            <div className="p-3 bg-indigo-100 rounded-full mr-4">
                <Icon className="h-6 w-6 text-indigo-600" />
            </div>
            <div>
                <p className="text-sm text-slate-500">{title}</p>
                <p className="text-3xl font-bold text-slate-900">{value}</p>
            </div>
        </div>
    </div>
);

// FIX: Imported useState hook from React to resolve 'Cannot find name' error.
const SupervisionDashboard: React.FC<SupervisionDashboardProps> = ({ feature, users, campaigns, currentUser, agentStates, activeCalls, campaignStates }) => {
    const [activeTab, setActiveTab] = useState<Tab>('live');

    const kpis = useMemo(() => ({
        agentsReady: agentStates.filter(a => a.status === 'En Attente').length,
        agentsOnCall: agentStates.filter(a => a.status === 'En Appel').length,
        agentsOnWrapup: agentStates.filter(a => a.status === 'En Post-Appel').length,
        agentsOnPause: agentStates.filter(a => a.status === 'En Pause').length,
        activeCalls: activeCalls.length,
    }), [agentStates, activeCalls]);

    const renderContent = () => {
        if (!currentUser) return null;
        switch (activeTab) {
            case 'live':
                return (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                        <KpiCard title="Agents en Attente" value={kpis.agentsReady} icon={UsersIcon} />
                        <KpiCard title="Agents en Appel" value={kpis.agentsOnCall} icon={PhoneIcon} />
                        <KpiCard title="Agents en Post-Appel" value={kpis.agentsOnWrapup} icon={UsersIcon} />
                        <KpiCard title="Agents en Pause" value={kpis.agentsOnPause} icon={UsersIcon} />
                        <KpiCard title="Appels Actifs" value={kpis.activeCalls} icon={ChartBarIcon} />
                    </div>
                );
            case 'agents':
                return <AgentBoard agents={agentStates} currentUser={currentUser} />;
            case 'calls':
                return <CallBoard calls={activeCalls} agents={users} campaigns={campaigns} />;
            case 'campaigns':
                return <CampaignBoard campaignStates={campaignStates} />;
            default:
                return null;
        }
    };
    
    const TabButton: React.FC<{ tabName: Tab; label: string; }> = ({ tabName, label }) => (
        <button
            onClick={() => setActiveTab(tabName)}
            className={`px-4 py-2 text-sm font-semibold rounded-md ${activeTab === tabName ? 'bg-indigo-600 text-white shadow' : 'text-slate-600 hover:bg-slate-200'}`}
        >
            {label}
        </button>
    );

    return (
        <div className="max-w-7xl mx-auto space-y-8">
            <header>
                <h1 className="text-4xl font-bold text-slate-900 tracking-tight">{feature.title}</h1>
                <p className="mt-2 text-lg text-slate-600">{feature.description}</p>
            </header>
            
            <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                 <div className="flex justify-between items-center mb-4 border-b pb-4">
                    <h2 className="text-2xl font-semibold text-slate-800">Panneau de Contrôle</h2>
                    <div className="flex space-x-2 p-1 bg-slate-100 rounded-lg">
                        <TabButton tabName="live" label="Live" />
                        <TabButton tabName="agents" label="Agents" />
                        <TabButton tabName="calls" label="Appels" />
                        <TabButton tabName="campaigns" label="Campagnes" />
                    </div>
                </div>
                {renderContent()}
            </div>
        </div>
    );
};

export default SupervisionDashboard;