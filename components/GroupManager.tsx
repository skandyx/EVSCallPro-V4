import React, { useState, useMemo } from 'react';
import type { Feature, UserGroup, User } from '../types.ts';
import { PlusIcon, EditIcon, TrashIcon, ChevronDownIcon, XMarkIcon } from './Icons.tsx';

interface GroupModalProps {
    group: UserGroup | null;
    users: User[];
    onSave: (group: UserGroup) => void;
    onClose: () => void;
}

const GroupModal: React.FC<GroupModalProps> = ({ group, users, onSave, onClose }) => {
    const [name, setName] = useState(group?.name || '');
    const [memberIds, setMemberIds] = useState<string[]>(group?.memberIds || []);
    const availableUsers = users.filter(u => !memberIds.includes(u.id));

    const handleSave = () => {
        if (!name.trim()) return;
        const groupToSave = {
            id: group?.id || `group-${Date.now()}`,
            name: name.trim(),
            memberIds,
        };
        onSave(groupToSave);
        onClose();
    };
    
    return (
        <div className="fixed inset-0 bg-slate-800 bg-opacity-75 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl">
                <div className="p-6">
                    <h3 className="text-lg font-medium text-slate-900">{group ? 'Modifier le Groupe' : 'Nouveau Groupe'}</h3>
                    <div className="mt-4 space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Nom du groupe</label>
                            <input type="text" value={name} onChange={e => setName(e.target.value)} className="mt-1 w-full p-2 border rounded-md" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700">Utilisateurs disponibles</label>
                                <div className="mt-1 h-64 border rounded-md overflow-y-auto p-2">
                                    {availableUsers.map(user => (
                                        <button key={user.id} onClick={() => setMemberIds([...memberIds, user.id])} className="w-full text-left p-2 rounded hover:bg-slate-100">{user.firstName} {user.lastName}</button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700">Membres du groupe</label>
                                <div className="mt-1 h-64 border rounded-md overflow-y-auto p-2">
                                     {users.filter(u => memberIds.includes(u.id)).map(user => (
                                        <div key={user.id} className="flex justify-between items-center p-2 rounded bg-slate-50">
                                            <span>{user.firstName} {user.lastName}</span>
                                            <button onClick={() => setMemberIds(memberIds.filter(id => id !== user.id))}><XMarkIcon className="w-4 h-4 text-red-500"/></button>
                                        </div>
                                     ))}
                                </div>
                            </div>
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
}

const GroupManager: React.FC<{ feature: Feature, userGroups: UserGroup[], users: User[], apiClient: any, refreshData: () => void }> = ({ feature, userGroups, users, apiClient, refreshData }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingGroup, setEditingGroup] = useState<UserGroup | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const filteredGroups = useMemo(() => {
        return userGroups.filter(group => group.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [userGroups, searchTerm]);

    const handleSave = async (group: UserGroup) => {
        if (editingGroup) {
            await apiClient.put(`/user-groups/${group.id}`, group);
        } else {
            await apiClient.post('/user-groups', group);
        }
        refreshData();
    };

    const handleDelete = async (groupId: string) => {
        if (window.confirm("Êtes-vous sûr de vouloir supprimer ce groupe ?")) {
            await apiClient.delete(`/user-groups/${groupId}`);
            refreshData();
        }
    };

    return (
        <div className="max-w-7xl mx-auto space-y-8">
            {isModalOpen && <GroupModal group={editingGroup} users={users} onClose={() => setIsModalOpen(false)} onSave={handleSave} />}
            <header>
                <h1 className="text-4xl font-bold text-slate-900 tracking-tight">{feature.title}</h1>
                <p className="mt-2 text-lg text-slate-600">{feature.description}</p>
            </header>
            <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                <div className="flex justify-between items-center mb-4">
                    <input type="text" placeholder="Rechercher un groupe..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="p-2 border rounded-md" />
                    <button onClick={() => { setEditingGroup(null); setIsModalOpen(true); }} className="bg-primary hover:bg-primary-hover text-primary-text font-bold py-2 px-4 rounded-lg shadow-md inline-flex items-center"><PlusIcon className="w-5 h-5 mr-2" />Créer un Groupe</button>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Nom du Groupe</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Nombre de Membres</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {filteredGroups.map(group => (
                                <tr key={group.id}>
                                    <td className="px-6 py-4 font-medium text-slate-800">{group.name}</td>
                                    <td className="px-6 py-4">{group.memberIds.length}</td>
                                    <td className="px-6 py-4 text-right space-x-4">
                                        <button onClick={() => { setEditingGroup(group); setIsModalOpen(true); }} className="text-link hover:underline"><EditIcon className="w-4 h-4 inline-block -mt-1"/> Modifier</button>
                                        <button onClick={() => handleDelete(group.id)} className="text-red-600 hover:text-red-900"><TrashIcon className="w-4 h-4 inline-block -mt-1"/> Supprimer</button>
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

export default GroupManager;
