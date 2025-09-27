import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { Campaign, Contact, SavedScript, Qualification, QualificationGroup, CallHistoryRecord, User } from '../types.ts';
import { ArrowLeftIcon, UserCircleIcon, ChartBarIcon, WrenchScrewdriverIcon, TrashIcon, PlusIcon } from './Icons.tsx';

declare var Chart: any;

interface CampaignDetailViewProps {
    campaign: Campaign;
    script: SavedScript | null;
    onBack: () => void;
    onSaveCampaign: (campaign: Campaign) => void;
    onUpdateContact: (contact: Contact) => void;
    onDeleteContacts: (contactIds: string[]) => void;
    // Props additionnelles nécessaires pour les nouveaux onglets
    callHistory: CallHistoryRecord[];
    qualifications: Qualification[];
    qualificationGroups: QualificationGroup[];
    savedScripts: SavedScript[];
    users: User[];
}

const KpiCard: React.FC<{ title: string; value: string | number; subtext?: string }> = ({ title, value, subtext }) => (
    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
        <p className="text-sm text-slate-500">{title}</p>
        <p className="text-3xl font-bold text-slate-900">{value}</p>
        {subtext && <p className="text-xs text-slate-400">{subtext}</p>}
    </div>
);

const ChartComponent: React.FC<{ chartId: string; type: string; data: any; options: any; }> = ({ chartId, type, data, options }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const chartRef = useRef<any>(null);

    useEffect(() => {
        if (canvasRef.current) {
            if (chartRef.current) {
                chartRef.current.destroy();
            }
            const ctx = canvasRef.current.getContext('2d');
            if (ctx) {
                chartRef.current = new Chart(ctx, { type, data, options });
            }
        }
        return () => chartRef.current?.destroy();
    }, [type, data, options]);

    return <canvas id={chartId} ref={canvasRef}></canvas>;
};


