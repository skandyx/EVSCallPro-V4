
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

    return (
        <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KpiCard title="Taux de Pénétration" value={`${stats.penetrationRate.toFixed(1)}%`} subtext={`${campaign.contacts.length - stats.statusCounts.pending} / ${campaign.contacts.length} contacts`} />
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
        </div>
    );
};

const CampaignSettingsTab: React.FC<{ campaign: Campaign; onSave: (campaign: Campaign) => void; scripts: SavedScript[]; qualificationGroups: QualificationGroup[]; availableFields: any[] }> = ({ campaign, onSave, scripts, qualificationGroups, availableFields }) => {
    const [formData, setFormData] = useState<Campaign>(campaign);
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        if (type === 'checkbox') setFormData(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
        else if (name === 'scriptId') setFormData(prev => ({ ...prev, scriptId: value === '' ? null : value }));
        else if (e.target.getAttribute('type') === 'number') setFormData(prev => ({ ...prev, [name]: isNaN(parseInt(value, 10)) ? 0 : parseInt(value, 10) }));
        else setFormData(prev => ({ ...prev, [name]: value }));
    };
    
    const handleRuleChange = (type: 'quota' | 'filter', index: number, field: string, value: any) => {
        const key = type === 'quota' ? 'quotaRules' : 'filterRules';
        const updatedRules = [...formData[key]];
        (updatedRules[index] as any)[field] = value;
        setFormData(prev => ({ ...prev, [key]: updatedRules }));
    };
    
    const addRule = (type: 'quota' | 'filter') => {
        const key = type === 'quota' ? 'quotaRules' : 'filterRules';
        const newRule = type === 'quota' 
            ? { id: `qr-${Date.now()}`, contactField: 'postalCode', operator: 'equals', value: '', limit: 0, currentCount: 0 } 
            : { id: `fr-${Date.now()}`, type: 'include', contactField: 'postalCode', operator: 'equals', value: '' };
        setFormData(prev => ({ ...prev, [key]: [...prev[key], newRule] as any }));
    };
    
    const removeRule = (type: 'quota' | 'filter', index: number) => {
        const key = type === 'quota' ? 'quotaRules' : 'filterRules';
        setFormData(prev => ({ ...prev, [key]: prev[key].filter((_, i) => i !== index) }));
    };

    return (
        <div className="p-6 space-y-6">
            <div className="space-y-4">
                <h3 className="text-xl font-semibold text-slate-800 border-b pb-2">Informations Générales</h3>
                <div><label className="block text-sm font-medium text-slate-700">Nom</label><input type="text" name="name" value={formData.name} onChange={handleChange} required className="mt-1 block w-full p-2 border border-slate-300 rounded-md" /></div>
                <div><label className="block text-sm font-medium text-slate-700">Description</label><textarea name="description" value={formData.description} onChange={handleChange} className="mt-1 block w-full p-2 border border-slate-300 rounded-md" rows={2} /></div>
                <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-sm font-medium text-slate-700">Script d'agent</label><select name="scriptId" value={formData.scriptId || ''} onChange={handleChange} className="mt-1 block w-full p-2 border bg-white rounded-md"><option value="">Aucun script</option>{scripts.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
                    <div><label className="block text-sm font-medium text-slate-700">Groupe de qualifications</label><select name="qualificationGroupId" value={formData.qualificationGroupId || ''} onChange={handleChange} required className="mt-1 block w-full p-2 border bg-white rounded-md">{qualificationGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></div>
                </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-sm font-medium text-slate-700">Mode de numérotation</label><select name="dialingMode" value={formData.dialingMode} onChange={handleChange} className="mt-1 block w-full p-2 border bg-white rounded-md"><option value="PREDICTIVE">Prédictif</option><option value="PROGRESSIVE">Progressif</option><option value="MANUAL">Manuel</option></select></div>
                    <div><label className="block text-sm font-medium text-slate-700">Numéro présenté (Caller ID)</label><input type="text" name="callerId" value={formData.callerId} onChange={handleChange} required className="mt-1 block w-full p-2 border border-slate-300 rounded-md" /></div>
                </div>
                <div><label className="block text-sm font-medium text-slate-700">Temps de Post-Appel (secondes)</label><input type="number" name="wrapUpTime" value={formData.wrapUpTime} onChange={handleChange} min="0" max="120" required className="mt-1 block w-full p-2 border rounded-md" /></div>
            </div>
             <div className="space-y-4">
                <h3 className="text-xl font-semibold text-slate-800 border-b pb-2">Règles de Quotas</h3>
                <div className="space-y-3">
                    {formData.quotaRules.map((rule, index) => <div key={rule.id} className="grid grid-cols-12 gap-2 items-center">
                        <select value={rule.contactField} onChange={e => handleRuleChange('quota', index, 'contactField', e.target.value)} className="col-span-3 p-1.5 border bg-white rounded-md text-sm">{availableFields.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select>
                        <select value={rule.operator} onChange={e => handleRuleChange('quota', index, 'operator', e.target.value)} className="col-span-3 p-1.5 border bg-white rounded-md text-sm"><option value="equals">est égal à</option><option value="starts_with">commence par</option></select>
                        <input type="text" value={rule.value} onChange={e => handleRuleChange('quota', index, 'value', e.target.value)} placeholder="Valeur" className="col-span-3 p-1.5 border rounded-md text-sm" />
                        <input type="number" value={rule.limit} onChange={e => handleRuleChange('quota', index, 'limit', parseInt(e.target.value))} placeholder="Limite" className="col-span-2 p-1.5 border rounded-md text-sm" />
                        <button type="button" onClick={() => removeRule('quota', index)} className="text-red-500 hover:text-red-700 p-1"><TrashIcon className="w-4 h-4" /></button>
                    </div>)}
                    <button type="button" onClick={() => addRule('quota')} className="text-sm font-medium text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1"><PlusIcon className="w-4 h-4"/>Ajouter une règle</button>
                </div>
            </div>
             <div className="flex justify-end pt-6 border-t">
                <button onClick={() => onSave(formData)} className="bg-primary hover:bg-primary-hover text-primary-text font-bold py-2 px-4 rounded-lg shadow-md">Enregistrer les modifications</button>
            </div>
        </div>
    );
};

const CampaignDetailView: React.FC<CampaignDetailViewProps> = (props) => {
    const { campaign, script, onBack, onSaveCampaign, onUpdateContact, onDeleteContacts, callHistory, qualifications, qualificationGroups, savedScripts, users } = props;
    const [activeTab, setActiveTab] = useState<'contacts' | 'stats' | 'settings'>('stats');

     const availableFieldsForRules = useMemo(() => {
        const standard = [
            { id: 'postalCode', name: 'Code Postal' }, { id: 'phoneNumber', name: 'Numéro de Téléphone' }, { id: 'lastName', name: 'Nom de famille' },
        ];
        if (!script) return standard;
        const scriptFields = script.pages.flatMap(p => p.blocks).filter(b => ['input', 'email', 'phone', 'date', 'time', 'radio', 'checkbox', 'dropdown', 'textarea'].includes(b.type)).map(b => ({ id: b.fieldName, name: b.name }));
        return [...standard, ...scriptFields];
    }, [script]);

    const renderContent = () => {
        switch (activeTab) {
            case 'contacts': return <ContactList contacts={campaign.contacts} />;
            case 'stats': return <CampaignStatsTab campaign={campaign} callHistory={callHistory} qualifications={qualifications} />;
            case 'settings': return <CampaignSettingsTab campaign={campaign} onSave={onSaveCampaign} scripts={savedScripts} qualificationGroups={qualificationGroups} availableFields={availableFieldsForRules} />;
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
