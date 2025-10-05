import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import type { Campaign, SavedScript, Contact, CallHistoryRecord, Qualification, User, ContactNote, UserGroup, QualificationGroup } from '../types.ts';
import { ArrowLeftIcon, UsersIcon, ChartBarIcon, Cog6ToothIcon, EditIcon, TrashIcon, InformationCircleIcon, ChevronDownIcon, XMarkIcon, ArrowDownTrayIcon } from './Icons.tsx';
import ContactHistoryModal from './ContactHistoryModal.tsx';
import { useI18n } from '../src/i18n/index.tsx';

// Déclaration pour Chart.js via CDN
declare var Chart: any;
declare var Papa: any;

interface CampaignDetailViewProps {
    campaign: Campaign;
    script: SavedScript | null;
    onBack: () => void;
    onSaveCampaign: (campaign: Campaign) => void;
    onUpdateContact: (contact: Contact) => void;
    onDeleteContacts: (contactIds: string[]) => void;
    onRecycleContacts: (campaignId: string, qualificationId: string) => void;
    callHistory: CallHistoryRecord[];
    qualifications: Qualification[];
    users: User[];
    contactNotes: ContactNote[];
    qualificationGroups: QualificationGroup[];
    savedScripts: SavedScript[];
    userGroups: UserGroup[];
    currentUser: User;
}

type DetailTab = 'contacts' | 'dashboard' | 'dashboard2' | 'settings';
type ContactSortKeys = 'firstName' | 'lastName' | 'phoneNumber' | 'postalCode' | 'status';

