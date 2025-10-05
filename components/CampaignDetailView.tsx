import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import type { Campaign, SavedScript, Contact, CallHistoryRecord, Qualification, User, ContactNote, UserGroup, QualificationGroup } from '../types.ts';
import { ArrowLeftIcon, UsersIcon, ChartBarIcon, Cog6ToothIcon, EditIcon, TrashIcon, InformationCircleIcon, ChevronDownIcon, XMarkIcon, ArrowDownTrayIcon, PhoneIcon, TimeIcon } from './Icons.tsx';
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

// --- Child Components ---

const KpiCard: React.FC<{ title: string, value: string, icon: React.FC<any> }> = ({ title, value, icon: Icon }) => (
    <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg border dark:border-slate-700">
        <div className="flex items-center">
            <div className="p-2 bg-slate-200 dark:bg-slate-700 rounded-md mr-3">
                <Icon className="w-6 h-6 text-slate-600 dark:text-slate-300" />
            </div>
            <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
                <p className="text-2xl font-bold text-slate-800 dark:text-slate-200">{value}</p>
            </div>
        </div>
    </div>
);

const ChartComponent: React.FC<{ chartId: string; type: any; data: any; options: any }> = ({ chartId, type, data, options }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const chartRef = useRef<any>(null);

    useEffect(() => {
        if (canvasRef.current) {
            if (chartRef.current) chartRef.current.destroy();
            const ctx = canvasRef.current.getContext('2d');
            if (ctx) {
                chartRef.current = new Chart(ctx, { type, data, options });
            }
        }
        return () => chartRef.current?.destroy();
    }, [type, data, options]);

    return <canvas ref={canvasRef} id={chartId}></canvas>;
};


