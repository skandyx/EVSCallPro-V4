import React, { useState } from 'react';

interface CallbackSchedulerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSchedule: (scheduledTime: string, notes: string) => void;
}

const CallbackSchedulerModal: React.FC<CallbackSchedulerModalProps> = ({ isOpen, onClose, onSchedule }) => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 1); 
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    const minDateTime = now.toISOString().slice(0, 16);
    
    const [scheduledTime, setScheduledTime] = useState(minDateTime);
    const [notes, setNotes] = useState('');

    if (!isOpen) return null;

    const handleSubmit = () => {
        if (!scheduledTime) {
            alert("Veuillez sélectionner une date et une heure.");
            return;
        }
        onSchedule(new Date(scheduledTime).toISOString(), notes);
    };

    return (
        <div className="fixed inset-0 bg-slate-800 bg-opacity-75 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
                <div className="p-6">
                    <h3 className="text-lg font-medium text-slate-900">Planifier un Rappel Personnel</h3>
                    <div className="mt-4 space-y-4">
                        <div>
                            <label className="text-sm font-medium text-slate-700">Date et Heure du Rappel</label>
                            <input 
                                type="datetime-local" 
                                value={scheduledTime} 
                                onChange={e => setScheduledTime(e.target.value)} 
                                min={minDateTime}
                                className="mt-1 w-full p-2 border rounded-md"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-slate-700">Notes (Optionnel)</label>
                            <textarea 
                                value={notes} 
                                onChange={e => setNotes(e.target.value)} 
                                rows={3}
                                className="mt-1 w-full p-2 border rounded-md"
                            />
                        </div>
                    </div>
                </div>
                <div className="bg-slate-50 p-3 flex justify-end gap-2">
                    <button onClick={onClose} className="bg-white border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50">Annuler</button>
                    <button onClick={handleSubmit} className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700">Planifier et Finaliser</button>
                </div>
            </div>
        </div>
    );
};

export default CallbackSchedulerModal;
