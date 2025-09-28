import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { User, Campaign, Contact, Qualification, SavedScript, QualificationGroup, ContactNote, PersonalCallback, AgentStatus } from '../types.ts';
import { PowerIcon, PhoneIcon, UserCircleIcon, PauseIcon, CalendarDaysIcon, ComputerDesktopIcon, SunIcon, MoonIcon, ChevronDownIcon, ArrowLeftIcon, ArrowRightIcon } from './Icons.tsx';
import AgentPreview from './AgentPreview.tsx';
import UserProfileModal from './UserProfileModal.tsx';
import apiClient from '../src/lib/axios.ts';
import { useI18n } from '../src/i18n/index.tsx';

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

type Theme = 'light' | 'dark' | 'system';

interface AgentViewProps {
    currentUser: User;
    onLogout: () => void;
    data: AgentData;
    refreshData: () => Promise<void>;
    onUpdatePassword: (passwordData: any) => Promise<void>;
    onUpdateProfilePicture: (base64DataUrl: string) => Promise<void>;
    theme: Theme;
    setTheme: (theme: Theme) => void;
    agentStatus: AgentStatus | undefined;
}

type LocalAgentStatus = 'En Attente' | 'En Appel' | 'En Post-Appel' | 'En Pause';

// --- Reusable Components (copied from Header.tsx for localization) ---
const Clock: React.FC = () => {
    const [time, setTime] = useState(new Date());
    useEffect(() => {
        const timerId = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timerId);
    }, []);
    return <div className="text-sm font-medium text-slate-500 dark:text-slate-400 font-mono">{time.toLocaleDateString('fr-FR')} {time.toLocaleTimeString('fr-FR')}</div>;
};

const ThemeSwitcher: React.FC<{ theme: Theme; setTheme: (theme: Theme) => void; }> = ({ theme, setTheme }) => {
    const { t } = useI18n();
    const options: { name: Theme; icon: React.FC<any>; titleKey: string }[] = [
        { name: 'system', icon: ComputerDesktopIcon, titleKey: 'header.theme.system' },
        { name: 'light', icon: SunIcon, titleKey: 'header.theme.light' },
        { name: 'dark', icon: MoonIcon, titleKey: 'header.theme.dark' },
    ];
    return <div className="flex items-center p-1 space-x-1 bg-slate-100 dark:bg-slate-700 rounded-full">{options.map(option => <button key={option.name} onClick={() => setTheme(option.name)} className={`p-1.5 rounded-full transition-colors ${theme === option.name ? 'bg-white dark:bg-slate-900 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`} title={t(option.titleKey)}><option.icon className="w-5 h-5" /></button>)}</div>;
};