const CampaignStatsTab: React.FC<{ campaign: Campaign; callHistory: CallHistoryRecord[]; qualifications: Qualification[] }> = ({ campaign, callHistory, qualifications }) => {
    const stats = useMemo(() => {
        const totalContacts = campaign.contacts.length;
        if (totalContacts === 0) {
             return {
                penetrationRate: 0,
                callsMade: 0,
                avgCallDuration: 0,
                successRate: 0,
                statusCounts: { pending: 0, called: 0, qualified: 0 },
                qualifCounts: {},
            };
        }

        const campaignCalls = callHistory.filter(c => c.campaignId === campaign.id);
        const callsMade = campaignCalls.length;
        const totalDuration = campaignCalls.reduce((acc, call) => acc + call.duration, 0);
        const avgCallDuration = callsMade > 0 ? totalDuration / callsMade : 0;

        const qualifiedContacts = campaign.contacts.filter(c => c.status === 'qualified');
        const qualifiedCalls = campaignCalls.filter(c => c.qualificationId);
        
        const positiveQuals = qualifiedCalls.filter(c => {
            const qual = qualifications.find(q => q.id === c.qualificationId);
            return qual?.type === 'positive';
        }).length;
        
        const successRate = qualifiedCalls.length > 0 ? (positiveQuals / qualifiedCalls.length) * 100 : 0;

        const statusCounts = campaign.contacts.reduce((acc, contact) => {
            acc[contact.status] = (acc[contact.status] || 0) + 1;
            return acc;
        }, { pending: 0, called: 0, qualified: 0 });

        const penetrationRate = totalContacts > 0 ? ((totalContacts - (statusCounts.pending || 0)) / totalContacts) * 100 : 0;

        const qualifCounts = qualifiedCalls.reduce((acc, call) => {
            const qual = qualifications.find(q => q.id === call.qualificationId);
            const key = qual ? qual.description : 'Non qualifié';
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        return { penetrationRate, callsMade, avgCallDuration, successRate, statusCounts, qualifCounts };
    }, [campaign, callHistory, qualifications]);
    
    const formatDuration = (seconds: number) => `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;

    const statusChartData = {
        labels: ['En attente', 'Traité (sans qualif)', 'Qualifié'],
        datasets: [{
            data: [stats.statusCounts.pending, stats.statusCounts.called, stats.statusCounts.qualified],
            backgroundColor: ['#64748b', '#f59e0b', '#10b981'],
        }]
    };
    
    const qualifChartData = {
        labels: Object.keys(stats.qualifCounts),
        datasets: [{
            label: "Nombre d'appels",
            data: Object.values(stats.qualifCounts),
            backgroundColor: '#4f46e5',
        }]
    };

    if (campaign.contacts.length === 0) {
        return <div className="p-8 text-center text-slate-500">Aucun contact n'a encore été importé dans cette campagne. Les statistiques apparaîtront ici une fois les contacts ajoutés et les appels effectués.</div>
    }

    const totalContacts = campaign.contacts.length;
    const processedContacts = totalContacts - stats.statusCounts.pending;

    return (
        <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KpiCard title="Taux de Pénétration" value={`${stats.penetrationRate.toFixed(1)}%`} subtext={`${processedContacts} / ${totalContacts} contacts`} />
                <KpiCard title="Appels Effectués" value={stats.callsMade} />
                <KpiCard title="Taux de Succès" value={`${stats.successRate.toFixed(1)}%`} subtext="Basé sur les appels qualifiés" />
                <KpiCard title="Durée Moyenne de Comm." value={formatDuration(stats.avgCallDuration)} />
            </div>
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-4 rounded-lg shadow-sm border">
                    <h3 className="font-semibold text-slate-800 mb-3">État du Fichier</h3>
                    <div className="h-64"><ChartComponent chartId="statusChart" type="doughnut" data={statusChartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' }} }} /></div>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-sm border">
                    <h3 className="font-semibold text-slate-800 mb-3">Répartition des Qualifications</h3>
                     <div className="h-64"><ChartComponent chartId="qualifChart" type="bar" data={qualifChartData} options={{ responsive: true, maintainAspectRatio: false, indexAxis: 'y' }} /></div>
                </div>
             </div>
             <div className="bg-white p-4 rounded-lg shadow-sm border">
                <h3 className="font-semibold text-slate-800 mb-3">Détail par Qualification</h3>
                <div className="overflow-x-auto max-h-64">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                        <thead className="bg-slate-50 sticky top-0">
                            <tr>
                                <th className="px-4 py-2 text-left font-medium text-slate-500 uppercase">Qualification</th>
                                <th className="px-4 py-2 text-left font-medium text-slate-500 uppercase">Nombre d'appels</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {Object.entries(stats.qualifCounts).map(([qualif, count]) => (
                                <tr key={qualif}>
                                    <td className="px-4 py-2 font-medium text-slate-700">{qualif}</td>
                                    <td className="px-4 py-2 text-slate-600 font-semibold">{count}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

const CampaignQuotaTab: React.FC<{ campaign: Campaign; callHistory: CallHistoryRecord[]; qualifications: Qualification[], script: SavedScript | null }> = ({ campaign, callHistory, qualifications, script }) => {
    
    // Helper function to get a contact's value for a given field, checking standard and custom fields.
    const getContactValue = (contact: Contact, fieldId: string): any => {
        // Map of standard fields to their snake_case equivalents if they differ, or just the field name.
        const standardFieldsMap: Record<string, keyof Contact> = {
            postalCode: 'postalCode',
            phoneNumber: 'phoneNumber',
            lastName: 'lastName',
            firstName: 'firstName',
        };

        const standardFieldName = Object.keys(standardFieldsMap).find(key => 
            script?.pages.flatMap(p => p.blocks).find(b => b.fieldName === key && b.isStandard)
        );
        
        // This logic is tricky. Let's simplify: check if the fieldId is a known standard field.
        const standardFields = ['postalCode', 'phoneNumber', 'lastName', 'firstName'];
        const scriptStandardFields = script?.pages.flatMap(p=>p.blocks).filter(b=>b.isStandard).map(b=>b.fieldName) || [];

        if (scriptStandardFields.includes(fieldId)){
            // This is a standard field, but its key in the Contact object might be camelCase.
            // Example: fieldId might be 'first_name', but on the Contact object it's 'firstName'.
            // This requires a mapping which we don't have.
            // A simpler, more robust way is to check the `customFields` first.
        }

        if (contact.customFields && fieldId in contact.customFields) {
            return contact.customFields[fieldId];
        }

        // Fallback for standard fields if not in customFields. This is less robust if fieldNames differ.
        if (fieldId === 'first_name') return contact.firstName;
        if (fieldId === 'last_name') return contact.lastName;
        if (fieldId === 'phone_number') return contact.phoneNumber;
        if (fieldId === 'postal_code') return contact.postalCode;
        
        // Final fallback for direct key match
        if(fieldId in contact) return contact[fieldId as keyof Contact];

        return undefined;
    };


    const matchRule = (contact: Contact, rule: any): boolean => {
        const contactValue = getContactValue(contact, rule.contactField);
        if (contactValue === null || contactValue === undefined) return false;
        const contactString = String(contactValue).trim().toLowerCase();
        const ruleString = String(rule.value).trim().toLowerCase();
        switch (rule.operator) {
            case 'equals': return contactString === ruleString;
            case 'starts_with': return contactString.startsWith(ruleString);
            case 'contains': return contactString.includes(ruleString);
            case 'is_not_empty': return contactString !== '';
            default: return false;
        }
    };

    const quotaStats = useMemo(() => {
        if (!campaign.quotaRules || campaign.quotaRules.length === 0) return [];

        const positiveQualIds = new Set(qualifications.filter(q => q.type === 'positive' && q.groupId === campaign.qualificationGroupId).map(q => q.id));
        const successfulCallsForCampaign = callHistory.filter(c => c.campaignId === campaign.id && c.qualificationId && positiveQualIds.has(c.qualificationId));
        
        return campaign.quotaRules.map(rule => {
            const totalMatchingContacts = campaign.contacts.filter(c => matchRule(c, rule));
            const totalFiches = totalMatchingContacts.length;
            const fichesTraitees = totalMatchingContacts.filter(c => c.status !== 'pending').length;
            
            const successfulContactsForCampaign = successfulCallsForCampaign.map(call => campaign.contacts.find(c => c.id === call.contactId)).filter((c): c is Contact => !!c);
            const quotaAtteint = successfulContactsForCampaign.filter(c => matchRule(c, rule)).length;
            
            const limite = rule.limit;
            const reste = Math.max(0, limite - quotaAtteint);

            return {
                id: rule.id,
                rule,
                totalFiches,
                fichesTraitees,
                quotaAtteint,
                reste,
                limite,
            };
        });
    }, [campaign, callHistory, qualifications]);
    
    const renderRule = (rule: any) => {
        const field = script?.pages.flatMap(p=>p.blocks).find(b=>b.fieldName === rule.contactField)?.name || rule.contactField;
        return `Si "${field}" est égal à "${rule.value}"`;
    };


    if (!campaign.quotaRules || campaign.quotaRules.length === 0) {
         return <div className="p-8 text-center text-slate-500">Aucune règle de quota n'a été configurée pour cette campagne.</div>
    }

    return (
        <div className="p-6">
            <h3 className="text-xl font-semibold text-slate-800 mb-4">Suivi des Quotas</h3>
             <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-100">
                        <tr>
                            <th className="px-4 py-2 text-left font-medium text-slate-500 uppercase">Règle de Quota</th>
                            <th className="px-4 py-2 text-left font-medium text-slate-500 uppercase">Total Fiches</th>
                            <th className="px-4 py-2 text-left font-medium text-slate-500 uppercase">Fiches Traitées</th>
                            <th className="px-4 py-2 text-left font-medium text-slate-500 uppercase">Quota Atteint</th>
                            <th className="px-4 py-2 text-left font-medium text-slate-500 uppercase">Reste</th>
                            <th className="px-4 py-2 text-left font-medium text-slate-500 uppercase">Limite Fixée</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                        {quotaStats.map(stat => (
                            <tr key={stat.id}>
                                <td className="px-4 py-3 font-medium text-slate-700">{renderRule(stat.rule)}</td>
                                <td className="px-4 py-3 text-slate-600 font-semibold">{stat.totalFiches}</td>
                                <td className="px-4 py-3 text-slate-600">{stat.fichesTraitees}</td>
                                <td className="px-4 py-3 text-slate-600 font-semibold">{stat.quotaAtteint}</td>
                                <td className="px-4 py-3 font-bold text-indigo-600">{stat.reste}</td>
                                <td className="px-4 py-3 text-slate-600">{stat.limite}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const CampaignDetailView: React.FC<CampaignDetailViewProps> = (props) => {
    const { campaign, script, onBack, onSaveCampaign, onUpdateContact, onDeleteContacts, callHistory, qualifications, qualificationGroups, savedScripts, users } = props;
    const [activeTab, setActiveTab] = useState<'contacts' | 'stats' | 'settings'>('stats');

    const renderContent = () => {
        switch (activeTab) {
            case 'contacts': return <ContactList contacts={campaign.contacts} />;
            case 'stats': return <CampaignStatsTab campaign={campaign} callHistory={callHistory} qualifications={qualifications} />;
            case 'settings': return <CampaignQuotaTab campaign={campaign} callHistory={callHistory} qualifications={qualifications} script={script}/>;
            default: return null;
        }
    };
    
    const TabButton: React.FC<{ tab: 'contacts' | 'stats' | 'settings', label: string, icon: React.FC<any> }> = ({ tab, label, icon: Icon }) => (
        <button onClick={() => setActiveTab(tab)} className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md ${activeTab === tab ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`}>
            <Icon className="w-5 h-5" />{label}
        </button>
    );

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <header>
                <button onClick={onBack} className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-2 mb-4">
                    <ArrowLeftIcon className="w-5 h-5" />
                    Retour à la liste des campagnes
                </button>
                <h1 className="text-4xl font-bold text-slate-900 tracking-tight">{campaign.name}</h1>
                <p className="mt-2 text-lg text-slate-600">{campaign.description}</p>
                {script && <p className="mt-1 text-sm text-slate-500">Script associé: <span className="font-semibold">{script.name}</span></p>}
            </header>

            <div className="bg-white rounded-lg shadow-sm border border-slate-200">
                <div className="p-2 border-b">
                    <nav className="flex space-x-2">
                       <TabButton tab="contacts" label={`Contacts (${campaign.contacts.length})`} icon={UserCircleIcon} />
                       <TabButton tab="stats" label="Statistiques" icon={ChartBarIcon} />
                       <TabButton tab="settings" label="Paramètres" icon={WrenchScrewdriverIcon} />
                    </nav>
                </div>
                <div className="bg-slate-50">
                    {renderContent()}
                </div>
            </div>
        </div>
    );
};


