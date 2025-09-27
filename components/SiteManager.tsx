import React, { useState } from 'react';
import type { Feature, Site } from '../types.ts';
import { PlusIcon, EditIcon, TrashIcon } from './Icons.tsx';

interface SiteModalProps {
    site: Site | null;
    onSave: (siteData: Omit<Site, 'id'>) => void;
    onClose: () => void;
}

const SiteModal: React.FC<SiteModalProps> = ({ site, onSave, onClose }) => {
    const [name, setName] = useState(site?.name || '');

    const handleSave = () => {
        if (!name.trim()) return;
        onSave({ name: name.trim() });
    };

    return (
        <div className="fixed inset-0 bg-slate-800 bg-opacity-75 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
                <div className="p-6">
                    <h3 className="text-lg font-medium text-slate-900">{site ? 'Modifier le Site' : 'Nouveau Site'}</h3>
                    <div className="mt-4">
                        <label className="block text-sm font-medium text-slate-700">Nom du site</label>
                        <input type="text" value={name} onChange={e => setName(e.target.value)} className="mt-1 w-full p-2 border rounded-md" />
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


const SiteManager: React.FC<{ feature: Feature, sites: Site[], apiClient: any, refreshData: () => void }> = ({ feature, sites, apiClient, refreshData }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSite, setEditingSite] = useState<Site | null>(null);

    const handleSave = async (siteData: Omit<Site, 'id'>) => {
        const payload = { ...editingSite, ...siteData };
        if (editingSite) {
            await apiClient.put(`/sites/${editingSite.id}`, payload);
        } else {
            payload.id = `site-${Date.now()}`;
            await apiClient.post('/sites', payload);
        }
        refreshData();
        setIsModalOpen(false);
    };

    const handleDelete = async (siteId: string) => {
        if (window.confirm("Supprimer ce site ?")) {
            await apiClient.delete(`/sites/${siteId}`);
            refreshData();
        }
    };

    return (
        <div className="max-w-7xl mx-auto space-y-8">
            {isModalOpen && <SiteModal site={editingSite} onClose={() => setIsModalOpen(false)} onSave={handleSave} />}
            <header>
                <h1 className="text-4xl font-bold text-slate-900 tracking-tight">{feature.title}</h1>
                <p className="mt-2 text-lg text-slate-600">{feature.description}</p>
            </header>
            <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                <div className="flex justify-end mb-4">
                    <button onClick={() => { setEditingSite(null); setIsModalOpen(true); }} className="bg-primary text-primary-text font-bold py-2 px-4 rounded-lg shadow-md inline-flex items-center"><PlusIcon className="w-5 h-5 mr-2" />Ajouter un Site</button>
                </div>
                <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">ID du Site</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Nom</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                        {sites.map(site => (
                            <tr key={site.id}>
                                <td className="px-6 py-4 font-mono">{site.id}</td>
                                <td className="px-6 py-4 font-medium">{site.name}</td>
                                <td className="px-6 py-4 text-right space-x-4">
                                    <button onClick={() => { setEditingSite(site); setIsModalOpen(true); }} className="text-link"><EditIcon className="w-4 h-4 inline"/> Modifier</button>
                                    <button onClick={() => handleDelete(site.id)} className="text-red-600"><TrashIcon className="w-4 h-4 inline"/> Supprimer</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default SiteManager;
