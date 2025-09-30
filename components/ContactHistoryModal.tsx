
import React from 'react';
import type { Contact, CallHistoryRecord, User, Qualification } from '../types.ts';
import { XMarkIcon } from './Icons.tsx';

interface ContactHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    contact: Contact;
    callHistory: CallHistoryRecord[];
    users: User[];
    qualifications: Qualification[];
}

const findEntityName = (id: string | null, collection: Array<{id: string, name?: string, firstName?: string, lastName?: string, description?: string}>) => {
    if (!id) return <span className="text-slate-400 italic">N/A</span>;
    const item = collection.find(i => i.id === id);
    if (!item) return <span className="text-red-500">Inconnu</span>;
    return item.name || `${item.firstName} ${item.lastName}` || item.description;
};

const formatDuration = (seconds: number) => {
    if(isNaN(seconds) || seconds < 0) return '00:00:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.round(seconds % 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const ContactHistoryModal: React.FC<ContactHistoryModalProps> = ({ isOpen, onClose, contact, callHistory, users, qualifications }) => {
    if (!isOpen) return null;

    const contactHistory = callHistory.filter(c => c.contactId === contact.id);

    return (
        <div className="fixed inset-0 bg-slate-800 bg-opacity-75 flex items-center justify-center p-4 z-[70]">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-[80vh] flex flex-col">
                <div className="p-4 border-b flex justify-between items-center">
                    <h3 className="text-lg font-medium text-slate-900">
                        Historique pour : {contact.firstName} {contact.lastName} ({contact.phoneNumber})
                    </h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-200">
                        <XMarkIcon className="w-6 h-6 text-slate-500" />
                    </button>
                </div>
                <div className="p-4 flex-1 overflow-y-auto">
                    {contactHistory.length > 0 ? (
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Date & Heure</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Agent</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Durée</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Qualification</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-200 text-sm">
                                {contactHistory.map(record => (
                                    <tr key={record.id}>
                                        <td className="px-4 py-3 text-slate-600">{new Date(record.timestamp).toLocaleString('fr-FR')}</td>
                                        <td className="px-4 py-3 font-medium">{findEntityName(record.agentId, users)}</td>
                                        <td className="px-4 py-3 font-mono">{formatDuration(record.duration)}</td>
                                        <td className="px-4 py-3">{findEntityName(record.qualificationId, qualifications)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <p className="text-center text-slate-500 pt-8">Aucun historique d'appel pour ce contact.</p>
                    )}
                </div>
                <div className="bg-slate-50 p-3 flex justify-end">
                    <button onClick={onClose} className="bg-white border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50">
                        Fermer
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ContactHistoryModal;
