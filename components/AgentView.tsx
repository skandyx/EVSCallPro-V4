import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { User, Campaign, Contact, Qualification, SavedScript, QualificationGroup, ContactNote, PersonalCallback } from '../types.ts';
import { PowerIcon, PhoneIcon, UserCircleIcon, PauseIcon, CalendarDaysIcon } from './Icons.tsx';
import AgentPreview from './AgentPreview.tsx';
import UserProfileModal from './UserProfileModal.tsx';
import apiClient from '../src/lib/axios.ts';

// A single object to hold all data, makes prop drilling cleaner
interface AgentData {
    campaigns: Campaign[];
    qualifications: Qualification[];
    qualificationGroups: QualificationGroup[];
    savedScripts: SavedScript[];
    contactNotes: ContactNote[];
    users: User[];
    personalCallbacks: PersonalCallback[];
}
interface AgentViewProps {
    currentUser: User;
    onLogout: () => void;
    data: AgentData;
    refreshData: () => void;
    onUpdatePassword: (passwordData: any) => Promise<void>;
    onUpdateProfilePicture: (base64DataUrl: string) => Promise<void>;
}

type AgentStatus = 'En Attente' | 'En Appel' | 'En Post-Appel' | 'En Pause';

// --- Callback Scheduler Modal ---
const CallbackSchedulerModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSchedule: (scheduledTime: string, notes: string) => void;
}> = ({ isOpen, onClose, onSchedule }) => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    const defaultDateTime = now.toISOString().slice(0, 16);
    
    const [scheduledTime, setScheduledTime] = useState(defaultDateTime);
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
                            <input type="datetime-local" value={scheduledTime} onChange={e => setScheduledTime(e.target.value)} className="mt-1 w-full p-2 border rounded-md"/>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-slate-700">Notes (Optionnel)</label>
                            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="mt-1 w-full p-2 border rounded-md"/>
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

