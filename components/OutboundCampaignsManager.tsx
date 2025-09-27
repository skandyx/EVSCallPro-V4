import React, { useState, useMemo } from 'react';
import type { Feature, Campaign, SavedScript, QualificationGroup, Contact } from '../types.ts';
import { PlusIcon, EditIcon, TrashIcon, EyeIcon, ChevronDownIcon, UserCircleIcon, ArrowUpTrayIcon } from './Icons.tsx';
import CampaignDetailView from './CampaignDetailView.tsx';
import ImportContactsModal from './ImportContactsModal.tsx';

// --- CampaignModal ---
interface CampaignModalProps {
    campaign: Campaign | null;
    scripts: SavedScript[];
    qualificationGroups: QualificationGroup[];
    onSave: (campaign: Campaign) => void;
    onClose: () => void;
}

const CampaignModal: React.FC<CampaignModalProps> = ({ campaign, scripts, qualificationGroups, onSave, onClose }) => {
    const isEditing = !!campaign;
    const [formData, setFormData] = useState<Campaign>(campaign || { 
        id: `campaign-${Date.now()}`, 
        name: '', description: '', 
        scriptId: null, qualificationGroupId: null, 
        callerId: '', isActive: true, 
        dialingMode: 'PROGRESSIVE',
        contacts: [],
        assignedUserIds: [],
        // Add other fields from Campaign type with defaults
        priority: 1, timezone: 'Europe/Paris', callingDays: [1,2,3,4,5], callingStartTime: '09:00', callingEndTime: '18:00', maxAbandonRate: 3, paceFactor: 2.5, minAgentsBeforeStart: 1, retryAttempts: 3, retryIntervals: [300, 900, 3600], retryOnStatus: [], amdEnabled: false, amdConfidence: 80, voicemailAction: 'HANGUP', recordingEnabled: true, recordingBeep: false, maxRingDuration: 30, wrapUpTime: 15, maxCallDuration: 3600, quotaRules: [], filterRules: []
    });
    
    const handleSave = () => {
        if (!formData.name) return;
        onSave(formData);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-slate-800 bg-opacity-75 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl">
                <div className="p-6">
                     <h3 className="text-lg font-medium text-slate-900">{isEditing ? 'Modifier la Campagne' : 'Nouvelle Campagne'}</h3>
                     <div className="mt-4 grid grid-cols-2 gap-4">
                        <input value={formData.name} onChange={e => setFormData(f => ({...f, name: e.target.value}))} placeholder="Nom de la campagne" className="p-2 border rounded col-span-2" />
                        <textarea value={formData.description} onChange={e => setFormData(f => ({...f, description: e.target.value}))} placeholder="Description" className="p-2 border rounded col-span-2" rows={3}/>
                        <select value={formData.scriptId || ''} onChange={e => setFormData(f => ({...f, scriptId: e.target.value || null}))} className="p-2 border rounded bg-white">
                            <option value="">Aucun script</option>
                            {scripts.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                        <select value={formData.qualificationGroupId || ''} onChange={e => setFormData(f => ({...f, qualificationGroupId: e.target.value || null}))} className="p-2 border rounded bg-white">
                            <option value="">Aucun groupe de qualifications</option>
                            {qualificationGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                        </select>
                        <input value={formData.callerId} onChange={e => setFormData(f => ({...f, callerId: e.target.value}))} placeholder="Numéro présenté (Caller ID)" className="p-2 border rounded" />
                         <select value={formData.dialingMode} onChange={e => setFormData(f => ({...f, dialingMode: e.target.value as any}))} className="p-2 border rounded bg-white">
                            <option value="PROGRESSIVE">Progressif</option>
                            <option value="PREDICTIVE">Prédictif</option>
                            <option value="MANUAL">Manuel</option>
                        </select>
                         <div className="flex items-center gap-2"><input type="checkbox" checked={formData.isActive} onChange={e => setFormData(f => ({...f, isActive: e.target.checked}))} /> Actif</div>
                     </div>
                </div>
                <div className="bg-slate-50 px-4 py-3 flex justify-end gap-2">
                    <button onClick={onClose} className="bg-white border rounded-md px-4 py-2">Annuler</button>
                    <button onClick={handleSave} className="bg-indigo-600 text-white rounded-md px-4 py-2">Enregistrer</button>
                </div>
            </div>
        </div>
    );
};

// --- OutboundCampaignsManager ---
const OutboundCampaignsManager: React.FC<{ 
    feature: Feature, 
    campaigns: Campaign[], 
    savedScripts: SavedScript[],
    qualificationGroups: QualificationGroup[],
    apiClient: any, 
    refreshData: () => void 
}> = ({ feature, campaigns, savedScripts, qualificationGroups, apiClient, refreshData }) => {
    const [view, setView] = useState<'list' | 'detail'>('list');
    const [activeCampaign, setActiveCampaign] = useState<Campaign | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);

    const handleSave = async (campaign: Campaign) => {
        if (activeCampaign) {
            await apiClient.put(`/campaigns/${campaign.id}`, campaign);
        } else {
            await apiClient.post('/campaigns', campaign);
        }
        refreshData();
        setActiveCampaign(null);
    };

    const handleDelete = async (campaignId: string) => {
        if (window.confirm("Supprimer cette campagne ?")) {
            await apiClient.delete(`/campaigns/${campaignId}`);
            refreshData();
        }
    };
    
    const handleImport = async (newContacts: Contact[], deduplicationConfig: { enabled: boolean; fieldIds: string[] }) => {
        if (activeCampaign) {
            await apiClient.post(`/campaigns/${activeCampaign.id}/contacts`, { contacts: newContacts, deduplicationConfig });
            refreshData();
        }
        setIsImportModalOpen(false);
    };

    if (view === 'detail' && activeCampaign) {
        return <CampaignDetailView 
            campaign={activeCampaign} 
            script={savedScripts.find(s => s.id === activeCampaign.scriptId) || null}
            onBack={() => { setView('list'); setActiveCampaign(null); }}
            onSaveCampaign={handleSave}
            onUpdateContact={() => {}} // placeholder
            onDeleteContacts={() => {}} // placeholder
        />
    }

    return (
        <div className="max-w-7xl mx-auto space-y-8">
            {isModalOpen && <CampaignModal campaign={activeCampaign} scripts={savedScripts} qualificationGroups={qualificationGroups} onSave={handleSave} onClose={() => setIsModalOpen(false)} />}
            {isImportModalOpen && activeCampaign && <ImportContactsModal campaign={activeCampaign} script={savedScripts.find(s => s.id === activeCampaign.scriptId) || null} onClose={() => setIsImportModalOpen(false)} onImport={handleImport} />}
            <header>
                <h1 className="text-4xl font-bold text-slate-900 tracking-tight">{feature.title}</h1>
                <p className="mt-2 text-lg text-slate-600">{feature.description}</p>
            </header>
            <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                <div className="flex justify-end mb-4">
                    <button onClick={() => { setActiveCampaign(null); setIsModalOpen(true); }} className="bg-primary text-primary-text font-bold py-2 px-4 rounded-lg shadow-md inline-flex items-center"><PlusIcon className="w-5 h-5 mr-2" />Créer une campagne</button>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                         <thead className="bg-slate-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Nom</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Statut</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Contacts</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {campaigns.map(c => (
                                <tr key={c.id}>
                                    <td className="px-6 py-4 font-medium">{c.name}</td>
                                    <td className="px-6 py-4"><span className={`px-2 py-1 text-xs rounded-full ${c.isActive ? 'bg-green-100 text-green-800' : 'bg-slate-200'}`}>{c.isActive ? 'Active' : 'Inactive'}</span></td>
                                    <td className="px-6 py-4">{c.contacts.length}</td>
                                    <td className="px-6 py-4 text-right space-x-2">
                                        <button onClick={() => { setActiveCampaign(c); setIsImportModalOpen(true); }} className="text-sm font-medium text-slate-600 hover:text-indigo-600"><ArrowUpTrayIcon className="w-4 h-4 inline-block -mt-1"/> Importer</button>
                                        <button onClick={() => { setActiveCampaign(c); setView('detail'); }} className="text-sm font-medium text-slate-600 hover:text-indigo-600"><EyeIcon className="w-4 h-4 inline-block -mt-1"/> Voir</button>
                                        <button onClick={() => { setActiveCampaign(c); setIsModalOpen(true); }} className="text-sm font-medium text-slate-600 hover:text-indigo-600"><EditIcon className="w-4 h-4 inline-block -mt-1"/> Modifier</button>
                                        <button onClick={() => handleDelete(c.id)} className="text-sm font-medium text-red-600 hover:text-red-800"><TrashIcon className="w-4 h-4 inline-block -mt-1"/> Supprimer</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default OutboundCampaignsManager;