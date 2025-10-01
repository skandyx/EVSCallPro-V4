import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import type { Campaign, SavedScript, Contact, CallHistoryRecord, Qualification, User, ContactNote, UserGroup, QualificationGroup } from '../types.ts';
import { ArrowLeftIcon, UsersIcon, ChartBarIcon, Cog6ToothIcon, EditIcon, TrashIcon, InformationCircleIcon } from './Icons';
import ContactHistoryModal from './ContactHistoryModal.tsx';

// Déclaration pour Chart.js via CDN
declare var Chart: any;

interface CampaignDetailViewProps {
    campaign: Campaign;
    script: SavedScript | null;
    onBack: () => void;
    onSaveCampaign: (campaign: Campaign) => void;
    onUpdateContact: (contact: Contact) => void;
    onDeleteContacts: (contactIds: string[]) => void;
    callHistory: CallHistoryRecord[];
    qualifications: Qualification[];
    users: User[];
    contactNotes: ContactNote[];
    qualificationGroups: QualificationGroup[];
    savedScripts: SavedScript[];
    userGroups: UserGroup[];
    currentUser: User;
}

type DetailTab = 'contacts' | 'dashboard' | 'settings';

const KpiCard: React.FC<{ title: string; value: string | number; }> = ({ title, value }) => (
    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
        <p className="text-sm text-slate-500">{title}</p>
        <p className="text-3xl font-bold text-slate-900">{value}</p>
    </div>
);

const ChartComponent: React.FC<{ type: string; data: any; options: any; }> = ({ type, data, options }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const chartRef = useRef<any>(null);

    useEffect(() => {
        if (canvasRef.current) {
            if (chartRef.current) {
                chartRef.current.destroy();
            }
            const ctx = canvasRef.current.getContext('2d');
            if (ctx) {
                chartRef.current = new Chart(ctx, {
                    type,
                    data,
                    options,
                });
            }
        }
        return () => {
            if (chartRef.current) {
                chartRef.current.destroy();
            }
        };
    }, [type, data, options]);

    return <canvas ref={canvasRef}></canvas>;
};

