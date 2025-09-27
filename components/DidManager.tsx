import React, { useState } from 'react';
import type { Feature, Did, Trunk, IvrFlow } from '../types.ts';
import { PlusIcon, EditIcon, TrashIcon } from './Icons.tsx';

interface DidModalProps {
    did: Partial<Did> | null;
    trunks: Trunk[];
    ivrFlows: IvrFlow[];
    onSave: (did: Omit<Did, 'id'>) => void;
    onClose: () => void;
}

const DidModal: React.FC<DidModalProps> = ({ did, trunks, ivrFlows, onSave, onClose }) => {
    const [formData, setFormData] = useState<Omit<Did, 'id'>>({
        number: did?.number || '',
        description: did?.description || '',
        trunkId: did?.trunkId || '',
        ivrFlowId: did?.ivrFlowId || null,
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = () => {
        if (!formData.number || !formData.trunkId) return;
        onSave(formData);
    };

    return (
        <div className="fixed inset-0 bg-slate-800 bg-opacity-75 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
                <div className="p-6">
                    <h3 className="text-lg font-medium text-slate-900">{did ? 'Modifier le Numéro' : 'Nouveau Numéro (SDA)'}</h3>
                    <div className="mt-4 space-y-4">
                        <input name="number" value={formData.number} onChange={handleChange} placeholder="Numéro de téléphone" className="w-full p-2 border rounded" />
                        <input name="description" value={formData.description} onChange={handleChange} placeholder="Description" className="w-full p-2 border rounded" />
                        <select name="trunkId" value={formData.trunkId} onChange={handleChange} className="w-full p-2 border rounded bg-white">
                            <option value="">Sélectionner un Trunk SIP</option>
                            {trunks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                        <select name="ivrFlowId" value={formData.ivrFlowId || ''} onChange={handleChange} className="w-full p-2 border rounded bg-white">
                            <option value="">Aucun (Non routé)</option>
                            {ivrFlows.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                        </select>
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


const DidManager: React.FC<{ feature: Feature, dids: Did[], trunks: Trunk[], ivrFlows: IvrFlow[], apiClient: any, refreshData: () => void }> = ({ feature, dids, trunks, ivrFlows, apiClient, refreshData }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingDid, setEditingDid] = useState<Did | null>(null);

    const handleSave = async (didData: Omit<Did, 'id'>) => {
        const payload = { ...editingDid, ...didData };
        if (editingDid) {
            await apiClient.put(`/dids/${editingDid.id}`, payload);
        } else {
            payload.id = `did-${Date.now()}`;
            await apiClient.post('/dids', payload);
        }
        refreshData();
        setIsModalOpen(false);
    };

    const handleDelete = async (didId: string) => {
        if (window.confirm("Supprimer ce numéro ?")) {
            await apiClient.delete(`/dids/${didId}`);
            refreshData();
        }
    };
    
    const findEntityName = (id: string | null, collection: Array<{ id: string; name: string }>) => {
        if (!id) return 'N/A';
        return collection.find(item => item.id === id)?.name || 'Inconnu';
    };

    return (
        <div className="max-w-7xl mx-auto space-y-8">
            {isModalOpen && <DidModal did={editingDid} trunks={trunks} ivrFlows={ivrFlows} onClose={() => setIsModalOpen(false)} onSave={handleSave} />}
            <header>
                <h1 className="text-4xl font-bold text-slate-900 tracking-tight">{feature.title}</h1>
                <p className="mt-2 text-lg text-slate-600">{feature.description}</p>
            </header>
            <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                <div className="flex justify-end mb-4">
                    <button onClick={() => { setEditingDid(null); setIsModalOpen(true); }} className="bg-primary text-primary-text font-bold py-2 px-4 rounded-lg shadow-md inline-flex items-center"><PlusIcon className="w-5 h-5 mr-2" />Ajouter un Numéro</button>
                </div>
                <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Numéro (SDA)</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Description</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Trunk SIP</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Destination (SVI)</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                        {dids.map(did => (
                            <tr key={did.id}>
                                <td className="px-6 py-4 font-mono">{did.number}</td>
                                <td className="px-6 py-4">{did.description}</td>
                                <td className="px-6 py-4">{findEntityName(did.trunkId, trunks)}</td>
                                <td className="px-6 py-4">{findEntityName(did.ivrFlowId, ivrFlows)}</td>
                                <td className="px-6 py-4 text-right space-x-4">
                                    <button onClick={() => { setEditingDid(did); setIsModalOpen(true); }} className="text-link"><EditIcon className="w-4 h-4 inline"/> Modifier</button>
                                    <button onClick={() => handleDelete(did.id)} className="text-red-600"><TrashIcon className="w-4 h-4 inline"/> Supprimer</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default DidManager;