const CampaignDashboard: React.FC<Omit<CampaignDetailViewProps, 'onBack' | 'script' | 'onSaveCampaign' | 'onUpdateContact' | 'onDeleteContacts' | 'onRecycleContacts'>> = (props) => {
    // FIX: Get `t` from useI18n hook instead of props. This resolves the TypeScript error.
    const { t } = useI18n();
    const { campaign, callHistory, qualifications, users } = props;
    const isDarkMode = document.documentElement.classList.contains('dark');
    const chartTextColor = isDarkMode ? '#cbd5e1' : '#475569';
    const chartGridColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';

    const campaignCallHistory = useMemo(() => callHistory.filter(c => c.campaignId === campaign.id), [callHistory, campaign.id]);

    const { kpis, processedContacts, remainingContacts } = useMemo(() => {
        const totalContacts = campaign.contacts.length;
        const processedContactsCount = campaign.contacts.filter(c => c.status !== 'pending').length;
        const completionRate = totalContacts > 0 ? (processedContactsCount / totalContacts) * 100 : 0;
        
        const nonContactQuals = ['std-90', 'std-91', 'std-93']; // Occupé, Faux numéro, Repondeur
        const contactedCalls = campaignCallHistory.filter(c => !nonContactQuals.includes(c.qualificationId || ''));
        const contactRate = processedContactsCount > 0 ? (contactedCalls.length / processedContactsCount) * 100 : 0;

        const positiveQualsCount = campaignCallHistory.filter(c => {
            const qual = qualifications.find(q => q.id === c.qualificationId);
            return qual?.type === 'positive';
        }).length;
        const conversionRate = contactedCalls.length > 0 ? (positiveQualsCount / contactedCalls.length) * 100 : 0;
        
        const totalDuration = campaignCallHistory.reduce((sum, call) => sum + call.duration, 0);
        const aht = campaignCallHistory.length > 0 ? totalDuration / campaignCallHistory.length : 0;

        return {
            kpis: {
                completionRate: `${completionRate.toFixed(1)}%`,
                contactRate: `${contactRate.toFixed(1)}%`,
                conversionRate: `${conversionRate.toFixed(1)}%`,
                aht: formatDuration(aht),
            },
            processedContacts: processedContactsCount,
            remainingContacts: totalContacts - processedContactsCount,
        };
    }, [campaign.contacts, campaignCallHistory, qualifications]);
    
     const qualDistribution = useMemo(() => {
        const counts = { positive: 0, neutral: 0, negative: 0 };
        campaignCallHistory.forEach(call => {
            const qual = qualifications.find(q => q.id === call.qualificationId);
            if (qual) counts[qual.type]++;
        });
        return {
            labels: [t('qualifications.types.positive'), t('qualifications.types.neutral'), t('qualifications.types.negative')],
            datasets: [{ data: [counts.positive, counts.neutral, counts.negative], backgroundColor: ['#22c55e', '#64748b', '#ef4444'] }]
        };
    }, [campaignCallHistory, qualifications, t]);

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
                label: t('campaignDetail.dashboard.charts.conversionsLabel'),
                data: hours,
                backgroundColor: 'rgba(79, 70, 229, 0.7)',
            }]
        };
    }, [campaignCallHistory, qualifications, t]);
      
    const qualPerformance = useMemo(() => {
        const qualCounts = campaignCallHistory.reduce((acc, call) => {
            if (call.qualificationId) acc[call.qualificationId] = (acc[call.qualificationId] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        return qualifications
            .filter(q => q.groupId === campaign.qualificationGroupId || q.isStandard)
            .map(qual => ({
                ...qual,
                count: qualCounts[qual.id] || 0,
                rate: campaignCallHistory.length > 0 ? ((qualCounts[qual.id] || 0) / campaignCallHistory.length) * 100 : 0
            }))
            .filter(q => q.count > 0)
            .sort((a,b) => b.count - a.count);
    }, [campaignCallHistory, qualifications, campaign.qualificationGroupId]);
      
    const agentPerformance = useMemo(() => {
        const agentStats: Record<string, { calls: number, conversions: number }> = {};
        campaignCallHistory.forEach(call => {
            if (!agentStats[call.agentId]) agentStats[call.agentId] = { calls: 0, conversions: 0 };
            agentStats[call.agentId].calls++;
            const qual = qualifications.find(q => q.id === call.qualificationId);
            if (qual?.type === 'positive') agentStats[call.agentId].conversions++;
        });
        return Object.entries(agentStats).map(([agentId, stats]) => {
            const agent = users.find(u => u.id === agentId);
            return {
                agentId,
                agentName: agent ? `${agent.firstName} ${agent.lastName}` : t('common.unknown'),
                ...stats
            }
        }).sort((a,b) => b.calls - a.calls);
    }, [campaignCallHistory, qualifications, users, t]);

    const chartOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: chartTextColor } } } };
    const barChartOptions = { ...chartOptions, scales: { x: { ticks: { color: chartTextColor }, grid: { color: chartGridColor } }, y: { beginAtZero: true, ticks: { color: chartTextColor, stepSize: 1 }, grid: { color: chartGridColor } } } };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard title={t('campaignDetail.dashboard.kpis.completionRate')} value={kpis.completionRate} icon={ChartBarIcon} />
                <KpiCard title={t('campaignDetail.dashboard.kpis.contactRate')} value={kpis.contactRate} icon={PhoneIcon} />
                <KpiCard title={t('campaignDetail.dashboard.kpis.conversionRate')} value={kpis.conversionRate} icon={ChartBarIcon} />
                <KpiCard title={t('campaignDetail.dashboard.kpis.aht')} value={kpis.aht} icon={TimeIcon} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 space-y-4">
                    <div>
                        <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">{t('campaignDetail.dashboard.fileProgress.title')}</h3>
                        <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg border dark:border-slate-700">
                             <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-4"><div className="bg-indigo-600 h-4 rounded-full" style={{ width: kpis.completionRate }}></div></div>
                             <div className="flex justify-between text-sm mt-2"><span className="text-slate-600 dark:text-slate-300">{t('campaignDetail.dashboard.fileProgress.processed')} <strong>{processedContacts}</strong></span><span className="text-slate-500 dark:text-slate-400">{t('campaignDetail.dashboard.fileProgress.remaining')} <strong>{remainingContacts}</strong></span></div>
                        </div>
                    </div>
                     <div>
                        <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">{t('campaignDetail.dashboard.quota.title')}</h3>
                        <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg border dark:border-slate-700 space-y-3">
                            {campaign.quotaRules.filter(r => r.limit > 0).map(rule => (
                                <div key={rule.id}>
                                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">{rule.operator === 'starts_with' ? t('campaignDetail.dashboard.quota.ruleStartsWith', {field: 'CP', value: rule.value}) : t('campaignDetail.dashboard.quota.ruleEquals', {field: 'CP', value: rule.value})}</p>
                                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 mt-1"><div className="bg-amber-500 h-2.5 rounded-full" style={{ width: `${rule.limit > 0 ? (rule.currentCount/rule.limit)*100 : 0}%` }}></div></div>
                                    <p className="text-xs text-right text-slate-500 dark:text-slate-400 mt-1">{t('campaignDetail.dashboard.quota.achieved')} {rule.currentCount} / {rule.limit}</p>
                                </div>
                            ))}
                             {campaign.quotaRules.filter(r => r.limit > 0).length === 0 && <p className="text-sm text-center italic text-slate-400">{t('common.none')}</p>}
                        </div>
                    </div>
                </div>
                 <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg border dark:border-slate-700"><h3 className="font-semibold text-center mb-2">{t('campaignDetail.dashboard.charts.qualifDistributionTitle')}</h3><div className="h-64"><ChartComponent chartId="qualif-dist-chart" type="doughnut" data={qualDistribution} options={chartOptions} /></div></div>
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg border dark:border-slate-700"><h3 className="font-semibold text-center mb-2">{t('campaignDetail.dashboard.charts.successByHourTitle')}</h3><div className="h-64"><ChartComponent chartId="success-hour-chart" type="bar" data={callsByHour} options={barChartOptions} /></div></div>
                </div>
            </div>
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg border dark:border-slate-700"><h3 className="font-semibold mb-2">{t('campaignDetail.dashboard.tables.qualifPerfTitle')}</h3><div className="max-h-60 overflow-y-auto"><table className="w-full text-sm"><thead className="sticky top-0 bg-slate-100 dark:bg-slate-700"><tr><th className="p-2 text-left">{t('campaignDetail.dashboard.tables.headers.qualification')}</th><th className="p-2 text-right">{t('campaignDetail.dashboard.tables.headers.processedRecords')}</th><th className="p-2 text-right">{t('campaignDetail.dashboard.tables.headers.rate')}</th></tr></thead><tbody>{qualPerformance.map(q => (<tr key={q.id} className="border-t dark:border-slate-700">
                    <td className="p-2 flex items-center gap-2"><span className={`w-2.5 h-2.5 rounded-full ${q.type === 'positive' ? 'bg-green-500' : q.type === 'negative' ? 'bg-red-500' : 'bg-slate-400'}`}></span>{q.description}</td>
                    <td className="p-2 text-right font-mono">{q.count}</td>
                    <td className="p-2 text-right font-mono">{q.rate.toFixed(1)}%</td>
                </tr>))}</tbody></table></div></div>
                <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg border dark:border-slate-700"><h3 className="font-semibold mb-2">{t('campaignDetail.dashboard.tables.agentPerfTitle')}</h3><div className="max-h-60 overflow-y-auto"><table className="w-full text-sm"><thead className="sticky top-0 bg-slate-100 dark:bg-slate-700"><tr><th className="p-2 text-left">{t('campaignDetail.dashboard.tables.headers.agent')}</th><th className="p-2 text-right">{t('campaignDetail.dashboard.tables.headers.processedCalls')}</th><th className="p-2 text-right">{t('campaignDetail.dashboard.tables.headers.conversions')}</th></tr></thead><tbody>{agentPerformance.map(a => (<tr key={a.agentId} className="border-t dark:border-slate-700">
                    <td className="p-2">{a.agentName}</td>
                    <td className="p-2 text-right font-mono">{a.calls}</td>
                    <td className="p-2 text-right font-mono">{a.conversions}</td>
                </tr>))}</tbody></table></div></div>
            </div>
        </div>
    )
};


