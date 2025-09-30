
import React, { useState, useMemo, useCallback } from 'react';
import type { Campaign, SavedScript, Contact, CallHistoryRecord, Qualification, User, ContactNote } from '../types';
import { ArrowLeftIcon, UsersIcon, ChartBarIcon, Cog6ToothIcon, EditIcon, TrashIcon, InformationCircleIcon } from './Icons';
import ContactHistoryModal from './ContactHistoryModal.tsx';

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
}

type DetailTab = 'dashboard' | 'contacts';

const findEntityName = (id: string | null, collection: Array<{id: string, name?: string, firstName?: string, lastName?: string, description?: string}>) => {
    if (!id) return 'N/A';
    const item = collection.find(i => i.id === id);
    return item?.name || `${item?.firstName} ${item?.lastName}` || item?.description || 'Inconnu';
};

const formatDuration = (seconds: number, type: 'full' | 'short' = 'short') => {
    if(isNaN(seconds) || seconds < 0) return type === 'full' ? '0h 0m 0s' : '00:00:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.round(seconds % 60);
    if(type === 'full') return `${h}h ${m}m ${s}s`;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const KpiCard: React.FC<{ title: string; value: string | number; }> = ({ title, value }) => (
    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
        <p className="text-sm text-slate-500">{title}</p>
        <p className="text-3xl font-bold text-slate-900">{value}</p>
    </div>
);

const CampaignDetailView: React.FC<CampaignDetailViewProps> = (props) => {
    const { campaign, onBack, callHistory, qualifications, users, contactNotes, onDeleteContacts } = props;
    const [activeTab, setActiveTab] = useState<DetailTab>('dashboard');
    
    // State for Contacts tab
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
    
    // State for History Modal
    const [historyModal, setHistoryModal] = useState<{ isOpen: boolean, contact: Contact | null }>({ isOpen: false, contact: null });

    const campaignCallHistory = useMemo(() => callHistory.filter(c => c.campaignId === campaign.id), [callHistory, campaign.id]);

    const kpis = useMemo(() => {
        const totalContacts = campaign.contacts.length;
        const remaining = campaign.contacts.filter(c => c.status === 'pending').length;
        const processed = totalContacts - remaining;
        const completionRate = totalContacts > 0 ? (processed / totalContacts) * 100 : 0;
        
        const positiveQuals = campaignCallHistory.filter(call => {
            const qual = qualifications.find(q => q.id === call.qualificationId);
            return qual?.type === 'positive';
        }).length;
        
        const successRate = processed > 0 ? (positiveQuals / processed) * 100 : 0;

        return {
            totalContacts,
            remaining,
            completionRate: `${completionRate.toFixed(1)}%`,
            callsMade: campaignCallHistory.length,
            successRate: `${successRate.toFixed(1)}%`,
        };
    }, [campaign, campaignCallHistory, qualifications]);
    
    const filteredContacts = useMemo(() => {
        return campaign.contacts.filter(contact => {
            if (!searchTerm) return true;
            const term = searchTerm.toLowerCase();
            return (
                contact.firstName.toLowerCase().includes(term) ||
                contact.lastName.toLowerCase().includes(term) ||
                contact.phoneNumber.includes(term) ||
                contact.postalCode.includes(term)
            );
        });
    }, [campaign.contacts, searchTerm]);
    
    const contactsPerPage = 20;
    const paginatedContacts = useMemo(() => {
        const start = (currentPage - 1) * contactsPerPage;
        return filteredContacts.slice(start, start + contactsPerPage);
    }, [filteredContacts, currentPage]);
    const totalPages = Math.ceil(filteredContacts.length / contactsPerPage);

    const handleSelectContact = (contactId: string, isSelected: boolean) => {
        if (isSelected) {
            setSelectedContactIds(prev => [...prev, contactId]);
        } else {
            setSelectedContactIds(prev => prev.filter(id => id !== contactId));
        }
    };
    
    const handleSelectAllOnPage = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            const pageIds = paginatedContacts.map(c => c.id);
            setSelectedContactIds(prev => [...new Set([...prev, ...pageIds])]);
        } else {
            const pageIdsSet = new Set(paginatedContacts.map(c => c.id));
            setSelectedContactIds(prev => prev.filter(id => !pageIdsSet.has(id)));
        }
    };
    
    const isAllOnPageSelected = paginatedContacts.length > 0 && paginatedContacts.every(c => selectedContactIds.includes(c.id));

    const handleDeleteSelected = () => {
        if (selectedContactIds.length === 0) return;
        if (window.confirm(`Êtes-vous sûr de vouloir supprimer ${selectedContactIds.length} contact(s) ?`)) {
            onDeleteContacts(selectedContactIds);
            setSelectedContactIds([]);
        }
    };

    const TabButton: React.FC<{ tab: DetailTab; label: string; icon: React.FC<any> }> = ({ tab, label, icon: Icon }) => (
        <button
            onClick={() => setActiveTab(tab)}
            className={`flex items-center gap-2 whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm transition-colors ${
              activeTab === tab
                ? 'border-primary text-link'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
        >
            <Icon className="w-5 h-5" />
            {label}
        </button>
    );

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            {historyModal.isOpen && historyModal.contact && (
                <ContactHistoryModal
                    isOpen={true}
                    onClose={() => setHistoryModal({ isOpen: false, contact: null })}
                    contact={historyModal.contact}
                    callHistory={callHistory}
                    users={users}
                    qualifications={qualifications}
                />
            )}
            <header>
                <button onClick={onBack} className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-800 mb-2">
                    <ArrowLeftIcon className="w-5 h-5"/> Retour aux campagnes
                </button>
                <h1 className="text-4xl font-bold text-slate-900 tracking-tight">{campaign.name}</h1>
                <p className="mt-1 text-lg text-slate-600">{campaign.description}</p>
            </header>

            <div className="bg-white rounded-lg shadow-sm border border-slate-200">
                <div className="border-b border-slate-200">
                    <nav className="-mb-px flex space-x-4 px-6">
                        <TabButton tab="dashboard" label="Tableau de bord" icon={ChartBarIcon} />
                        <TabButton tab="contacts" label="Contacts" icon={UsersIcon} />
                        {/* <TabButton tab="settings" label="Paramètres" icon={Cog6ToothIcon} /> */}
                    </nav>
                </div>
                
                <div className="p-6">
                    {activeTab === 'dashboard' && (
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            <KpiCard title="Total Contacts" value={kpis.totalContacts} />
                            <KpiCard title="Contacts Restants" value={kpis.remaining} />
                            <KpiCard title="Taux d'achèvement" value={kpis.completionRate} />
                            <KpiCard title="Appels Effectués" value={kpis.callsMade} />
                            <KpiCard title="Taux de Succès" value={kpis.successRate} />
                        </div>
                    )}
                    {activeTab === 'contacts' && (
                         <div>
                            <div className="flex justify-between items-center mb-4">
                                <input
                                    type="search"
                                    placeholder="Rechercher un contact..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="w-full max-w-sm p-2 border border-slate-300 rounded-md"
                                />
                                 {selectedContactIds.length > 0 && (
                                    <button
                                        onClick={handleDeleteSelected}
                                        className="bg-red-100 text-red-700 font-bold py-2 px-4 rounded-lg inline-flex items-center gap-2"
                                    >
                                        <TrashIcon className="w-5 h-5"/>
                                        Supprimer ({selectedContactIds.length})
                                    </button>
                                )}
                            </div>
                             <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-slate-200">
                                    <thead className="bg-slate-50"><tr>
                                        <th className="p-4 w-4"><input type="checkbox" checked={isAllOnPageSelected} onChange={handleSelectAllOnPage} className="h-4 w-4 rounded" /></th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Nom</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Téléphone</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Code Postal</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Statut</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Historique</th>
                                    </tr></thead>
                                    <tbody className="bg-white divide-y divide-slate-200 text-sm">
                                        {paginatedContacts.map(contact => (
                                            <tr key={contact.id} className={selectedContactIds.includes(contact.id) ? 'bg-indigo-50' : ''}>
                                                <td className="p-4 w-4"><input type="checkbox" checked={selectedContactIds.includes(contact.id)} onChange={e => handleSelectContact(contact.id, e.target.checked)} className="h-4 w-4 rounded" /></td>
                                                <td className="px-4 py-3 font-medium">{contact.firstName} {contact.lastName}</td>
                                                <td className="px-4 py-3 font-mono">{contact.phoneNumber}</td>
                                                <td className="px-4 py-3">{contact.postalCode}</td>
                                                <td className="px-4 py-3"><span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${contact.status === 'pending' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-800'}`}>{contact.status}</span></td>
                                                <td className="px-4 py-3">
                                                    <button
                                                        onClick={() => setHistoryModal({ isOpen: true, contact })}
                                                        className="text-link hover:underline"
                                                    >
                                                        Voir
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {filteredContacts.length === 0 && <p className="text-center py-8 text-slate-500">Aucun contact trouvé.</p>}
                            </div>
                            <div className="flex justify-between items-center mt-4 text-sm">
                                <p className="text-slate-600">Page {currentPage} sur {totalPages}</p>
                                <div className="flex gap-2">
                                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1 border rounded-md disabled:opacity-50">Précédent</button>
                                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-3 py-1 border rounded-md disabled:opacity-50">Suivant</button>
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
