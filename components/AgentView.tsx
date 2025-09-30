import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { User, Campaign, Contact, Qualification, SavedScript, QualificationGroup, ContactNote, PersonalCallback, AgentStatus, AgentState } from '../types.ts';
import { PowerIcon, PhoneIcon, UserCircleIcon, PauseIcon, CalendarDaysIcon, ComputerDesktopIcon, SunIcon, MoonIcon, ChevronDownIcon, ArrowLeftIcon, ArrowRightIcon, HandRaisedIcon, XMarkIcon, BellAlertIcon } from './Icons.tsx';
import AgentPreview from './AgentPreview.tsx';
import UserProfileModal from './UserProfileModal.tsx';
import apiClient from '../src/lib/axios.ts';
import { useI18n } from '../src/i18n/index.tsx';
import wsClient from '../src/services/wsClient.ts';

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

type LocalAgentStatus = 'En Attente' | 'En Appel' | 'En Post-Appel' | 'En Pause';

interface SupervisorNotification {
    id: number;
    from: string;
    message: string;
    timestamp: string;
}

interface AgentViewProps {
    currentUser: User;
    onLogout: () => void;
    data: AgentData;
    refreshData: () => Promise<void>;
    onUpdatePassword: (passwordData: any) => Promise<void>;
    onUpdateProfilePicture: (base64DataUrl: string) => Promise<void>;
    onUpdateContact: (contact: Contact) => Promise<void>;
    theme: Theme;
    setTheme: (theme: Theme) => void;
    agentState: AgentState | undefined;
    onStatusChange: (status: LocalAgentStatus) => void;
}


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
    if (!status) return 'bg-gray-400';
    switch (status) {
        case 'En Attente': return 'bg-green-500'; // READY
        case 'En Appel': return 'bg-red-500'; // BUSY
        case 'En Post-Appel': return 'bg-yellow-500'; // WRAPUP
        case 'Ringing': return 'bg-blue-500'; // RINGING
        case 'En Pause': return 'bg-orange-500'; // PAUSE
        case 'Mise en attente': return 'bg-purple-500'; // ONHOLD
        case 'Déconnecté': return 'bg-gray-500'; // LOGGEDOUT
        default: return 'bg-gray-400'; // OFFLINE as default
    }
};


// --- Callback Scheduler Modal ---
const CallbackSchedulerModal: React.FC<{ isOpen: boolean; onClose: () => void; onSchedule: (scheduledTime: string, notes: string) => void; }> = ({ isOpen, onClose, onSchedule }) => {
    const now = new Date();
    // Add a minute to ensure the minimum time is slightly in the future
    now.setMinutes(now.getMinutes() + 1); 
    // Adjust for timezone offset to get local time in ISO format for the input
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    const minDateTime = now.toISOString().slice(0, 16);
    
    const [scheduledTime, setScheduledTime] = useState(minDateTime);
    const [notes, setNotes] = useState('');

    if (!isOpen) return null;

    const handleSubmit = () => {
        if (!scheduledTime) { alert("Veuillez sélectionner une date et une heure."); return; }
        onSchedule(new Date(scheduledTime).toISOString(), notes);
    };

    return (
        <div className="fixed inset-0 bg-slate-800 bg-opacity-75 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
                <div className="p-6"><h3 className="text-lg font-medium text-slate-900">Planifier un Rappel Personnel</h3><div className="mt-4 space-y-4"><div><label className="text-sm font-medium text-slate-700">Date et Heure du Rappel</label><input type="datetime-local" value={scheduledTime} onChange={e => setScheduledTime(e.target.value)} min={minDateTime} className="mt-1 w-full p-2 border rounded-md"/></div><div><label className="text-sm font-medium text-slate-700">Notes (Optionnel)</label><textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="mt-1 w-full p-2 border rounded-md"/></div></div></div>
                <div className="bg-slate-50 p-3 flex justify-end gap-2"><button onClick={onClose} className="bg-white border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50">Annuler</button><button onClick={handleSubmit} className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700">Planifier et Finaliser</button></div>
            </div>
        </div>
    );
};

