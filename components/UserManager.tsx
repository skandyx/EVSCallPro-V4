import React, { useState, useMemo } from 'react';
import type { Feature, User, UserRole, UserGroup, Site } from '../types.ts';
import { PlusIcon, EditIcon, TrashIcon, ArrowUpTrayIcon } from './Icons.tsx';
import ImportUsersModal from './ImportUsersModal.tsx';

// --- UserModal ---
interface UserModalProps {
    user: User | null;
    userGroups: UserGroup[];
    sites: Site[];
    onSave: (user: User, groupIds: string[]) => void;
    onClose: () => void;
    existingUsers: User[];
}

const UserModal: React.FC<UserModalProps> = ({ user, userGroups, sites, onSave, onClose, existingUsers }) => {
    const isEditing = !!user;
    const [formData, setFormData] = useState<User>(user || { id: `user-${Date.now()}`, loginId: '', firstName: '', lastName: '', email: '', role: 'Agent', isActive: true, campaignIds: [] });
    const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
    
    // Logic to handle user group memberships would go here

    const handleSave = () => {
        // Validation
        if (!formData.firstName || !formData.lastName || !formData.loginId) {
            alert("Prénom, Nom et Identifiant sont requis.");
            return;
        }
        if (!isEditing && !formData.password) {
            alert("Un mot de passe est requis pour un nouvel utilisateur.");
            return;
        }
        onSave(formData, selectedGroupIds);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-slate-800 bg-opacity-75 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
                <div className="p-6">
                    <h3 className="text-lg font-medium text-slate-900">{isEditing ? 'Modifier Utilisateur' : 'Nouvel Utilisateur'}</h3>
                    <div className="mt-4 grid grid-cols-2 gap-4">
                        <input value={formData.firstName} onChange={e => setFormData(f => ({...f, firstName: e.target.value}))} placeholder="Prénom" className="p-2 border rounded" />
                        <input value={formData.lastName} onChange={e => setFormData(f => ({...f, lastName: e.target.value}))} placeholder="Nom" className="p-2 border rounded" />
                        <input value={formData.loginId} onChange={e => setFormData(f => ({...f, loginId: e.target.value}))} placeholder="Identifiant" className="p-2 border rounded" />
                        <input value={formData.email} onChange={e => setFormData(f => ({...f, email: e.target.value}))} placeholder="Email" className="p-2 border rounded" />
                        <select value={formData.role} onChange={e => setFormData(f => ({...f, role: e.target.value as UserRole}))} className="p-2 border rounded bg-white">
                            <option value="Agent">Agent</option>
                            <option value="Superviseur">Superviseur</option>
                            <option value="Administrateur">Administrateur</option>
                        </select>
                         <select value={formData.siteId || ''} onChange={e => setFormData(f => ({...f, siteId: e.target.value || null}))} className="p-2 border rounded bg-white">
                            <option value="">Aucun site</option>
                            {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                        <input type="password" onChange={e => setFormData(f => ({...f, password: e.target.value}))} placeholder={isEditing ? "Nouveau mot de passe (optionnel)" : "Mot de passe"} className="p-2 border rounded col-span-2" />
                        <div className="flex items-center gap-2">
                            <input type="checkbox" id="isActive" checked={formData.isActive} onChange={e => setFormData(f => ({...f, isActive: e.target.checked}))} />
                            <label htmlFor="isActive">Actif</label>
                        </div>
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

// --- UserManager Component ---
const UserManager: React.FC<{ feature: Feature, users: User[], userGroups: UserGroup[], sites: Site[], apiClient: any, refreshData: () => void }> = ({ feature, users, userGroups, sites, apiClient, refreshData }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const filteredUsers = useMemo(() => {
        return users.filter(user => 
            user.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.loginId.includes(searchTerm)
        );
    }, [users, searchTerm]);

    const handleSave = async (user: User, groupIds: string[]) => {
        const payload = { ...user, groupIds };
        if (editingUser) {
            await apiClient.put(`/users/${user.id}`, payload);
        } else {
            await apiClient.post('/users', payload);
        }
        refreshData();
    };

    const handleDelete = async (userId: string) => {
        if (window.confirm("Êtes-vous sûr de vouloir supprimer cet utilisateur ?")) {
            await apiClient.delete(`/users/${userId}`);
            refreshData();
        }
    };
    
    const handleImport = async (newUsers: User[]) => {
        await apiClient.post('/users/bulk', { users: newUsers });
        refreshData();
    };

    return (
        <div className="max-w-7xl mx-auto space-y-8">
            {isModalOpen && <UserModal user={editingUser} userGroups={userGroups} sites={sites} onSave={handleSave} onClose={() => setIsModalOpen(false)} existingUsers={users} />}
            {isImportModalOpen && <ImportUsersModal onClose={() => setIsImportModalOpen(false)} onImport={handleImport} existingUsers={users} />}
            <header>
                <h1 className="text-4xl font-bold text-slate-900 tracking-tight">{feature.title}</h1>
                <p className="mt-2 text-lg text-slate-600">{feature.description}</p>
            </header>
            <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                <div className="flex justify-between items-center mb-4">
                    <input type="text" placeholder="Rechercher un utilisateur..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="p-2 border rounded-md" />
                    <div className="space-x-2">
                        <button onClick={() => setIsImportModalOpen(true)} className="bg-slate-200 hover:bg-slate-300 font-bold py-2 px-4 rounded-lg inline-flex items-center"><ArrowUpTrayIcon className="w-5 h-5 mr-2" />Importer</button>
                        <button onClick={() => { setEditingUser(null); setIsModalOpen(true); }} className="bg-primary hover:bg-primary-hover text-primary-text font-bold py-2 px-4 rounded-lg shadow-md inline-flex items-center"><PlusIcon className="w-5 h-5 mr-2" />Ajouter un utilisateur</button>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Nom</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Identifiant</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Rôle</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Statut</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {filteredUsers.map(user => (
                                <tr key={user.id}>
                                    <td className="px-6 py-4 font-medium text-slate-800">{user.firstName} {user.lastName}</td>
                                    <td className="px-6 py-4 font-mono">{user.loginId}</td>
                                    <td className="px-6 py-4">{user.role}</td>
                                    <td className="px-6 py-4"><span className={`px-2 py-1 text-xs font-semibold rounded-full ${user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{user.isActive ? 'Actif' : 'Inactif'}</span></td>
                                    <td className="px-6 py-4 text-right space-x-4">
                                        <button onClick={() => { setEditingUser(user); setIsModalOpen(true); }} className="text-link hover:underline"><EditIcon className="w-4 h-4 inline-block -mt-1"/> Modifier</button>
                                        <button onClick={() => handleDelete(user.id)} className="text-red-600 hover:text-red-900"><TrashIcon className="w-4 h-4 inline-block -mt-1"/> Supprimer</button>
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

export default UserManager;