const AgentView: React.FC<AgentViewProps> = ({ currentUser, onLogout, data, refreshData, onUpdatePassword, onUpdateProfilePicture }) => {
    const [status, setStatus] = useState<AgentStatus>('En Attente');
    const [statusTimer, setStatusTimer] = useState(0);
    const [currentContact, setCurrentContact] = useState<Contact | null>(null);
    const [currentCampaign, setCurrentCampaign] = useState<Campaign | null>(null);
    const [activeScript, setActiveScript] = useState<SavedScript | null>(null);
    const [selectedQual, setSelectedQual] = useState<string | null>(null);
    const [isLoadingNextContact, setIsLoadingNextContact] = useState(false);
    const [newNote, setNewNote] = useState('');
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
    const [isCallbackModalOpen, setIsCallbackModalOpen] = useState(false);

    // Timer effect
    useEffect(() => {
        const interval = setInterval(() => {
            setStatusTimer(prev => prev + 1);
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const formatTimer = (seconds: number) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    const requestNextContact = useCallback(async () => {
        if (isLoadingNextContact || status !== 'En Attente') return;
        setIsLoadingNextContact(true);
        setFeedbackMessage(null);
        try {
            const response = await apiClient.post('/campaigns/next-contact', { agentId: currentUser.id });
            const { contact, campaign } = response.data;
            if (contact && campaign) {
                setCurrentContact(contact);
                setCurrentCampaign(campaign);
                const script = data.savedScripts.find(s => s.id === campaign.scriptId);
                setActiveScript(script || null);
                setStatus('En Appel');
                setStatusTimer(0);
            } else {
                 setFeedbackMessage("Aucun contact disponible pour le moment. Veuillez réessayer plus tard.");
                 setTimeout(() => setFeedbackMessage(null), 3000); // Clear message after 3 seconds
            }
        } catch (error) {
            console.error("Failed to get next contact:", error);
            setFeedbackMessage("Erreur lors de la recherche de contact.");
            setTimeout(() => setFeedbackMessage(null), 3000);
        } finally {
            setIsLoadingNextContact(false);
        }
    }, [currentUser.id, data.savedScripts, isLoadingNextContact, status]);


    const handleEndCall = async () => {
        if (!selectedQual || !currentContact || !currentCampaign) {
            alert("Veuillez sélectionner une qualification avant de terminer l'appel.");
            return;
        }
        
        // ID standard pour "Rappel personnel"
        if (selectedQual === 'std-94') {
            setIsCallbackModalOpen(true);
            return; // On arrête le flux ici, la suite se fera via la modale
        }

        try {
            await apiClient.post(`/contacts/${currentContact.id}/qualify`, {
                qualificationId: selectedQual,
                campaignId: currentCampaign.id,
                agentId: currentUser.id,
            });
            setStatus('En Post-Appel');
            setStatusTimer(0);
        } catch (error) {
            console.error("Failed to qualify contact:", error);
            alert("Erreur lors de la qualification.");
        }
    };

    const handleScheduleAndEndCall = async (scheduledTime: string, notes: string) => {
        if (!currentContact || !currentCampaign || !selectedQual) return;

        try {
            // 1. Save the personal callback
            await apiClient.post(`/contacts/${currentContact.id}/schedule-callback`, {
                agentId: currentUser.id,
                campaignId: currentCampaign.id,
                contactName: `${currentContact.firstName} ${currentContact.lastName}`,
                contactNumber: currentContact.phoneNumber,
                scheduledTime,
                notes,
            });

            // 2. Qualify the contact (original logic from handleEndCall)
            await apiClient.post(`/contacts/${currentContact.id}/qualify`, {
                qualificationId: selectedQual,
                campaignId: currentCampaign.id,
                agentId: currentUser.id,
            });
            
            // 3. Update UI
            setIsCallbackModalOpen(false);
            refreshData(); // To update "Mes Rappels" list
            setStatus('En Post-Appel');
            setStatusTimer(0);

        } catch (error) {
            console.error("Failed to schedule callback and qualify contact:", error);
            alert("Une erreur est survenue lors de la planification du rappel.");
        }
    };

    const handleWrapUp = () => {
        setCurrentContact(null);
        setCurrentCampaign(null);
        setActiveScript(null);
        setSelectedQual(null);
        setNewNote('');
        setStatus('En Attente');
        setStatusTimer(0);
    };
    
    const handleSaveNote = async () => {
        if (!newNote.trim() || !currentContact || !currentCampaign) return;
        try {
            await apiClient.post(`/contacts/${currentContact.id}/notes`, {
                agentId: currentUser.id,
                campaignId: currentCampaign.id,
                note: newNote,
            });
            setNewNote('');
            refreshData(); // Refresh to get the latest notes
        } catch (error) {
            console.error("Failed to save note:", error);
            alert("Erreur lors de la sauvegarde de la note.");
        }
    };

    const qualificationsForCampaign = currentCampaign
        ? data.qualifications.filter(q => q.groupId === currentCampaign.qualificationGroupId || q.isStandard)
        : [];
        
    const contactNotesForCurrentContact = currentContact 
        ? data.contactNotes.filter(note => note.contactId === currentContact.id) 
        : [];

    const myPersonalCallbacks = useMemo(() => 
        data.personalCallbacks.filter(cb => cb.agentId === currentUser.id),
    [data.personalCallbacks, currentUser.id]);

    return (
        <div className="h-screen w-screen flex flex-col font-sans bg-slate-100 text-lg">
             {isProfileModalOpen && (
                <UserProfileModal
                    user={currentUser}
                    onClose={() => setIsProfileModalOpen(false)}
                    onSavePassword={onUpdatePassword}
                    onSaveProfilePicture={onUpdateProfilePicture}
                />
             )}
             <CallbackSchedulerModal 
                isOpen={isCallbackModalOpen}
                onClose={() => setIsCallbackModalOpen(false)}
                onSchedule={handleScheduleAndEndCall}
             />
             <header className="flex-shrink-0 bg-white shadow-md p-3 flex justify-between items-center z-10">
                <button onClick={() => setIsProfileModalOpen(true)} className="flex items-center gap-4 text-left p-2 rounded-md hover:bg-slate-100 transition-colors">
                    {currentUser.profilePictureUrl ? (
                         <img src={currentUser.profilePictureUrl} alt="Avatar" className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                         <UserCircleIcon className="w-10 h-10 text-slate-400" />
                    )}
                    <div>
                        <h1 className="font-bold text-slate-800">Interface Agent</h1>
                        <p className="text-sm text-slate-600">{currentUser.firstName} {currentUser.lastName} - Ext: {currentUser.loginId}</p>
                    </div>
                </button>
                <button onClick={onLogout} className="font-semibold py-2 px-4 rounded-lg inline-flex items-center bg-slate-200 hover:bg-slate-300">
                    <PowerIcon className="w-5 h-5 mr-2" /> Déconnexion
                </button>
            </header>
            
            <main className="flex-1 grid grid-cols-12 gap-4 p-4 overflow-hidden">
                {/* Left Panel */}
                <div className="col-span-3 flex flex-col gap-4">
                     <div className="bg-white p-4 rounded-lg shadow-sm border flex-1">
                        <h2 className="text-xl font-semibold text-slate-800 border-b pb-2 mb-4">Informations Fiche</h2>
                         {currentContact ? (
                            <div className="space-y-2 text-base">
                                <p><span className="font-semibold">Campagne:</span> {currentCampaign?.name}</p>
                                <p><span className="font-semibold">Nom:</span> {currentContact.firstName} {currentContact.lastName}</p>
                                <p><span className="font-semibold">Téléphone:</span> {currentContact.phoneNumber}</p>
                                <p><span className="font-semibold">Code Postal:</span> {currentContact.postalCode}</p>
                            </div>
                        ) : (
                             <div className="h-full flex flex-col items-center justify-center text-center">
                                {feedbackMessage ? (
                                    <p className="text-amber-600 font-semibold">{feedbackMessage}</p>
                                ) : (
                                    <p className="text-slate-500">En attente d'un appel...</p>
                                )}
                                {status === 'En Attente' && (
                                     <button onClick={requestNextContact} disabled={isLoadingNextContact} className="mt-4 bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg shadow-md hover:bg-indigo-700 disabled:bg-indigo-400">
                                        {isLoadingNextContact ? 'Recherche...' : 'Prochain Appel'}
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                     <div className="bg-white p-4 rounded-lg shadow-sm border flex-1 flex flex-col">
                        <h2 className="text-xl font-semibold text-slate-800 border-b pb-2 mb-4">État de l'Agent</h2>
                        <div className="text-center my-auto">
                            <p className="text-4xl font-bold text-indigo-600">{status}</p>
                            <p className="text-6xl font-mono text-slate-700 mt-2">{formatTimer(statusTimer)}</p>
                        </div>
                        <div className="mt-auto grid grid-cols-2 gap-2">
                             <button className="p-3 bg-slate-200 rounded-lg font-semibold hover:bg-slate-300 disabled:opacity-50" disabled={status === 'En Pause'} onClick={() => {setStatus('En Pause'); setStatusTimer(0);}}>
                                <PauseIcon className="w-5 h-5 mx-auto mb-1" />
                                Pause
                            </button>
                            <button className="p-3 bg-green-100 text-green-800 rounded-lg font-semibold hover:bg-green-200 disabled:opacity-50" disabled={status !== 'En Pause'} onClick={() => { setStatus('En Attente'); setStatusTimer(0); }}>
                                <PhoneIcon className="w-5 h-5 mx-auto mb-1" />
                                Prêt
                            </button>
                        </div>
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow-sm border flex-1 flex flex-col">
                        <h2 className="text-xl font-semibold text-slate-800 border-b pb-2 mb-2 flex items-center gap-2">
                            <CalendarDaysIcon className="w-6 h-6 text-indigo-600"/>
                            Mes Rappels Personnels
                        </h2>
                        <div className="flex-1 overflow-y-auto pr-2 space-y-2 text-base">
                            {myPersonalCallbacks.length > 0 ? myPersonalCallbacks.map(cb => (
                                <div key={cb.id} className="p-2 rounded-md bg-slate-50 border">
                                    <p className="font-semibold text-slate-800">{cb.contactName}</p>
                                    <p className="text-sm text-slate-600 font-mono">{cb.contactNumber}</p>
                                    <p className="text-sm font-bold text-indigo-700 mt-1">{new Date(cb.scheduledTime).toLocaleString('fr-FR')}</p>
                                </div>
                            )) : (
                                <p className="text-sm text-slate-500 text-center pt-8 italic">Aucun rappel programmé.</p>
                            )}
                        </div>
                    </div>
                </div>
                {/* Center Panel */}
                <div className="col-span-6 bg-white rounded-lg shadow-sm border">
                     {activeScript && currentContact ? (
                        <AgentPreview
                            script={activeScript}
                            onClose={() => {}} 
                            embedded={true}
                            contact={currentContact}
                            contactNotes={contactNotesForCurrentContact}
                            users={data.users}
                            newNote={newNote}
                            setNewNote={setNewNote}
                            onSaveNote={handleSaveNote}
                            campaign={currentCampaign}
                        />
                    ) : (
                        <div className="h-full flex items-center justify-center text-slate-500">
                             <p>{currentContact ? "Cette campagne n'a pas de script associé." : "Le script s'affichera ici."}</p>
                        </div>
                    )}
                </div>
                {/* Right Panel */}
                <div className="col-span-3 flex flex-col gap-4">
                     <div className="bg-white p-4 rounded-lg shadow-sm border">
                        <h2 className="text-xl font-semibold text-slate-800 border-b pb-2 mb-4">Contrôles d'Appel</h2>
                        <div className="space-y-2">
                             <button className="w-full p-3 bg-red-500 text-white font-bold rounded-lg hover:bg-red-600 disabled:opacity-50" disabled={status !== 'En Appel'} onClick={handleEndCall}>
                                Terminer l'Appel
                            </button>
                             <button className="w-full p-3 bg-slate-200 font-semibold rounded-lg hover:bg-slate-300 disabled:opacity-50" disabled={status !== 'En Appel'}>Mettre en attente</button>
                            <button className="w-full p-3 bg-slate-200 font-semibold rounded-lg hover:bg-slate-300 disabled:opacity-50" disabled={status !== 'En Appel'}>Transférer</button>
                        </div>
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow-sm border flex-1 flex flex-col">
                        <h2 className="text-xl font-semibold text-slate-800 border-b pb-2 mb-4">Qualifications</h2>
                        <div className="flex-1 overflow-y-auto pr-2 space-y-2">
                           {qualificationsForCampaign.map(q => (
                                <button
                                    key={q.id}
                                    onClick={() => setSelectedQual(q.id)}
                                    disabled={status === 'En Attente'}
                                    className={`w-full text-left p-3 rounded-md border font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${selectedQual === q.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white hover:bg-slate-50 border-slate-300'}`}
                                >
                                    [{q.code}] {q.description}
                                </button>
                           ))}
                        </div>
                         <button className="mt-4 w-full p-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50" disabled={status !== 'En Post-Appel'} onClick={handleWrapUp}>
                            Finaliser
                        </button>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default AgentView;