import React, { useState } from 'react';
import type { User } from '../types.ts';
import { UserCircleIcon, ArrowUpTrayIcon } from './Icons.tsx';

interface UserProfileModalProps {
    user: User;
    onClose: () => void;
    onSavePassword: (passwordData: any) => Promise<void>;
}

const UserProfileModal: React.FC<UserProfileModalProps> = ({ user, onClose, onSavePassword }) => {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const handlePasswordSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (newPassword !== confirmPassword) {
            setError('Les nouveaux mots de passe ne correspondent pas.');
            return;
        }
        if (newPassword.length < 4) {
            setError('Le nouveau mot de passe doit contenir au moins 4 caractères.');
            return;
        }

        setIsSaving(true);
        try {
            await onSavePassword({ currentPassword, newPassword });
        } catch (err: any) {
            setError(err.response?.data?.error || "Une erreur s'est produite.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-800 bg-opacity-75 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
                <div className="p-6 border-b">
                    <h3 className="text-xl font-medium text-slate-900">Mon Profil</h3>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-1 flex flex-col items-center">
                        <div className="relative w-32 h-32">
                            {user.profilePictureUrl ? (
                                <img src={user.profilePictureUrl} alt="Profil" className="w-32 h-32 rounded-full object-cover" />
                            ) : (
                                <UserCircleIcon className="w-32 h-32 text-slate-300" />
                            )}
                            <button className="absolute bottom-0 right-0 p-2 bg-slate-700 text-white rounded-full hover:bg-slate-800" title="Changer la photo de profil">
                                <ArrowUpTrayIcon className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="mt-4 text-center">
                            <p className="font-bold text-lg text-slate-800">{user.firstName} {user.lastName}</p>
                            <p className="text-sm text-slate-500">{user.role}</p>
                        </div>
                    </div>
                    <div className="md:col-span-2">
                        <form onSubmit={handlePasswordSave} className="space-y-4">
                            <h4 className="font-semibold text-slate-700 border-b pb-2">Changer le mot de passe</h4>
                            <div>
                                <label className="block text-sm font-medium text-slate-700">Mot de passe actuel</label>
                                <input
                                    type="password"
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    required
                                    className="mt-1 block w-full p-2 border border-slate-300 rounded-md"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700">Nouveau mot de passe</label>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    required
                                    className="mt-1 block w-full p-2 border border-slate-300 rounded-md"
                                />
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-slate-700">Confirmer le nouveau mot de passe</label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                    className="mt-1 block w-full p-2 border border-slate-300 rounded-md"
                                />
                            </div>
                            {error && <p className="text-sm text-red-600">{error}</p>}
                            <div className="flex justify-end">
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg shadow-md hover:bg-indigo-700 disabled:bg-indigo-400"
                                >
                                    {isSaving ? 'Enregistrement...' : 'Mettre à jour le mot de passe'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
                 <div className="bg-slate-50 px-4 py-3 flex justify-end rounded-b-lg">
                    <button type="button" onClick={onClose} className="rounded-md border border-slate-300 bg-white px-4 py-2 font-medium text-slate-700 shadow-sm hover:bg-slate-50">Fermer</button>
                </div>
            </div>
        </div>
    );
};

export default UserProfileModal;