const ContactList: React.FC<{ contacts: Contact[] }> = ({ contacts }) => {
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    
    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSelectedIds(e.target.checked ? contacts.map(c => c.id) : []);
    };

    const handleSelectOne = (id: string, isChecked: boolean) => {
        setSelectedIds(prev => isChecked ? [...prev, id] : prev.filter(selectedId => selectedId !== id));
    };

    return (
        <div>
            <div className="p-4 flex justify-between items-center bg-slate-50 border-b">
                 <h3 className="text-lg font-semibold text-slate-800">Liste des Contacts ({contacts.length})</h3>
                 <button disabled={selectedIds.length === 0} className="text-sm text-red-600 font-semibold inline-flex items-center gap-1 disabled:text-slate-400 disabled:cursor-not-allowed">
                     <TrashIcon className="w-4 h-4" /> Supprimer la sélection ({selectedIds.length})
                </button>
            </div>
             <div className="overflow-x-auto max-h-[60vh]">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-100 sticky top-0">
                        <tr>
                            <th className="px-4 py-2"><input type="checkbox" onChange={handleSelectAll} checked={selectedIds.length === contacts.length && contacts.length > 0} /></th>
                            <th className="px-4 py-2 text-left font-medium text-slate-500 uppercase">Prénom</th>
                            <th className="px-4 py-2 text-left font-medium text-slate-500 uppercase">Nom</th>
                            <th className="px-4 py-2 text-left font-medium text-slate-500 uppercase">Téléphone</th>
                            <th className="px-4 py-2 text-left font-medium text-slate-500 uppercase">Code Postal</th>
                            <th className="px-4 py-2 text-left font-medium text-slate-500 uppercase">Statut</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                        {contacts.map(contact => (
                            <tr key={contact.id}>
                                <td className="px-4 py-2"><input type="checkbox" checked={selectedIds.includes(contact.id)} onChange={e => handleSelectOne(contact.id, e.target.checked)} /></td>
                                <td className="px-4 py-2">{contact.firstName}</td>
                                <td className="px-4 py-2">{contact.lastName}</td>
                                <td className="px-4 py-2 font-mono">{contact.phoneNumber}</td>
                                <td className="px-4 py-2">{contact.postalCode}</td>
                                <td className="px-4 py-2">
                                    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                                        contact.status === 'pending' ? 'bg-blue-100 text-blue-800' : 
                                        contact.status === 'called' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
                                    }`}>
                                        {contact.status}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                 {contacts.length === 0 && <p className="text-center py-8 text-slate-500">Aucun contact dans cette campagne.</p>}
            </div>
        </div>
    );
};

export default CampaignDetailView;