const CampaignSettings: React.FC<Pick<CampaignDetailViewProps, 'campaign' | 'qualifications' | 'callHistory' | 'onRecycleContacts'>> = ({ campaign, qualifications, callHistory, onRecycleContacts }) => {
    const { t } = useI18n();
    const campaignCallHistory = useMemo(() => callHistory.filter(c => c.campaignId === campaign.id), [callHistory, campaign.id]);
    
    const recyclableQualifications = useMemo(() => {
        const qualCounts = campaignCallHistory.reduce((acc, call) => {
            if (call.qualificationId) acc[call.qualificationId] = (acc[call.qualificationId] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        
        return qualifications
            .filter(q => q.groupId === campaign.qualificationGroupId || q.isStandard)
            .map(qual => ({ ...qual, count: qualCounts[qual.id] || 0 }))
            .filter(q => q.count > 0 && q.isRecyclable !== false);
    }, [campaignCallHistory, campaign.qualificationGroupId, qualifications]);

    const handleRecycleClick = (qualId: string, qualDesc: string) => {
        const qualCount = recyclableQualifications.find(q => q.id === qualId)?.count || 0;
        if (window.confirm(t('campaignDetail.settings.recycling.confirm', {count: qualCount, qualDesc: qualDesc}))) {
            onRecycleContacts(campaign.id, qualId);
        }
    }

    return (
        <div>
            <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200">{t('campaignDetail.settings.recycling.title')}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t('campaignDetail.settings.recycling.description')}</p>
            <div className="mt-4 border rounded-lg overflow-hidden dark:border-slate-700">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-700"><tr>
                        <th className="p-3 text-left">{t('campaignDetail.settings.recycling.headers.qualification')}</th>
                        <th className="p-3 text-right">{t('campaignDetail.settings.recycling.headers.processedRecords')}</th>
                        <th className="p-3 text-right">{t('campaignDetail.settings.recycling.headers.action')}</th>
                    </tr></thead>
                    <tbody className="divide-y dark:divide-slate-700">
                        {recyclableQualifications.map(q => (
                            <tr key={q.id}>
                                <td className="p-3 font-medium">{q.description}</td>
                                <td className="p-3 text-right font-mono">{q.count}</td>
                                <td className="p-3 text-right">
                                    <button onClick={() => handleRecycleClick(q.id, q.description)} title={t('campaignDetail.settings.recycling.recycleButtonTooltip')} className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 font-semibold py-1 px-3 rounded-md hover:bg-indigo-200">
                                        {t('campaignDetail.settings.recycling.recycleButton')}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                 {recyclableQualifications.length === 0 && <p className="text-center p-8 text-slate-400 italic">{t('campaignDetail.settings.recycling.noRecyclable')}</p>}
            </div>
        </div>
    );
};


// --- Main Component ---
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
                'Durée': lastCall.duration,
                'Code Qualif': qual ? qual.code : 'N/A',
                'Description Qualif': qual ? qual.description : 'N/A'
            };
        });

        if (processedContactsData.length === 0) {
            alert(t('campaignDetail.noDataToExport'));
            return;
        }

        processedContactsData.sort((a, b) => {
             const [dateA, timeA] = a['Date de traitement'].split(' ');
             const [dateB, timeB] = b['Date de traitement'].split(' ');
             const isoA = `${dateA.split('/').reverse().join('-')}T${timeA}`;
             const isoB = `${dateB.split('/').reverse().join('-')}T${timeB}`;
            return new Date(isoB).getTime() - new Date(isoA).getTime();
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
        if (window.confirm(t('campaignDetail.contacts.confirmDelete', { count: selectedContactIds.length }))) {
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
                                    <SortableHeader sortKey="lastName" label={t('campaignDetail.contacts.headers.lastName')} />
                                    <SortableHeader sortKey="firstName" label={t('campaignDetail.contacts.headers.firstName')} />
                                    <SortableHeader sortKey="phoneNumber" label={t('campaignDetail.contacts.headers.phone')} />
                                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">QUERRY</th>
                                    <SortableHeader sortKey="status" label={t('campaignDetail.contacts.headers.status')} />
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
                    {activeTab === 'dashboard' && <CampaignDashboard {...props} />}
                    {activeTab === 'dashboard2' && <p>Dashboard 2 coming soon...</p>}
                    {activeTab === 'settings' && <CampaignSettings {...props} />}
                </div>
            </div>
        </div>
    );
};

export default CampaignDetailView;