const formatDuration = (seconds: number) => {
    if(isNaN(seconds) || seconds < 0) return '0m 0s';
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m}m ${s}s`;
};

const CampaignDetailView: React.FC<CampaignDetailViewProps> = (props) => {
    const { campaign, onBack, callHistory, qualifications, users, script, onDeleteContacts, onRecycleContacts, contactNotes, currentUser } = props;
    const { t } = useI18n();
    const [activeTab, setActiveTab] = useState<DetailTab>('contacts');
    
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
    const [contactSortConfig, setContactSortConfig] = useState<{ key: ContactSortKeys; direction: 'ascending' | 'descending' }>({ key: 'lastName', direction: 'ascending' });
    
    const [historyModal, setHistoryModal] = useState<{ isOpen: boolean, contact: Contact | null }>({ isOpen: false, contact: null });

    const canDelete = currentUser.role === 'Administrateur' || currentUser.role === 'SuperAdmin';

    const campaignCallHistory = useMemo(() => callHistory.filter(c => c.campaignId === campaign.id), [callHistory, campaign.id]);
    
    const handleExport = () => {
        // Group calls by contactId to find the last one for each contact
        const callsByContact = campaignCallHistory.reduce((acc, call) => {
            if (!acc[call.contactId] || new Date(call.timestamp) > new Date(acc[call.contactId].timestamp)) {
                acc[call.contactId] = call;
            }
            return acc;
        }, {} as Record<string, CallHistoryRecord>);

        const processedContactsData = Object.values(callsByContact).map(lastCall => {
            const agent = users.find(u => u.id === lastCall.agentId);
            const qual = qualifications.find(q => q.id === lastCall.qualificationId);
            const contact = campaign.contacts.find(c => c.id === lastCall.contactId);

            return {
                'Date de traitement': new Date(lastCall.timestamp).toLocaleString('fr-FR'),
                'ID Agent': agent ? agent.loginId : 'N/A',
                'Nom Agent': agent ? `${agent.firstName} ${agent.lastName}` : 'N/A',
                'Numéro de téléphone': contact ? contact.phoneNumber : 'N/A',
                'Durée': lastCall.duration, // in seconds
                'Code Qualif': qual ? qual.code : 'N/A',
                'Description Qualif': qual ? qual.description : 'N/A'
            };
        });

        if (processedContactsData.length === 0) {
            alert(t('campaignDetail.noDataToExport'));
            return;
        }

        // Sort data by date descending
        processedContactsData.sort((a, b) => {
             const dateA = new Date(a['Date de traitement'].split(' ')[0].split('/').reverse().join('-') + 'T' + a['Date de traitement'].split(' ')[1]).getTime();
             const dateB = new Date(b['Date de traitement'].split(' ')[0].split('/').reverse().join('-') + 'T' + b['Date de traitement'].split(' ')[1]).getTime();
            return dateB - dateA;
        });
        
        const csv = Papa.unparse(processedContactsData);
        const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `export_campagne_${campaign.name.replace(/\s/g, '_')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const filteredContacts = useMemo(() => {
        return campaign.contacts.filter(contact => {
            if (!searchTerm) return true;
            const term = searchTerm.toLowerCase();
            return Object.values(contact).some(val => String(val).toLowerCase().includes(term)) ||
                   (contact.customFields && Object.values(contact.customFields).some(val => String(val).toLowerCase().includes(term)));
        });
    }, [campaign.contacts, searchTerm]);

    const sortedAndFilteredContacts = useMemo(() => {
        return [...filteredContacts].sort((a, b) => {
            const key = contactSortConfig.key;
            const aValue = a[key] || '';
            const bValue = b[key] || '';
            const comparison = String(aValue).localeCompare(String(bValue), undefined, { numeric: true });
            return contactSortConfig.direction === 'ascending' ? comparison : -comparison;
        });
    }, [filteredContacts, contactSortConfig]);

    const contactsPerPage = 20;
    const paginatedContacts = useMemo(() => {
        const start = (currentPage - 1) * contactsPerPage;
        return sortedAndFilteredContacts.slice(start, start + contactsPerPage);
    }, [sortedAndFilteredContacts, currentPage]);
    const totalPages = Math.ceil(sortedAndFilteredContacts.length / contactsPerPage);

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
    
    const requestSort = (key: ContactSortKeys) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (contactSortConfig.key === key && contactSortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setContactSortConfig({ key, direction });
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
        <button onClick={() => setActiveTab(tab)} className={`flex items-center gap-2 whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm transition-colors ${activeTab === tab ? 'border-primary text-link' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'}`}>
            <Icon className="w-5 h-5" /> {label}
        </button>
    );
    
     const SortableHeader: React.FC<{ sortKey: ContactSortKeys; label: string }> = ({ sortKey, label }) => (
        <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
            <button onClick={() => requestSort(sortKey)} className="group inline-flex items-center gap-1">
                {label}
                <span className="opacity-0 group-hover:opacity-100"><ChevronDownIcon className={`w-4 h-4 transition-transform ${contactSortConfig.key === sortKey && contactSortConfig.direction === 'descending' ? 'rotate-180' : ''}`}/></span>
            </button>
        </th>
    );

    return (
        <div className="space-y-6">
            {historyModal.isOpen && historyModal.contact && (
                <ContactHistoryModal isOpen={true} onClose={() => setHistoryModal({ isOpen: false, contact: null })} contact={historyModal.contact} users={users} qualifications={qualifications} />
            )}
            <header>
                <button onClick={onBack} className="flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100 mb-2"><ArrowLeftIcon className="w-5 h-5"/> {t('campaignDetail.backToCampaigns')}</button>
                <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">{campaign.name}</h1>
                <p className="mt-1 text-lg text-slate-600 dark:text-slate-400">{campaign.description || t('campaignDetail.associatedScript', { scriptName: script?.name || t('common.none')})}</p>
            </header>

            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                <div className="border-b border-slate-200 dark:border-slate-700"><nav className="-mb-px flex space-x-4 px-6">
                    <TabButton tab="contacts" label={t('campaignDetail.tabs.contacts', { count: campaign.contacts.length })} icon={UsersIcon} />
                    <TabButton tab="dashboard" label={t('campaignDetail.tabs.dashboard')} icon={ChartBarIcon} />
                    <TabButton tab="dashboard2" label="Dashboard2" icon={ChartBarIcon} />
                    <TabButton tab="settings" label={t('campaignDetail.tabs.settings')} icon={Cog6ToothIcon} />
                </nav></div>
                <div className="p-6">
                    {activeTab === 'contacts' && (
                        <div>
                            <div className="flex justify-between items-center mb-4">
                                <input type="search" placeholder={t('campaignDetail.contacts.searchPlaceholder')} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full max-w-sm p-2 border border-slate-300 rounded-md dark:bg-slate-900 dark:border-slate-600 dark:text-slate-200"/>
                                <div className="flex items-center gap-2">
                                    {canDelete && selectedContactIds.length > 0 && <button onClick={handleDeleteSelected} className="bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 font-bold py-2 px-4 rounded-lg inline-flex items-center gap-2"><TrashIcon className="w-5 h-5"/>{t('campaignDetail.contacts.deleteSelection', { count: selectedContactIds.length })}</button>}
                                    <button onClick={handleExport} className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded-lg inline-flex items-center gap-2">
                                        <ArrowDownTrayIcon className="w-5 h-5" />
                                        {t('campaignDetail.export')}
                                    </button>
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700"><thead className="bg-slate-50 dark:bg-slate-700"><tr>
                                    <th className="p-4 w-4"><input type="checkbox" checked={isAllOnPageSelected} onChange={handleSelectAllOnPage} className="h-4 w-4 rounded" /></th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">NOM</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">PRÉNOM</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">TÉLÉPHONE</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">QUERRY</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">STATUT</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">{t('campaignDetail.contacts.headers.lastQualif')}</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">{t('campaignDetail.contacts.headers.lastNote')}</th>
                                </tr></thead>
                                <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700 text-sm">
                                    {paginatedContacts.map(contact => {
                                        const lastCall = [...campaignCallHistory].filter(c => c.contactId === contact.id).sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
                                        const lastNote = [...contactNotes].filter(n => n.contactId === contact.id).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
                                        return (
                                        <tr key={contact.id} onClick={() => setHistoryModal({ isOpen: true, contact })} className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 ${selectedContactIds.includes(contact.id) ? 'bg-indigo-50 dark:bg-indigo-900/30' : ''}`}>
                                            <td className="p-4 w-4" onClick={e => e.stopPropagation()}><input type="checkbox" checked={selectedContactIds.includes(contact.id)} onChange={e => handleSelectContact(contact.id, e.target.checked)} className="h-4 w-4 rounded" /></td>
                                            <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">{contact.lastName}</td>
                                            <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{contact.firstName}</td>
                                            <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-400">{contact.phoneNumber}</td>
                                            <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{contact.customFields?.querry || ''}</td>
                                            <td className="px-4 py-3"><span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${contact.status === 'pending' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200' : 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200'}`}>{contact.status}</span></td>
                                            <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{lastCall ? props.qualifications.find(q => q.id === lastCall.qualificationId)?.description : 'N/A'}</td>
                                            <td className="px-4 py-3 text-slate-600 dark:text-slate-400 truncate max-w-xs" title={lastNote?.note}>{lastNote?.note || 'N/A'}</td>
                                        </tr>
                                    )})}
                                </tbody>
                                </table>
                                {filteredContacts.length === 0 && <p className="text-center py-8 text-slate-500 dark:text-slate-400">{t('campaignDetail.contacts.noContacts')}</p>}
                            </div>
                            {totalPages > 1 && <div className="flex justify-between items-center mt-4 text-sm">
                                <p className="text-slate-600 dark:text-slate-400">{t('campaignDetail.contacts.pagination', { currentPage, totalPages })}</p>
                                <div className="flex gap-2">
                                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1 border rounded-md disabled:opacity-50 dark:border-slate-600 dark:hover:bg-slate-700">{t('common.previous')}</button>
                                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-3 py-1 border rounded-md disabled:opacity-50 dark:border-slate-600 dark:hover:bg-slate-700">{t('common.next')}</button>
                                </div>
                            </div>}
                        </div>
                    )}
                    {activeTab === 'dashboard' && <p>Dashboard coming soon...</p>}
                    {activeTab === 'dashboard2' && <p>Dashboard 2 coming soon...</p>}
                    {activeTab === 'settings' && <p>Settings coming soon...</p>}
                </div>
            </div>
        </div>
    );
};

export default CampaignDetailView;