const formatDuration = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const CampaignDetailView: React.FC<CampaignDetailViewProps> = (props) => {
    const { campaign, onBack, callHistory, qualifications, users, script, onDeleteContacts, contactNotes, currentUser } = props;
    const [activeTab, setActiveTab] = useState<DetailTab>('dashboard');
    
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
    
    const [historyModal, setHistoryModal] = useState<{ isOpen: boolean, contact: Contact | null }>({ isOpen: false, contact: null });

    const canDelete = currentUser.role === 'Administrateur' || currentUser.role === 'SuperAdmin';

    const campaignCallHistory = useMemo(() => callHistory.filter(c => c.campaignId === campaign.id), [callHistory, campaign.id]);

    const campaignStats = useMemo(() => {
        const totalContacts = campaign.contacts.length;
        if (totalContacts === 0) return { total: 0, processed: 0, pending: 0, completionRate: 0, totalCalls: 0, contacted: 0, contactRate: 0, positive: 0, conversionRate: 0, hitRate: 0, avgDuration: 0 };
        
        const processedContacts = campaign.contacts.filter(c => c.status !== 'pending').length;
        const pendingContacts = totalContacts - processedContacts;
        const completionRate = (processedContacts / totalContacts) * 100;
        
        const totalCalls = campaignCallHistory.length;
        const contactedCalls = campaignCallHistory.filter(call => {
             const qual = qualifications.find(q => q.id === call.qualificationId);
             // Consider 'contacted' if it's not a technical failure like 'Faux numéro'
             return qual && qual.id !== 'std-91';
        }).length;
        
        const contactRate = totalCalls > 0 ? (contactedCalls / totalCalls) * 100 : 0;
        
        const positiveCalls = campaignCallHistory.filter(call => {
            const qual = qualifications.find(q => q.id === call.qualificationId);
            return qual?.type === 'positive';
        }).length;
        
        const conversionRate = contactedCalls > 0 ? (positiveCalls / contactedCalls) * 100 : 0;
        const hitRate = totalContacts > 0 ? (positiveCalls / totalContacts) * 100 : 0;
        
        const totalDuration = campaignCallHistory.reduce((acc, call) => acc + call.duration, 0);
        const avgDuration = totalCalls > 0 ? totalDuration / totalCalls : 0;

        return {
            total: totalContacts, processed: processedContacts, pending: pendingContacts,
            completionRate: completionRate,
            totalCalls: totalCalls,
            contacted: contactedCalls,
            contactRate: contactRate,
            positive: positiveCalls,
            conversionRate: conversionRate,
            hitRate: hitRate,
            avgDuration: avgDuration
        };
    }, [campaign, campaignCallHistory, qualifications]);
    
    const qualificationDistribution = useMemo(() => {
        const counts = { positive: 0, neutral: 0, negative: 0 };
        campaignCallHistory.forEach(call => {
            const qual = qualifications.find(q => q.id === call.qualificationId);
            if(qual && counts[qual.type] !== undefined) {
                counts[qual.type]++;
            }
        });
        return {
            labels: ['Positives', 'Neutres', 'Négatives'],
            datasets: [{
                data: [counts.positive, counts.neutral, counts.negative],
                backgroundColor: ['#10b981', '#64748b', '#ef4444'],
            }]
        };
    }, [campaignCallHistory, qualifications]);

    const callsByHour = useMemo(() => {
        const hours = Array(24).fill(0);
        campaignCallHistory.forEach(call => {
            const qual = qualifications.find(q => q.id === call.qualificationId);
            if (qual?.type === 'positive') {
                const hour = new Date(call.timestamp).getHours();
                hours[hour]++;
            }
        });
        return {
            labels: Array.from({length: 24}, (_, i) => `${i}h`),
            datasets: [{
                label: 'Conversions',
                data: hours,
                backgroundColor: 'rgba(79, 70, 229, 0.7)',
            }]
        };
    }, [campaignCallHistory, qualifications]);

    const agentPerformance = useMemo(() => {
        const perf: {[key: string]: { name: string, calls: number, conversions: number }} = {};
        campaignCallHistory.forEach(call => {
            if (!perf[call.agentId]) {
                const user = users.find(u => u.id === call.agentId);
                perf[call.agentId] = { name: user ? `${user.firstName} ${user.lastName}` : 'Inconnu', calls: 0, conversions: 0 };
            }
            perf[call.agentId].calls++;
            const qual = qualifications.find(q => q.id === call.qualificationId);
            if(qual?.type === 'positive') perf[call.agentId].conversions++;
        });
        return Object.values(perf).sort((a,b) => b.conversions - a.conversions || b.calls - a.calls);
    }, [campaignCallHistory, users, qualifications]);

    const columnsToDisplay = useMemo(() => {
        const baseColumns = [
            { fieldName: 'first_name', name: 'Prénom', isStandard: true },
            { fieldName: 'last_name', name: 'Nom', isStandard: true },
            { fieldName: 'phone_number', name: 'Téléphone', isStandard: true },
            { fieldName: 'postal_code', name: 'Code Postal', isStandard: true },
        ];
        
        if (!script) {
            return baseColumns;
        }

        const visibleStandardBlocks = script.pages
            .flatMap(p => p.blocks)
            .filter(b => b.isStandard && b.isVisible !== false);
        
        const visibleStandardFieldNames = new Set(visibleStandardBlocks.map(b => b.fieldName));
        const finalStandardColumns = baseColumns
            .filter(c => visibleStandardFieldNames.has(c.fieldName))
            .map(c => {
                const scriptBlock = visibleStandardBlocks.find(b => b.fieldName === c.fieldName);
                return { ...c, name: scriptBlock?.name || c.name }; // Use script name if available
            });

        const customColumns = script.pages.flatMap(p => p.blocks)
            .filter(b => !b.isStandard && ['input', 'textarea', 'email', 'phone', 'date', 'time', 'radio', 'checkbox', 'dropdown'].includes(b.type))
            .map(b => ({ fieldName: b.fieldName, name: b.name, isStandard: false }));

        const uniqueCustomColumns = customColumns.filter((v, i, a) => 
            a.findIndex(t => (t.fieldName === v.fieldName)) === i &&
            !finalStandardColumns.some(sc => sc.fieldName === v.fieldName)
        );
        
        return [ ...finalStandardColumns, ...uniqueCustomColumns ];
    }, [script]);

    const filteredContacts = useMemo(() => {
        return campaign.contacts.filter(contact => {
            if (!searchTerm) return true;
            const term = searchTerm.toLowerCase();
            return Object.values(contact).some(val => String(val).toLowerCase().includes(term)) ||
                   (contact.customFields && Object.values(contact.customFields).some(val => String(val).toLowerCase().includes(term)));
        });
    }, [campaign.contacts, searchTerm]);

    const contactsPerPage = 20;
    const paginatedContacts = useMemo(() => {
        const start = (currentPage - 1) * contactsPerPage;
        return filteredContacts.slice(start, start + contactsPerPage);
    }, [filteredContacts, currentPage]);
    const totalPages = Math.ceil(filteredContacts.length / contactsPerPage);

    const handleSelectContact = (contactId: string, isSelected: boolean) => {
        setSelectedContactIds(prev => isSelected ? [...prev, contactId] : prev.filter(id => id !== contactId));
    };

    const handleSelectAllOnPage = (e: React.ChangeEvent<HTMLInputElement>) => {
        const pageIds = new Set(paginatedContacts.map(c => c.id));
        if (e.target.checked) {
            setSelectedContactIds(prev => [...new Set([...prev, ...pageIds])]);
        } else {
            setSelectedContactIds(prev => prev.filter(id => !pageIds.has(id)));
        }
    };

    const isAllOnPageSelected = paginatedContacts.length > 0 && paginatedContacts.every(c => selectedContactIds.includes(c.id));

    const handleDeleteSelected = () => {
        if (selectedContactIds.length === 0) return;
        if (window.confirm(`Êtes-vous sûr de vouloir supprimer ${selectedContactIds.length} contact(s) ? Cette action est irréversible.`)) {
            onDeleteContacts(selectedContactIds);
            setSelectedContactIds([]);
        }
    };

    const TabButton: React.FC<{ tab: DetailTab; label: string; icon: React.FC<any> }> = ({ tab, label, icon: Icon }) => (
        <button onClick={() => setActiveTab(tab)} className={`flex items-center gap-2 whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm transition-colors ${activeTab === tab ? 'border-primary text-link' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}>
            <Icon className="w-5 h-5" /> {label}
        </button>
    );

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            {historyModal.isOpen && historyModal.contact && (
                <ContactHistoryModal isOpen={true} onClose={() => setHistoryModal({ isOpen: false, contact: null })} contact={historyModal.contact} users={users} qualifications={qualifications} />
            )}
            <header>
                <button onClick={onBack} className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-800 mb-2"><ArrowLeftIcon className="w-5 h-5"/> Retour aux campagnes</button>
                <h1 className="text-4xl font-bold text-slate-900 tracking-tight">{campaign.name}</h1>
                <p className="mt-1 text-lg text-slate-600">{campaign.description || `Script associé: ${script?.name || 'Aucun'}`}</p>
            </header>

            <div className="bg-white rounded-lg shadow-sm border border-slate-200">
                <div className="border-b border-slate-200"><nav className="-mb-px flex space-x-4 px-6">
                    <TabButton tab="contacts" label={`Contacts (${campaign.contacts.length})`} icon={UsersIcon} />
                    <TabButton tab="dashboard" label="Statistiques" icon={ChartBarIcon} />
                    <TabButton tab="settings" label="Paramètres" icon={Cog6ToothIcon} />
                </nav></div>
                <div className="p-6">
                    {activeTab === 'contacts' && (
                        <div>
                            <div className="flex justify-between items-center mb-4">
                                <input type="search" placeholder="Rechercher un contact..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full max-w-sm p-2 border border-slate-300 rounded-md"/>
                                {canDelete && selectedContactIds.length > 0 && <button onClick={handleDeleteSelected} className="bg-red-100 text-red-700 font-bold py-2 px-4 rounded-lg inline-flex items-center gap-2"><TrashIcon className="w-5 h-5"/>Supprimer la sélection ({selectedContactIds.length})</button>}
                            </div>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-slate-200"><thead className="bg-slate-50"><tr>
                                    <th className="p-4 w-4"><input type="checkbox" checked={isAllOnPageSelected} onChange={handleSelectAllOnPage} className="h-4 w-4 rounded" /></th>
                                    {columnsToDisplay.map(col => <th key={col.fieldName} className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">{col.name}</th>)}
                                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Statut</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Dernière Qualification</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Dernière Remarque</th>
                                </tr></thead>
                                <tbody className="bg-white divide-y divide-slate-200 text-sm">
                                    {paginatedContacts.map(contact => {
                                        const lastCall = [...callHistory].filter(c => c.contactId === contact.id).sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
                                        const lastNote = [...contactNotes].filter(n => n.contactId === contact.id).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
                                        return (
                                        <tr key={contact.id} onClick={() => setHistoryModal({ isOpen: true, contact })} className={`cursor-pointer hover:bg-slate-50 ${selectedContactIds.includes(contact.id) ? 'bg-indigo-50' : ''}`}>
                                            <td className="p-4 w-4" onClick={e => e.stopPropagation()}><input type="checkbox" checked={selectedContactIds.includes(contact.id)} onChange={e => handleSelectContact(contact.id, e.target.checked)} className="h-4 w-4 rounded" /></td>
                                            {columnsToDisplay.map(col => {
                                                let value = '';
                                                if (col.isStandard) {
                                                    const keyMap = { 'first_name': 'firstName', 'last_name': 'lastName', 'phone_number': 'phoneNumber', 'postal_code': 'postalCode'};
                                                    value = (contact as any)[keyMap[col.fieldName as keyof typeof keyMap]] || '';
                                                } else if (contact.customFields) {
                                                    value = contact.customFields[col.fieldName] || '';
                                                }
                                                return <td key={col.fieldName} className="px-4 py-3 font-mono truncate max-w-xs" title={value}>{value}</td>
                                            })}
                                            <td className="px-4 py-3"><span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${contact.status === 'pending' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-800'}`}>{contact.status}</span></td>
                                            <td className="px-4 py-3">{lastCall ? props.qualifications.find(q => q.id === lastCall.qualificationId)?.description : 'N/A'}</td>
                                            <td className="px-4 py-3 truncate max-w-xs" title={lastNote?.note}>{lastNote?.note || 'N/A'}</td>
                                        </tr>
                                    )})}
                                </tbody>
                                </table>
                                {filteredContacts.length === 0 && <p className="text-center py-8 text-slate-500">Aucun contact trouvé.</p>}
                            </div>
                            {totalPages > 1 && <div className="flex justify-between items-center mt-4 text-sm">
                                <p className="text-slate-600">Page {currentPage} sur {totalPages}</p>
                                <div className="flex gap-2">
                                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1 border rounded-md disabled:opacity-50">Précédent</button>
                                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-3 py-1 border rounded-md disabled:opacity-50">Suivant</button>
                                </div>
                            </div>}
                        </div>
                    )}
                     {activeTab === 'dashboard' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <KpiCard title="Taux d'achèvement" value={`${campaignStats.completionRate.toFixed(1)}%`} />
                                <KpiCard title="Taux de contact" value={`${campaignStats.contactRate.toFixed(1)}%`} />
                                <KpiCard title="Taux de conversion" value={`${campaignStats.conversionRate.toFixed(1)}%`} />
                                <KpiCard title="DMC" value={formatDuration(campaignStats.avgDuration)} />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-slate-800 mb-2">Progression du Fichier</h3>
                                <div className="w-full bg-slate-200 rounded-full h-4">
                                    <div className="bg-indigo-600 h-4 rounded-full text-center text-white text-xs font-bold" style={{ width: `${campaignStats.completionRate}%` }}>
                                        {campaignStats.completionRate.toFixed(0)}%
                                    </div>
                                </div>
                                <div className="flex justify-between text-sm mt-1">
                                    <span>Traitées: {campaignStats.processed}</span>
                                    <span>Restantes: {campaignStats.pending}</span>
                                </div>
                            </div>
                            {campaign.quotaRules.length > 0 && (
                                <div>
                                    <h3 className="text-lg font-semibold text-slate-800 mb-2">Suivi des Quotas</h3>
                                    <div className="space-y-3">
                                        {campaign.quotaRules.map(rule => (
                                            <div key={rule.id}>
                                                <div className="flex justify-between text-sm font-medium mb-1">
                                                    <span>Quota: {rule.contactField} commence par "{rule.value}"</span>
                                                    <span>Réalisé: {rule.currentCount} / {rule.limit}</span>
                                                </div>
                                                <div className="w-full bg-slate-200 rounded-full h-2.5">
                                                    <div className="bg-green-600 h-2.5 rounded-full" style={{ width: `${rule.limit > 0 ? (rule.currentCount / rule.limit) * 100 : 0}%` }}></div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4 border-t">
                                <div>
                                    <h3 className="text-lg font-semibold text-slate-800 mb-2">Répartition des Qualifications</h3>
                                    <div className="h-64"><ChartComponent type="doughnut" data={qualificationDistribution} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' }} }} /></div>
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-slate-800 mb-2">Heures de Succès (Conversions)</h3>
                                    <div className="h-64"><ChartComponent type="bar" data={callsByHour} options={{ responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }} /></div>
                                </div>
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-slate-800 mb-2">Performance par Agent</h3>
                                <div className="overflow-x-auto max-h-60">
                                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                                        <thead className="bg-slate-50 sticky top-0"><tr>
                                            <th className="px-4 py-2 text-left font-medium text-slate-500 uppercase">Agent</th>
                                            <th className="px-4 py-2 text-left font-medium text-slate-500 uppercase">Appels Traités</th>
                                            <th className="px-4 py-2 text-left font-medium text-slate-500 uppercase">Conversions</th>
                                        </tr></thead>
                                        <tbody className="bg-white divide-y divide-slate-200">
                                            {agentPerformance.map(agent => (
                                                <tr key={agent.name}>
                                                    <td className="px-4 py-2 font-medium">{agent.name}</td>
                                                    <td className="px-4 py-2">{agent.calls}</td>
                                                    <td className="px-4 py-2">{agent.conversions}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CampaignDetailView;