const LanguageSwitcher: React.FC = () => {
    const { language, setLanguage } = useI18n();
    const [isOpen, setIsOpen] = useState(false);
    const languages = [{ code: 'fr', name: 'Français' }, { code: 'en', name: 'English' }];
    const toggleDropdown = () => setIsOpen(!isOpen);
    useEffect(() => {
        const close = () => setIsOpen(false);
        if (isOpen) window.addEventListener('click', close);
        return () => window.removeEventListener('click', close);
    }, [isOpen]);
    const getFlagSrc = (code: string) => code === 'fr' ? '/fr-flag.svg' : '/en-flag.svg';

    return <div className="relative"><button onClick={(e) => { e.stopPropagation(); toggleDropdown(); }} className="flex items-center p-1 space-x-2 bg-slate-100 dark:bg-slate-700 rounded-full text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600"><span className="w-6 h-6 rounded-full overflow-hidden"><img src={getFlagSrc(language)} alt={language} className="w-full h-full object-cover" /></span><span className="hidden sm:inline">{language.toUpperCase()}</span><ChevronDownIcon className="w-4 h-4 text-slate-500 dark:text-slate-400 mr-1" /></button>{isOpen && <div className="absolute right-0 mt-2 w-36 origin-top-right bg-white dark:bg-slate-800 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-20"><div className="py-1">{languages.map(lang => <button key={lang.code} onClick={() => { setLanguage(lang.code); setIsOpen(false); }} className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"><img src={getFlagSrc(lang.code)} alt={lang.name} className="w-5 h-auto rounded-sm" />{lang.name}</button>)}</div></div>}</div>;
}

const ToggleSwitch: React.FC<{ enabled: boolean; onChange: (enabled: boolean) => void; disabled?: boolean }> = ({ enabled, onChange, disabled = false }) => (
    <button type="button" onClick={() => !disabled && onChange(!enabled)} className={`${enabled ? 'bg-primary' : 'bg-slate-200'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out`} role="switch" aria-checked={enabled} disabled={disabled}>
        <span aria-hidden="true" className={`${enabled ? 'translate-x-5' : 'translate-x-0'} pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`} />
    </button>
);

const getStatusColor = (status: AgentStatus | undefined): string => {
    if (!status) return 'bg-slate-400';
    switch (status) {
        case 'En Attente': return 'bg-green-500';
        case 'En Appel': return 'bg-red-500';
        case 'En Post-Appel': return 'bg-red-500';
        case 'Ringing': return 'bg-yellow-400';
        case 'En Pause': return 'bg-slate-400';
        default: return 'bg-slate-400';
    }
};


// --- Callback Scheduler Modal ---
const CallbackSchedulerModal: React.FC<{ isOpen: boolean; onClose: () => void; onSchedule: (scheduledTime: string, notes: string) => void; }> = ({ isOpen, onClose, onSchedule }) => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    const defaultDateTime = now.toISOString().slice(0, 16);
    const [scheduledTime, setScheduledTime] = useState(defaultDateTime);
    const [notes, setNotes] = useState('');

    if (!isOpen) return null;

    const handleSubmit = () => {
        if (!scheduledTime) { alert("Veuillez sélectionner une date et une heure."); return; }
        onSchedule(new Date(scheduledTime).toISOString(), notes);
    };

    return (
        <div className="fixed inset-0 bg-slate-800 bg-opacity-75 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
                <div className="p-6"><h3 className="text-lg font-medium text-slate-900">Planifier un Rappel Personnel</h3><div className="mt-4 space-y-4"><div><label className="text-sm font-medium text-slate-700">Date et Heure du Rappel</label><input type="datetime-local" value={scheduledTime} onChange={e => setScheduledTime(e.target.value)} className="mt-1 w-full p-2 border rounded-md"/></div><div><label className="text-sm font-medium text-slate-700">Notes (Optionnel)</label><textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="mt-1 w-full p-2 border rounded-md"/></div></div></div>
                <div className="bg-slate-50 p-3 flex justify-end gap-2"><button onClick={onClose} className="bg-white border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50">Annuler</button><button onClick={handleSubmit} className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700">Planifier et Finaliser</button></div>
            </div>
        </div>
    );
};

const AgentView: React.FC<AgentViewProps> = ({ currentUser, onLogout, data, refreshData, onUpdatePassword, onUpdateProfilePicture, theme, setTheme, agentStatus }) => {
    const [status, setStatus] = useState<LocalAgentStatus>('En Attente');
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
    const [callbacksDate, setCallbacksDate] = useState(new Date());
    const [activeDialingCampaignId, setActiveDialingCampaignId] = useState<string | null>(null);
    
    const assignedCampaigns = useMemo(() => currentUser.campaignIds.map(id => data.campaigns.find(c => c.id === id)).filter((c): c is Campaign => !!c), [currentUser.campaignIds, data.campaigns]);
    
    // FIX: Add effect to set the default active campaign based on the provided logic.
    useEffect(() => {
        if (assignedCampaigns.length > 0 && !activeDialingCampaignId) {
            // Find the first campaign that is active on the admin side.
            const firstActive = assignedCampaigns.find(c => c.isActive);
            if (firstActive) {
                setActiveDialingCampaignId(firstActive.id);
            }
        }
    }, [assignedCampaigns, activeDialingCampaignId]);


    useEffect(() => {
        const interval = setInterval(() => setStatusTimer(prev => prev + 1), 1000);
        return () => clearInterval(interval);
    }, []);

    const formatTimer = (seconds: number) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    const requestNextContact = useCallback(async () => {
        if (isLoadingNextContact || status !== 'En Attente') return;
        if (!activeDialingCampaignId) {
            setFeedbackMessage("Veuillez activer une campagne pour commencer à appeler.");
            setTimeout(() => setFeedbackMessage(null), 3000);
            return;
        }
        setIsLoadingNextContact(true);
        setFeedbackMessage(null);
        try {
            // FIX: Pass the agent's selected active campaign ID to the backend.
            const response = await apiClient.post('/campaigns/next-contact', { agentId: currentUser.id, activeCampaignId: activeDialingCampaignId });
            const { contact, campaign } = response.data;
            if (contact && campaign) {
                setCurrentContact(contact);
                setCurrentCampaign(campaign);
                const script = data.savedScripts.find(s => s.id === campaign.scriptId);
                setActiveScript(script || null);
                setStatus('En Appel');
                setStatusTimer(0);
            } else {
                 const selectedCampaignName = data.campaigns.find(c => c.id === activeDialingCampaignId)?.name || 'la campagne sélectionnée';
                 setFeedbackMessage(`Aucun contact disponible pour ${selectedCampaignName}.`);
                 setTimeout(() => setFeedbackMessage(null), 3000);
            }
        } catch (error) {
            console.error("Failed to get next contact:", error);
            setFeedbackMessage("Erreur lors de la recherche de contact.");
            setTimeout(() => setFeedbackMessage(null), 3000);
        } finally {
            setIsLoadingNextContact(false);
        }
    }, [currentUser.id, data.savedScripts, data.campaigns, isLoadingNextContact, status, activeDialingCampaignId]);

    const handleEndCall = async () => {
        if (!selectedQual || !currentContact || !currentCampaign) {
            alert("Veuillez sélectionner une qualification avant de terminer l'appel.");
            return;
        }
        if (selectedQual === 'std-94') {
            setIsCallbackModalOpen(true);
            return;
        }
        try {
            await apiClient.post(`/contacts/${currentContact.id}/qualify`, { qualificationId: selectedQual, campaignId: currentCampaign.id, agentId: currentUser.id });
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
            await apiClient.post(`/contacts/${currentContact.id}/schedule-callback`, { agentId: currentUser.id, campaignId: currentCampaign.id, contactName: `${currentContact.firstName} ${currentContact.lastName}`, contactNumber: currentContact.phoneNumber, scheduledTime, notes });
            await apiClient.post(`/contacts/${currentContact.id}/qualify`, { qualificationId: selectedQual, campaignId: currentCampaign.id, agentId: currentUser.id });
            setIsCallbackModalOpen(false);
            refreshData();
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
            await apiClient.post(`/contacts/${currentContact.id}/notes`, { agentId: currentUser.id, campaignId: currentCampaign.id, note: newNote });
            setNewNote('');
            await refreshData();
        } catch (error) {
            console.error("Failed to save note:", error);
            alert("Erreur lors de la sauvegarde de la note.");
        }
    };

    const handleCallbackDateChange = (offset: number) => {
        setCallbacksDate(prev => {
            const newDate = new Date(prev);
            newDate.setDate(prev.getDate() + offset);
            return newDate;
        });
    };

    const handleCampaignToggle = (campaignId: string) => {
        setActiveDialingCampaignId(prev => (prev === campaignId ? null : campaignId));
    };

    const qualificationsForCampaign = currentCampaign ? data.qualifications.filter(q => q.groupId === currentCampaign.qualificationGroupId || q.isStandard) : [];
    const contactNotesForCurrentContact = useMemo(() => currentContact ? data.contactNotes.filter(note => note.contactId === currentContact.id) : [], [currentContact, data.contactNotes]);
    const myPersonalCallbacks = useMemo(() => data.personalCallbacks.filter(cb => cb.agentId === currentUser.id && new Date(cb.scheduledTime).toDateString() === callbacksDate.toDateString()), [data.personalCallbacks, currentUser.id, callbacksDate]);
    
    return (
        <div className="h-screen w-screen flex flex-col font-sans bg-slate-100 text-lg dark:bg-slate-900 dark:text-slate-200">
             {isProfileModalOpen && <UserProfileModal user={currentUser} onClose={() => setIsProfileModalOpen(false)} onSavePassword={onUpdatePassword} onSaveProfilePicture={onUpdateProfilePicture} />}
             <CallbackSchedulerModal isOpen={isCallbackModalOpen} onClose={() => setIsCallbackModalOpen(false)} onSchedule={handleScheduleAndEndCall} />
             <header className="flex-shrink-0 bg-white dark:bg-slate-800 shadow-md p-3 flex justify-between items-center z-10">
                <button onClick={() => setIsProfileModalOpen(true)} className="flex items-center gap-4 text-left p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                    <div className="relative">
                        {currentUser.profilePictureUrl ? <img src={currentUser.profilePictureUrl} alt="Avatar" className="w-10 h-10 rounded-full object-cover" /> : <UserCircleIcon className="w-10 h-10 text-slate-400" />}
                        <span className={`absolute top-0 right-0 block h-3.5 w-3.5 rounded-full border-2 border-white dark:border-slate-800 ${getStatusColor(agentStatus)}`}></span>
                    </div>
                    <div>
                        <h1 className="font-bold text-slate-800 dark:text-slate-100">Interface Agent</h1>
                        <p className="text-sm text-slate-600 dark:text-slate-400">{currentUser.firstName} {currentUser.lastName} - Ext: {currentUser.loginId}</p>
                    </div>
                </button>
                <div className="flex items-center gap-4">
                    <Clock />
                    <LanguageSwitcher />
                    <ThemeSwitcher theme={theme} setTheme={setTheme} />
                    <button onClick={onLogout} className="font-semibold py-2 px-4 rounded-lg inline-flex items-center bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"><PowerIcon className="w-5 h-5 mr-2" /> Déconnexion</button>
                </div>
            </header>
            
            <main className="flex-1 grid grid-cols-12 gap-4 p-4 overflow-hidden">
                <div className="col-span-3 flex flex-col gap-4">
                     <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border dark:border-slate-700 flex-1"><h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100 border-b dark:border-slate-600 pb-2 mb-4">Informations Fiche</h2>{currentContact ? <div className="space-y-2 text-base"><p><span className="font-semibold">Campagne:</span> {currentCampaign?.name}</p><p><span className="font-semibold">Nom:</span> {currentContact.firstName} {currentContact.lastName}</p><p><span className="font-semibold">Téléphone:</span> {currentContact.phoneNumber}</p><p><span className="font-semibold">Code Postal:</span> {currentContact.postalCode}</p></div> : <div className="h-full flex flex-col items-center justify-center text-center">{feedbackMessage ? <p className="text-amber-600 font-semibold">{feedbackMessage}</p> : <p className="text-slate-500 dark:text-slate-400">En attente d'un appel...</p>}{status === 'En Attente' && <button onClick={requestNextContact} disabled={isLoadingNextContact} className="mt-4 bg-primary text-primary-text font-bold py-2 px-4 rounded-lg shadow-md hover:bg-primary-hover disabled:opacity-50">{isLoadingNextContact ? 'Recherche...' : 'Prochain Appel'}</button>}</div>}</div>
                     <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border dark:border-slate-700 flex-1 flex flex-col"><h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100 border-b dark:border-slate-600 pb-2 mb-4">État de l'Agent</h2><div className="text-center my-auto"><p className="text-4xl font-bold text-indigo-600 dark:text-indigo-400">{status}</p><p className="text-6xl font-mono text-slate-700 dark:text-slate-300 mt-2">{formatTimer(statusTimer)}</p></div><div className="mt-auto grid grid-cols-2 gap-2"><button className="p-3 bg-slate-200 rounded-lg font-semibold hover:bg-slate-300 disabled:opacity-50 dark:bg-slate-700 dark:hover:bg-slate-600" disabled={status === 'En Pause'} onClick={() => {setStatus('En Pause'); setStatusTimer(0);}}><PauseIcon className="w-5 h-5 mx-auto mb-1" />Pause</button><button className="p-3 bg-green-100 text-green-800 rounded-lg font-semibold hover:bg-green-200 disabled:opacity-50 dark:bg-green-900/50 dark:text-green-200 dark:hover:bg-green-900/80" disabled={status !== 'En Pause'} onClick={() => { setStatus('En Attente'); setStatusTimer(0); }}><PhoneIcon className="w-5 h-5 mx-auto mb-1" />Prêt</button></div></div>
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border dark:border-slate-700 flex-1 flex flex-col"><div className="border-b dark:border-slate-600 pb-2 mb-2 flex items-center justify-between"><h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2"><CalendarDaysIcon className="w-6 h-6 text-indigo-600 dark:text-indigo-400"/>Mes Rappels Personnels</h2><div className="flex items-center gap-1"><button onClick={() => handleCallbackDateChange(-1)} className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700"><ArrowLeftIcon className="w-5 h-5"/></button><span className="text-sm font-semibold w-24 text-center">{callbacksDate.toLocaleDateString('fr-FR', {day: '2-digit', month: 'short'})}</span><button onClick={() => handleCallbackDateChange(1)} className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700"><ArrowRightIcon className="w-5 h-5"/></button></div></div><div className="flex-1 overflow-y-auto pr-2 space-y-2 text-base">{myPersonalCallbacks.length > 0 ? myPersonalCallbacks.map(cb => (<div key={cb.id} className="p-2 rounded-md bg-slate-50 border dark:bg-slate-700 dark:border-slate-600"><p className="font-semibold text-slate-800 dark:text-slate-200">{cb.contactName}</p><p className="text-sm text-slate-600 dark:text-slate-400 font-mono">{cb.contactNumber}</p><p className="text-sm font-bold text-indigo-700 dark:text-indigo-400 mt-1">{new Date(cb.scheduledTime).toLocaleString('fr-FR')}</p></div>)) : (<p className="text-sm text-slate-500 dark:text-slate-400 text-center pt-8 italic">Aucun rappel pour ce jour.</p>)}</div></div>
                </div>
                <div className="col-span-6 bg-white dark:bg-slate-800 rounded-lg shadow-sm border dark:border-slate-700">{activeScript && currentContact ? <AgentPreview script={activeScript} onClose={() => {}} embedded={true} contact={currentContact} contactNotes={contactNotesForCurrentContact} users={data.users} newNote={newNote} setNewNote={setNewNote} onSaveNote={handleSaveNote} campaign={currentCampaign} /> : <div className="h-full flex items-center justify-center text-slate-500 dark:text-slate-400"><p>{currentContact ? "Cette campagne n'a pas de script associé." : "Le script s'affichera ici."}</p></div>}</div>
                <div className="col-span-3 flex flex-col gap-4">
                     <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border dark:border-slate-700"><h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100 border-b dark:border-slate-600 pb-2 mb-4">Contrôles d'Appel</h2><div className="space-y-2"><button className="w-full p-3 bg-red-500 text-white font-bold rounded-lg hover:bg-red-600 disabled:opacity-50" disabled={status !== 'En Appel'} onClick={handleEndCall}>Terminer l'Appel</button><button className="w-full p-3 bg-slate-200 font-semibold rounded-lg hover:bg-slate-300 disabled:opacity-50 dark:bg-slate-700 dark:hover:bg-slate-600" disabled={status !== 'En Appel'}>Mettre en attente</button><button className="w-full p-3 bg-slate-200 font-semibold rounded-lg hover:bg-slate-300 disabled:opacity-50 dark:bg-slate-700 dark:hover:bg-slate-600" disabled={status !== 'En Appel'}>Transférer</button></div></div>
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border dark:border-slate-700 flex-1 flex flex-col">
                        <div className="flex-1 flex flex-col min-h-0">
                            <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100 border-b dark:border-slate-600 pb-2 mb-4 flex-shrink-0">Qualifications</h2>
                            <select value={selectedQual || ''} onChange={e => setSelectedQual(e.target.value)} disabled={status === 'En Attente'} className="w-full p-3 rounded-md border bg-white border-slate-300 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed dark:bg-slate-900 dark:border-slate-600"><option value="">Sélectionner une qualification...</option>{qualificationsForCampaign.map(q => <option key={q.id} value={q.id}>[{q.code}] {q.description}</option>)}</select>
                            
                            <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100 border-b dark:border-slate-600 pb-2 my-4 flex-shrink-0">Campagnes Actives</h2>
                            <div className="flex-1 overflow-y-auto pr-2 space-y-2">
                                {assignedCampaigns.length > 0 ? assignedCampaigns.map(c => (
                                    <div key={c.id} className="flex items-center justify-between p-3 rounded-md border bg-slate-50 dark:bg-slate-700 dark:border-slate-600">
                                        <span className="font-medium text-slate-800 dark:text-slate-200">{c.name}</span>
                                        <ToggleSwitch 
                                            enabled={activeDialingCampaignId === c.id} 
                                            onChange={() => handleCampaignToggle(c.id)}
                                            disabled={!c.isActive}
                                        />
                                    </div>
                                )) : <p className="text-sm text-slate-500 italic text-center">Aucune campagne assignée.</p>}
                            </div>
                        </div>
                         <button className="mt-4 w-full p-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50" disabled={status !== 'En Post-Appel'} onClick={handleWrapUp}>Finaliser</button>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default AgentView;