const statusToI18nKey = (status: AgentStatus): string => {
    const map: Record<AgentStatus, string> = {
        'En Attente': 'agentView.statuses.waiting',
        'En Appel': 'agentView.statuses.onCall',
        'En Post-Appel': 'agentView.statuses.wrapUp',
        'En Pause': 'agentView.statuses.onPause',
        'Ringing': 'agentView.statuses.ringing',
        'Déconnecté': 'agentView.statuses.disconnected',
        'Mise en attente': 'agentView.statuses.onHold',
    };
    return map[status] || status;
};


const AgentView: React.FC<AgentViewProps> = ({ currentUser, onLogout, data, refreshData, onUpdatePassword, onUpdateProfilePicture, onUpdateContact, theme, setTheme, agentState, onStatusChange }) => {
    const { t } = useI18n();
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
    const [agentNotifications, setAgentNotifications] = useState<SupervisorNotification[]>([]);
    const [isAgentNotifOpen, setIsAgentNotifOpen] = useState(false);
    const [activeReplyId, setActiveReplyId] = useState<number | null>(null);
    const [replyText, setReplyText] = useState('');
    const [isDialOptionsOpen, setIsDialOptionsOpen] = useState(false);
    const dialOptionsRef = useRef<HTMLDivElement>(null);

    
    const assignedCampaigns = useMemo(() => currentUser.campaignIds.map(id => data.campaigns.find(c => c.id === id)).filter((c): c is Campaign => !!c), [currentUser.campaignIds, data.campaigns]);
    
    useEffect(() => {
        if (assignedCampaigns.length > 0 && !activeDialingCampaignId) {
            const firstActive = assignedCampaigns.find(c => c.isActive);
            if (firstActive) {
                setActiveDialingCampaignId(firstActive.id);
            }
        }
    }, [assignedCampaigns, activeDialingCampaignId]);

    useEffect(() => {
        if (activeDialingCampaignId) {
            const campaign = data.campaigns.find(c => c.id === activeDialingCampaignId);
            if (!campaign || !campaign.isActive) {
                setActiveDialingCampaignId(null);
                const newActiveCampaign = assignedCampaigns.find(c => c.isActive);
                if (newActiveCampaign) {
                    setActiveDialingCampaignId(newActiveCampaign.id);
                }
            }
        }
    }, [data.campaigns, activeDialingCampaignId, assignedCampaigns]);

    useEffect(() => {
        const interval = setInterval(() => setStatusTimer(prev => prev + 1), 1000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const token = localStorage.getItem('authToken');
        if (token) {
            wsClient.connect(token);
        }

        const handleWebSocketMessage = (event: any) => {
            if (event.type === 'supervisorMessage') {
                const newNotif: SupervisorNotification = {
                    id: Date.now(),
                    from: event.payload.from,
                    message: event.payload.message,
                    timestamp: new Date().toISOString()
                };
                setAgentNotifications(prev => [newNotif, ...prev]);
            }
        };

        const unsubscribe = wsClient.onMessage(handleWebSocketMessage);
        return () => {
            unsubscribe();
            wsClient.disconnect();
        };
    }, []);

    const changeStatus = useCallback((newStatus: LocalAgentStatus) => {
        setStatus(newStatus);
        setStatusTimer(0);
        onStatusChange(newStatus);
    }, [onStatusChange]);

    useEffect(() => {
        // Sync local currentContact state when the global data prop updates
        if (currentContact && currentCampaign && data.campaigns) {
            const campaign = data.campaigns.find(c => c.id === currentCampaign.id);
            const updatedContact = campaign?.contacts.find(c => c.id === currentContact.id);
            // Check for actual changes to prevent re-render loops
            if (updatedContact && JSON.stringify(updatedContact) !== JSON.stringify(currentContact)) {
                setCurrentContact(updatedContact);
            }
        }
    }, [data.campaigns, currentContact, currentCampaign]);

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
            const response = await apiClient.post('/campaigns/next-contact', { agentId: currentUser.id, activeCampaignId: activeDialingCampaignId });
            const { contact, campaign } = response.data;
            if (contact && campaign) {
                setCurrentContact(contact);
                setCurrentCampaign(campaign);
                const script = data.savedScripts.find(s => s.id === campaign.scriptId);
                setActiveScript(script || null);
                
                // Ne lance l'appel automatiquement que pour les modes non-manuels
                if (campaign.dialingMode !== 'MANUAL') {
                    // La logique de dial réelle serait ici, pour l'instant on simule en changeant l'état
                    changeStatus('En Appel');
                }
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
    }, [currentUser.id, data.savedScripts, data.campaigns, isLoadingNextContact, status, activeDialingCampaignId, changeStatus]);

    const handleWrapUp = useCallback(() => {
        const lastCampaignMode = currentCampaign?.dialingMode; // Capture mode before clearing state

        setCurrentContact(null);
        setCurrentCampaign(null);
        setActiveScript(null);
        setSelectedQual(null);
        setNewNote('');
        changeStatus('En Attente');
        
        // Automatically request next contact for non-manual modes
        if (lastCampaignMode && lastCampaignMode !== 'MANUAL') {
            // Use a short timeout to allow the state update to render before fetching.
            setTimeout(() => {
                requestNextContact();
            }, 100);
        }
    }, [changeStatus, currentCampaign, requestNextContact]);

    useEffect(() => {
        let wrapUpTimerId: ReturnType<typeof setTimeout>;

        if (status === 'En Post-Appel' && currentCampaign && currentCampaign.wrapUpTime > 0) {
            wrapUpTimerId = setTimeout(() => {
                handleWrapUp();
            }, currentCampaign.wrapUpTime * 1000);
        }

        return () => {
            clearTimeout(wrapUpTimerId);
        };
    }, [status, currentCampaign, handleWrapUp]);

    const handleDial = async (destination: string) => {
        if (!currentContact || !currentCampaign || !destination) return;
        try {
            await apiClient.post('/call/originate', {
                agentId: currentUser.id,
                destination,
                campaignId: currentCampaign.id,
            });
            changeStatus('En Appel');
        } catch (error) {
            console.error("Originate call failed:", error);
            setFeedbackMessage("Échec du lancement de l'appel.");
            setTimeout(() => setFeedbackMessage(null), 3000);
        }
    };


    const handleEndCall = async () => {
        if (!selectedQual || !currentContact || !currentCampaign) {
            alert("Veuillez sélectionner une qualification avant de finaliser.");
            return;
        }
        if (selectedQual === 'std-94') { // Code for "Rappel personnel"
            setIsCallbackModalOpen(true);
            return;
        }
        try {
            await apiClient.post(`/contacts/${currentContact.id}/qualify`, { qualificationId: selectedQual, campaignId: currentCampaign.id, agentId: currentUser.id });
            
            // If wrap-up is 0, immediately become available and trigger next contact if applicable.
            if (currentCampaign.wrapUpTime === 0) {
                handleWrapUp();
            } else {
                // Otherwise, go into post-call state and let the timer handle it.
                changeStatus('En Post-Appel');
            }
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
            changeStatus('En Post-Appel');
        } catch (error) {
            console.error("Failed to schedule callback and qualify contact:", error);
            alert("Une erreur est survenue lors de la planification du rappel.");
        }
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

    const handleRaiseHand = useCallback(() => {
        wsClient.send({
            type: 'agentRaisedHand',
            payload: {
                agentId: currentUser.id,
                agentName: `${currentUser.firstName} ${currentUser.lastName}`,
                agentLoginId: currentUser.loginId
            }
        });
        setFeedbackMessage("Demande d'aide envoyée au superviseur.");
        setTimeout(() => setFeedbackMessage(null), 3000);
    }, [currentUser]);

    const handleRespondToSupervisor = (notificationId: number) => {
        if (!replyText.trim()) return;
        wsClient.send({
            type: 'agentResponseToSupervisor',
            payload: {
                agentName: `${currentUser.firstName} ${currentUser.lastName}`,
                message: replyText
            }
        });
        setReplyText('');
        setActiveReplyId(null);
        setAgentNotifications(prev => prev.filter(n => n.id !== notificationId));
    };
    
    // FIX: Added a handler to clear the contact form for manual entry, which is passed to AgentPreview.
    const handleClearContact = () => {
        setCurrentContact(null);
        // We keep the campaign and script active for the new contact entry.
        setSelectedQual(null);
        setNewNote('');
    };
    
    // FIX: Added handler to load a contact from a personal callback.
    const handleCallbackClick = useCallback((callback: PersonalCallback) => {
        if (status !== 'En Attente') {
            setFeedbackMessage("Veuillez terminer votre tâche actuelle avant de charger un rappel.");
            setTimeout(() => setFeedbackMessage(null), 3000);
            return;
        }

        const campaign = data.campaigns.find(c => c.id === callback.campaignId);
        if (!campaign) {
            console.error(`Campaign ${callback.campaignId} not found for callback.`);
            return;
        }

        const contact = campaign.contacts.find(c => c.id === callback.contactId);
        if (!contact) {
             console.error(`Contact ${callback.contactId} not found for callback.`);
            return;
        }
        
        const script = data.savedScripts.find(s => s.id === campaign.scriptId);
        
        setCurrentContact(contact);
        setCurrentCampaign(campaign);
        setActiveScript(script || null);
        setActiveDialingCampaignId(campaign.id);

    }, [status, data.campaigns, data.savedScripts]);

    const qualificationsForCampaign = currentCampaign ? data.qualifications.filter(q => q.groupId === currentCampaign.qualificationGroupId || q.isStandard) : [];
    const contactNotesForCurrentContact = useMemo(() => currentContact ? data.contactNotes.filter(note => note.contactId === currentContact.id) : [], [currentContact, data.contactNotes]);
    const myPersonalCallbacks = useMemo(() => data.personalCallbacks.filter(cb => cb.agentId === currentUser.id && new Date(cb.scheduledTime).toDateString() === callbacksDate.toDateString()), [data.personalCallbacks, currentUser.id, callbacksDate]);
    
    const allPhoneNumbers = useMemo(() => {
        if (!currentContact || !activeScript) return [];
        const phoneBlocks = activeScript.pages.flatMap(p => p.blocks).filter(b => b.type === 'phone' && b.isVisible !== false);
        return phoneBlocks.map(block => {
            let number = '';
            if (block.fieldName === 'phone_number') number = currentContact.phoneNumber;
            else if (currentContact.customFields && currentContact.customFields[block.fieldName]) number = currentContact.customFields[block.fieldName];
            return { name: block.name, number };
        }).filter(p => p.number);
    }, [currentContact, activeScript]);

    const handleMainCallClick = useCallback(() => {
        if (!currentContact) return;
    
        if (allPhoneNumbers.length > 1) {
            setIsDialOptionsOpen(prev => !prev); // Toggle pop-up
        } else {
            setIsDialOptionsOpen(false); // Ensure it's closed
            const numberToDial = allPhoneNumbers.length > 0 ? allPhoneNumbers[0].number : currentContact.phoneNumber;
            handleDial(numberToDial);
        }
    }, [currentContact, allPhoneNumbers, handleDial]);
    
    const matchingQuota = useMemo(() => {
        if (!currentContact || !currentCampaign?.quotaRules) return null;
        
        for (const rule of currentCampaign.quotaRules) {
            const contactValue = (rule.contactField === 'postalCode' ? currentContact.postalCode : currentContact.customFields?.[rule.contactField]) || '';
            let match = false;
            if (rule.operator === 'equals') {
                match = contactValue === rule.value;
            } else if (rule.operator === 'starts_with') {
                match = contactValue.startsWith(rule.value);
            }
            if (match) {
                return {
                    name: `Quota: ${rule.contactField} ${rule.operator} ${rule.value}`,
                    current: rule.currentCount,
                    limit: rule.limit,
                    progress: rule.limit > 0 ? (rule.currentCount / rule.limit) * 100 : 0
                };
            }
        }
        return null;
    }, [currentContact, currentCampaign]);

    const endCallButtonText = status === 'En Appel' ? t('agentView.endCall') : t('agentView.qualifyContact');

    const KpiCard: React.FC<{ title: string; value: string | number; }> = ({ title, value }) => (
        <div className="bg-slate-100 dark:bg-slate-700 p-2 rounded-md">
            <p className="text-xs text-slate-500 dark:text-slate-400">{title}</p>
            <p className="text-xl font-bold text-slate-800 dark:text-slate-200 font-mono text-center">{value}</p>
        </div>
    );

    return (
        <div className="h-screen w-screen flex flex-col font-sans bg-slate-100 text-lg dark:bg-slate-900 dark:text-slate-200">
             {isProfileModalOpen && <UserProfileModal user={currentUser} onClose={() => setIsProfileModalOpen(false)} onSavePassword={onUpdatePassword} onSaveProfilePicture={onUpdateProfilePicture} />}
             <CallbackSchedulerModal isOpen={isCallbackModalOpen} onClose={() => setIsCallbackModalOpen(false)} onSchedule={handleScheduleAndEndCall} />
             <header className="flex-shrink-0 bg-white dark:bg-slate-800 shadow-md p-3 flex justify-between items-center z-10">
                <button onClick={() => setIsProfileModalOpen(true)} className="flex items-center gap-4 text-left p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                    <div className="relative">
                        {currentUser.profilePictureUrl ? <img src={currentUser.profilePictureUrl} alt="Avatar" className="w-10 h-10 rounded-full object-cover" /> : <UserCircleIcon className="w-10 h-10 text-slate-400" />}
                        <span className={`absolute top-0 right-0 block h-3.5 w-3.5 rounded-full border-2 border-white dark:border-slate-800 ${getStatusColor(agentState?.status)}`}></span>
                    </div>
                    <div>
                        <h1 className="font-bold text-slate-800 dark:text-slate-100">{t('agentView.title')}</h1>
                        <p className="text-sm text-slate-600 dark:text-slate-400">{currentUser.firstName} {currentUser.lastName} - Ext: {currentUser.loginId}</p>
                    </div>
                </button>
                <div className="flex items-center gap-4">
                    <Clock />
                    <div className="relative">
                        <button onClick={() => setIsAgentNotifOpen(p => !p)} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400">
                            <BellAlertIcon className="w-6 h-6" />
                            {agentNotifications.length > 0 && (
                                <span className="absolute top-1 right-1 flex h-4 w-4">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 text-white text-xs items-center justify-center">{agentNotifications.length}</span>
                                </span>
                            )}
                        </button>
                        {isAgentNotifOpen && (
                           <div className="absolute right-0 mt-2 w-80 origin-top-right bg-white dark:bg-slate-800 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-20">
                                <div className="p-3 border-b dark:border-slate-700 flex justify-between items-center">
                                    <h3 className="font-semibold text-slate-800 dark:text-slate-200">{t('agentView.messages')}</h3>
                                    {agentNotifications.length > 0 && <button onClick={() => setAgentNotifications([])} className="text-xs font-medium text-indigo-600 hover:underline">{t('agentView.clearAll')}</button>}
                                </div>
                                <div className="max-h-96 overflow-y-auto">
                                    {agentNotifications.length === 0 ? (
                                        <p className="text-sm text-slate-500 text-center p-8">Aucun nouveau message.</p>
                                    ) : (
                                        agentNotifications.map(notif => (
                                            <div key={notif.id} className="p-3 border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700">
                                                <p className="text-sm text-slate-700 dark:text-slate-200"><span className="font-bold">{notif.from}:</span> {notif.message}</p>
                                                <p className="text-xs text-slate-400 mt-1">{new Date(notif.timestamp).toLocaleTimeString()}</p>
                                                {activeReplyId === notif.id ? (
                                                    <form onSubmit={(e) => { e.preventDefault(); handleRespondToSupervisor(notif.id); }} className="mt-2 flex gap-2">
                                                        <input type="text" value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Votre réponse..." autoFocus className="w-full text-sm p-1.5 border rounded-md dark:bg-slate-900 dark:border-slate-600"/>
                                                        <button type="submit" className="text-sm bg-indigo-600 text-white px-3 rounded-md hover:bg-indigo-700">Envoyer</button>
                                                    </form>
                                                ) : (
                                                    <button onClick={() => setActiveReplyId(notif.id)} className="mt-2 text-xs font-semibold text-indigo-600 hover:underline">Répondre</button>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                    <LanguageSwitcher />
                    <ThemeSwitcher theme={theme} setTheme={setTheme} />
                    <button onClick={onLogout} className="font-semibold py-2 px-4 rounded-lg inline-flex items-center bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"><PowerIcon className="w-5 h-5 mr-2" /> Déconnexion</button>
                </div>
            </header>
            
            <main className="flex-1 grid grid-cols-12 gap-4 p-4 overflow-hidden">
                <div className="col-span-3 flex flex-col gap-4">
                     <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border dark:border-slate-700 flex-1 flex flex-col"><h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100 border-b dark:border-slate-600 pb-2 mb-4">Informations</h2><div className="mb-4"><h3 className="text-base font-semibold text-slate-600 dark:text-slate-300">{t('agentView.kpis')}</h3>{agentState ? (<div className="grid grid-cols-2 gap-2 mt-2"><KpiCard title={t('agentView.callsHandled')} value={agentState.callsHandledToday} /><KpiCard title="DMT" value={formatTimer(agentState.averageHandlingTime)} /><KpiCard title="DMC" value={formatTimer(agentState.averageTalkTime)} /><KpiCard title={t('agentView.pauseCount')} value={agentState.pauseCount} /><div className="col-span-2"><KpiCard title={t('agentView.totalPauseTime')} value={formatTimer(agentState.totalPauseTime)} /></div></div>) : <p className="text-xs text-slate-400 italic mt-1">Chargement...</p>}</div>{matchingQuota && (<div className="border-t dark:border-slate-600 pt-4"><h3 className="text-base font-semibold text-slate-600 dark:text-slate-300">Quota Actif</h3><div className="bg-slate-50 dark:bg-slate-700 p-3 rounded-md mt-2"><p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate" title={matchingQuota.name}>{matchingQuota.name}</p><div className="w-full bg-slate-200 dark:bg-slate-600 rounded-full h-2.5 mt-2"><div className="bg-indigo-600 h-2.5 rounded-full" style={{ width: `${matchingQuota.progress}%` }}></div></div><p className="text-xs text-right text-slate-500 dark:text-slate-400 mt-1">{matchingQuota.current} / {matchingQuota.limit}</p></div></div>)}{(!currentContact && status === 'En Attente') && (<div className="flex-1 mt-auto pt-4 border-t dark:border-slate-600"><div className="h-full flex flex-col items-center justify-center text-center">{feedbackMessage ? <p className="text-amber-600 font-semibold">{feedbackMessage}</p> : <p className="text-slate-500 dark:text-slate-400">{t('agentView.waitingForCall')}</p>}<button onClick={requestNextContact} disabled={isLoadingNextContact} className="mt-4 bg-primary text-primary-text font-bold py-2 px-4 rounded-lg shadow-md hover:bg-primary-hover disabled:opacity-50">{isLoadingNextContact ? t('agentView.searching') : t('agentView.nextCall')}</button></div></div>)}</div>
                     <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border dark:border-slate-700 flex-1 flex flex-col"><h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100 border-b dark:border-slate-600 pb-2 mb-4">{t('agentView.status')}</h2><div className="text-center my-auto"><p className="text-4xl font-bold text-indigo-600 dark:text-indigo-400">{t(statusToI18nKey(status as AgentStatus))}</p><p className="text-6xl font-mono text-slate-700 dark:text-slate-300 mt-2">{formatTimer(statusTimer)}</p></div><div className="mt-auto grid grid-cols-2 gap-2"><button className="p-3 bg-slate-200 rounded-lg font-semibold hover:bg-slate-300 disabled:opacity-50 dark:bg-slate-700 dark:hover:bg-slate-600" disabled={status === 'En Pause'} onClick={() => changeStatus('En Pause')}><PauseIcon className="w-5 h-5 mx-auto mb-1" />{t('agentView.pause')}</button><button className="p-3 bg-green-100 text-green-800 rounded-lg font-semibold hover:bg-green-200 disabled:opacity-50 dark:bg-green-900/50 dark:text-green-200 dark:hover:bg-green-900/80" disabled={status !== 'En Pause'} onClick={() => changeStatus('En Attente')}><PhoneIcon className="w-5 h-5 mx-auto mb-1" />{t('agentView.ready')}</button></div></div>
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border dark:border-slate-700 flex-1 flex flex-col"><div className="border-b dark:border-slate-600 pb-2 mb-2 flex items-center justify-between"><h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2"><CalendarDaysIcon className="w-6 h-6 text-indigo-600 dark:text-indigo-400"/>{t('agentView.myCallbacks')}</h2><div className="flex items-center gap-1"><button onClick={() => handleCallbackDateChange(-1)} className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700"><ArrowLeftIcon className="w-5 h-5"/></button><span className="text-sm font-semibold w-24 text-center">{callbacksDate.toLocaleDateString('fr-FR', {day: '2-digit', month: 'short'})}</span><button onClick={() => handleCallbackDateChange(1)} className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700"><ArrowRightIcon className="w-5 h-5"/></button></div></div><div className="flex-1 overflow-y-auto pr-2 space-y-2 text-base">{myPersonalCallbacks.length > 0 ? myPersonalCallbacks.map(cb => (<button key={cb.id} onClick={() => handleCallbackClick(cb)} disabled={status !== 'En Attente'} className="w-full text-left p-2 rounded-md bg-slate-50 border dark:bg-slate-700 dark:border-slate-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/50 hover:border-indigo-300 disabled:opacity-60 disabled:cursor-not-allowed"><p className="font-semibold text-slate-800 dark:text-slate-200">{cb.contactName}</p><p className="text-sm text-slate-600 dark:text-slate-400 font-mono">{cb.contactNumber}</p><p className="text-sm font-bold text-indigo-700 dark:text-indigo-400 mt-1">{new Date(cb.scheduledTime).toLocaleString('fr-FR')}</p></button>)) : (<p className="text-sm text-slate-500 dark:text-slate-400 text-center pt-8 italic">{t('agentView.noCallbacks')}</p>)}</div></div>
                </div>
                <div className="col-span-6 bg-white dark:bg-slate-800 rounded-lg shadow-sm border dark:border-slate-700">{activeScript && currentContact ? <AgentPreview script={activeScript} onClose={() => {}} embedded={true} contact={currentContact} contactNotes={contactNotesForCurrentContact} users={data.users} newNote={newNote} setNewNote={setNewNote} onSaveNote={handleSaveNote} campaign={currentCampaign} onInsertContact={async () => {}} onUpdateContact={onUpdateContact} onClearContact={handleClearContact} /> : <div className="h-full flex items-center justify-center text-slate-500 dark:text-slate-400"><p>{currentContact ? t('agentView.noScript') : t('agentView.scriptWillBeHere')}</p></div>}</div>
                <div className="col-span-3 flex flex-col gap-4">
                     <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border dark:border-slate-700 relative"><h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100 border-b dark:border-slate-600 pb-2 mb-4">{t('agentView.callControls')}</h2><div className="space-y-2"><div className="relative"><button onClick={handleMainCallClick} disabled={!currentContact || status !== 'En Attente' || currentCampaign?.dialingMode !== 'MANUAL'} className="w-full p-3 bg-green-500 text-white font-bold rounded-lg hover:bg-green-600 disabled:opacity-50">{t('agentView.call')}</button>{isDialOptionsOpen && (<div ref={dialOptionsRef} className="absolute right-full top-1/2 -translate-y-1/2 mr-2 w-72 bg-white dark:bg-slate-700 rounded-md shadow-lg border dark:border-slate-600 p-2 z-20 space-y-1">{allPhoneNumbers.map((phone, index) => (<button key={index} onClick={() => { handleDial(phone.number); setIsDialOptionsOpen(false); }} className="w-full text-left p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-600">{t('agentView.callNumber', { phoneName: phone.name })} <span className="text-sm text-slate-500 dark:text-slate-400">({phone.number})</span></button>))}</div>)}</div><button className="w-full p-3 bg-red-500 text-white font-bold rounded-lg hover:bg-red-600 disabled:opacity-50" disabled={!currentContact || !selectedQual} onClick={handleEndCall}>{endCallButtonText}</button><button className="w-full p-3 bg-slate-200 font-semibold rounded-lg hover:bg-slate-300 disabled:opacity-50 dark:bg-slate-700 dark:hover:bg-slate-600" disabled={status !== 'En Appel'}>{t('agentView.hold')}</button><button className="w-full p-3 bg-slate-200 font-semibold rounded-lg hover:bg-slate-300 disabled:opacity-50 dark:bg-slate-700 dark:hover:bg-slate-600" disabled={status !== 'En Appel'}>{t('agentView.transfer')}</button><button onClick={handleRaiseHand} disabled={status === 'En Pause'} className="w-full p-3 bg-amber-500 text-white font-bold rounded-lg hover:bg-amber-600 disabled:opacity-50 inline-flex items-center justify-center gap-2"><HandRaisedIcon className="w-5 h-5"/>{t('agentView.askForHelp')}</button></div></div>
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border dark:border-slate-700 flex-1 flex flex-col">
                        <div className="flex-1 flex flex-col min-h-0">
                            <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100 border-b dark:border-slate-600 pb-2 mb-4 flex-shrink-0">{t('agentView.qualifications')}</h2>
                            <select value={selectedQual || ''} onChange={e => setSelectedQual(e.target.value)} disabled={!currentContact} className="w-full p-3 rounded-md border bg-white border-slate-300 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed dark:bg-slate-900 dark:border-slate-600"><option value="">{t('agentView.selectQualification')}</option>{qualificationsForCampaign.map(q => <option key={q.id} value={q.id}>[{q.code}] {q.description}</option>)}</select>
                            
                            <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100 border-b dark:border-slate-600 pb-2 my-4 flex-shrink-0">{t('agentView.activeCampaigns')}</h2>
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
                                )) : <p className="text-sm text-slate-500 italic text-center">{t('agentView.noCampaigns')}</p>}
                            </div>
                        </div>
                         <button className="mt-4 w-full p-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50" disabled={status !== 'En Post-Appel'} onClick={handleWrapUp}>{t('agentView.finalize')}</button>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default AgentView;