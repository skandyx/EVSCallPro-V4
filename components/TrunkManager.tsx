import React, { useState } from 'react';
import type { Feature, Trunk } from '../types.ts';
import { PlusIcon, EditIcon, TrashIcon } from './Icons.tsx';

interface TrunkModalProps {
    trunk: Partial<Trunk> | null;
    onSave: (trunk: Omit<Trunk, 'id'>) => void;
    onClose: () => void;
}

const TrunkModal: React.FC<TrunkModalProps> = ({ trunk, onSave, onClose }) => {
    const [formData, setFormData] = useState<Omit<Trunk, 'id'>>({
        name: trunk?.name || '',
        domain: trunk?.domain || '',
        login: trunk?.login || '',
        password: '',
        authType: trunk?.authType || 'register',
        dialPattern: trunk?.dialPattern || 'NXXNXXXXXX',
        inboundContext: trunk?.inboundContext || 'from-trunk',
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = () => {
        if (!formData.name || !formData.domain) return;
        onSave(formData);
    };

    return (
        <div className="fixed inset-0 bg-slate-800 bg-opacity-75 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
                <div className="p-6">
                    <h3 className="text-lg font-medium text-slate-900">{trunk ? 'Modifier le Trunk' : 'Nouveau Trunk SIP'}</h3>
                    <div className="mt-4 space-y-4">
                        <input name="name" value={formData.name} onChange={handleChange} placeholder="Nom du Trunk" className="w-full p-2 border rounded" />
                        <input name="domain" value={formData.domain} onChange={handleChange} placeholder="Domaine/IP du fournisseur" className="w-full p-2 border rounded" />
                        <input name="login" value={formData.login} onChange={handleChange} placeholder="Identifiant" className="w-full p-2 border rounded" />
                        <input name="password" type="password" value={formData.password} onChange={handleChange} placeholder="Mot de passe (laisser vide pour ne pas changer)" className="w-full p-2 border rounded" />
                        <select name="authType" value={formData.authType} onChange={handleChange} className="w-full p-2 border rounded bg-white">
                            <option value="register">Register</option>
                            <option value="ip">IP Auth</option>
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


const TrunkManager: React.FC<{ feature: Feature, trunks: Trunk[], apiClient: any, refreshData: () => void }> = ({ feature, trunks, apiClient, refreshData }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTrunk, setEditingTrunk] = useState<Trunk | null>(null);

    const handleSave = async (trunkData: Omit<Trunk, 'id'>) => {
        const payload = { ...editingTrunk, ...trunkData };
        if (editingTrunk) {
            await apiClient.put(`/trunks/${editingTrunk.id}`, payload);
        } else {
            payload.id = `trunk-${Date.now()}`;
            await apiClient.post('/trunks', payload);
        }
        refreshData();
        setIsModalOpen(false);
    };

    const handleDelete = async (trunkId: string) => {
        if (window.confirm("Supprimer ce Trunk SIP ?")) {
            await apiClient.delete(`/trunks/${trunkId}`);
            refreshData();
        }
    };

    return (
        <div className="max-w-7xl mx-auto space-y-8">
            {isModalOpen && <TrunkModal trunk={editingTrunk} onClose={() => setIsModalOpen(false)} onSave={handleSave} />}
            <header>
                <h1 className="text-4xl font-bold text-slate-900 tracking-tight">{feature.title}</h1>
                <p className="mt-2 text-lg text-slate-600">{feature.description}</p>
            </header>
            <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                <div className="flex justify-end mb-4">
                    <button onClick={() => { setEditingTrunk(null); setIsModalOpen(true); }} className="bg-primary text-primary-text font-bold py-2 px-4 rounded-lg shadow-md inline-flex items-center"><PlusIcon className="w-5 h-5 mr-2" />Ajouter un Trunk</button>
                </div>
                <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Nom</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Domaine</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Authentification</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                        {trunks.map(trunk => (
                            <tr key={trunk.id}>
                                <td className="px-6 py-4 font-medium">{trunk.name}</td>
                                <td className="px-6 py-4">{trunk.domain}</td>
                                <td className="px-6 py-4">{trunk.authType}</td>
                                <td className="px-6 py-4 text-right space-x-4">
                                    <button onClick={() => { setEditingTrunk(trunk); setIsModalOpen(true); }} className="text-link"><EditIcon className="w-4 h-4 inline"/> Modifier</button>
                                    <button onClick={() => handleDelete(trunk.id)} className="text-red-600"><TrashIcon className="w-4 h-4 inline"/> Supprimer</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default TrunkManager;
