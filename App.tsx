import React, { useState, useEffect, useCallback, useMemo, useReducer } from 'react';
import type { Feature, User, FeatureId, ModuleVisibility, SavedScript, Campaign, Contact, UserGroup, Site, Qualification, QualificationGroup, IvrFlow, AudioFile, Trunk, Did, BackupLog, BackupSchedule, AgentSession, CallHistoryRecord, SystemLog, VersionInfo, ConnectivityService, ActivityType, PlanningEvent, SystemConnectionSettings, ContactNote, PersonalCallback, AgentState, AgentStatus, ActiveCall, CampaignState, SystemSmtpSettings, SystemAppSettings } from './types.ts';
import { features } from './data/features.ts';
import Sidebar from './components/Sidebar.tsx';
import LoginScreen from './components/LoginScreen.tsx';
import AgentView from './components/AgentView.tsx';
import Header from './components/Header.tsx';
import MonitoringDashboard from './components/MonitoringDashboard.tsx';
import UserProfileModal from './components/UserProfileModal.tsx'; // Import the new modal
import apiClient from './src/lib/axios.ts'; // Utilisation de l'instance Axios configurée
import wsClient from './src/services/wsClient.ts';
import { I18nProvider, useI18n } from './src/i18n/index.tsx';

// Création d'un contexte pour les alertes (toast)
export const AlertContext = React.createContext<{
    showAlert: (message: string, type: 'success' | 'error' | 'info') => void;
}>({ showAlert: () => {} });

// State and Reducer for live data (moved from SupervisionDashboard)
interface LiveState {
    agentStates: AgentState[];
    activeCalls: ActiveCall[];
    campaignStates: CampaignState[];
}

type LiveAction =
    | { type: 'INIT_STATE'; payload: { agents: User[], campaigns: Campaign[] } }
    | { type: 'AGENT_STATUS_UPDATE'; payload: Partial<AgentState> & { agentId: string, status: AgentStatus } }
    | { type: 'NEW_CALL'; payload: ActiveCall }
    | { type: 'CALL_HANGUP'; payload: { callId: string } }
    | { type: 'TICK' };

const initialState: LiveState = {
    agentStates: [],
    activeCalls: [],
    campaignStates: [],
};

function liveDataReducer(state: LiveState, action: LiveAction): LiveState {
    switch (action.type) {
        case 'INIT_STATE': {
            // FIX: Initialize all agents with a 'Déconnecté' status. This ensures only agents
            // who are truly connected and for whom we receive a real-time status update
            // will appear as active in the supervision dashboard.
            const initialAgentStates: AgentState[] = action.payload.agents
                .filter(u => u.role === 'Agent')
                .map(agent => ({
                    ...agent,
                    status: 'Déconnecté',
                    statusDuration: 0,
                    callsHandledToday: 0,
                    averageHandlingTime: 0,
                }));
            const initialCampaignStates: CampaignState[] = action.payload.campaigns.map(c => ({
                id: c.id, name: c.name, status: c.isActive ? 'running' : 'stopped',
                offered: 0, answered: 0, hitRate: 0, agentsOnCampaign: 0,
            }));
            return { agentStates: initialAgentStates, activeCalls: [], campaignStates: initialCampaignStates };
        }
        case 'AGENT_STATUS_UPDATE':
            return {
                ...state,
                agentStates: state.agentStates.map(agent =>
                    agent.id === action.payload.agentId
                        ? { ...agent, status: action.payload.status, statusDuration: 0 } // Reset timer on status change
                        : agent
                ),
            };
        case 'NEW_CALL':
            if (state.activeCalls.some(call => call.id === action.payload.id)) return state;
            return { ...state, activeCalls: [...state.activeCalls, { ...action.payload, duration: 0 }] };
        case 'CALL_HANGUP':
            return { ...state, activeCalls: state.activeCalls.filter(call => call.id !== action.payload.callId) };
        case 'TICK':
             return {
                ...state,
                agentStates: state.agentStates.map(a => ({ ...a, statusDuration: a.statusDuration + 1 })),
                activeCalls: state.activeCalls.map(c => ({ ...c, duration: c.duration + 1 })),
            };
        default:
            return state;
    }
}

type Theme = 'light' | 'dark' | 'system';

interface Notification {
    id: number;
    agentId: string;
    agentName: string;
    agentLoginId: string;
    timestamp: string;
}

const AppContent: React.FC = () => {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [activeFeatureId, setActiveFeatureId] = useState<FeatureId>('outbound');
    const [allData, setAllData] = useState<Record<string, any> & { appSettings?: SystemAppSettings }>({});
    const [isLoading, setIsLoading] = useState(true);
    const [activeView, setActiveView] = useState<'app' | 'monitoring'>('app');
    const [alert, setAlert] = useState<{ message: string; type: 'success' | 'error' | 'info'; key: number } | null>(null);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false); // State for the new modal
    const [liveState, dispatch] = useReducer(liveDataReducer, initialState);
    const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('theme') as Theme) || 'system');
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const { t, language } = useI18n();

     // Effect to apply theme class to <html> element
    useEffect(() => {
        const root = window.document.documentElement;
        const isDark =
            theme === 'dark' ||
            (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
        
        root.classList.toggle('dark', isDark);
        localStorage.setItem('theme', theme);
    }, [theme]);

    useEffect(() => {
        const root = window.document.documentElement;
        root.dir = language === 'ar' ? 'rtl' : 'ltr';
    }, [language]);
    
    // Effect to listen to system theme changes when in 'system' mode
    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        
        const handleChange = () => {
            if (theme === 'system') {
                const root = window.document.documentElement;
                root.classList.toggle('dark', mediaQuery.matches);
            }
        };

        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, [theme]);
    
    // Effect to apply the selected color theme as a data-attribute on the <html> element
    useEffect(() => {
        const root = window.document.documentElement;
        const colorPalette = allData.appSettings?.colorPalette || 'default';
        root.setAttribute('data-theme', colorPalette);
    }, [allData.appSettings?.colorPalette]);

    const showAlert = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
        setAlert({ message, type, key: Date.now() });
    }, []);

    // Effect to automatically hide the alert after a delay
    useEffect(() => {
        if (alert) {
            const timer = setTimeout(() => {
                setAlert(null);
            }, 5000); // Hide after 5 seconds

            return () => clearTimeout(timer);
        }
    }, [alert]);

    const fetchApplicationData = useCallback(async () => {
        try {
            const response = await apiClient.get('/application-data');
            setAllData(response.data);
        } catch (error) {
            console.error("Failed to fetch application data:", error);
            showAlert(t('alerts.appDataLoadError'), 'error');
            // Propagate error to allow callers to handle it
            throw error;
        }
    }, [showAlert, t]);
    
    const handleLogout = useCallback(async () => {
        try {
            await apiClient.post('/auth/logout');
        } catch(e) {
            console.error("Logout API call failed, proceeding with client-side logout.", e);
        } finally {
            localStorage.removeItem('authToken');
            setCurrentUser(null);
            // We keep appSettings in allData so the login screen displays correctly
            setAllData(prev => ({ appSettings: prev.appSettings }));
        }
    }, []);

    // Check for existing token on mount and restore session
    useEffect(() => {
        const loadApp = async () => {
            setIsLoading(true);

            // 1. Always fetch public settings first for the login screen.
            try {
                const configResponse = await apiClient.get('/public-config');
                setAllData(prev => ({ ...prev, appSettings: configResponse.data.appSettings }));
            } catch (e) {
                console.error("Failed to load public config:", e);
                // Set defaults on failure to prevent a broken UI
                setAllData(prev => ({
                    ...prev,
                    appSettings: {
                        companyAddress: '',
                        appLogoUrl: '',
                        colorPalette: 'default',
                        appName: 'Architecte de Solutions',
                    }
                }));
            }
            
            // 2. Then, check for an active session token.
            const token = localStorage.getItem('authToken');
            if (token) {
                try {
                    // Fetch data first, then user. This ensures all data is present before rendering authenticated views.
                    await fetchApplicationData();
                    const meResponse = await apiClient.get('/auth/me');
                    setCurrentUser(meResponse.data.user);
                } catch (error) {
                    console.error("Session check failed:", error);
                    // The refresh token logic in axios interceptor will handle this.
                    // If refresh fails, it will dispatch the logout event.
                }
            }
            
            // 3. Finish loading sequence.
            setIsLoading(false);
        };

        loadApp();
    }, [fetchApplicationData]);

    // Effect to handle logout event from axios interceptor
    useEffect(() => {
        const handleForcedLogout = () => {
            console.log("Logout event received from API client. Logging out.");
            handleLogout();
        };

        window.addEventListener('logoutEvent', handleForcedLogout);

        return () => {
            window.removeEventListener('logoutEvent', handleForcedLogout);
        };
    }, [handleLogout]);

     // Effect to manage WebSocket connection and live data updates
    useEffect(() => {
        if (currentUser && currentUser.role !== 'Agent') {
            const token = localStorage.getItem('authToken');
            if (token) {
                wsClient.connect(token);
            }

            const handleWebSocketMessage = (event: any) => {
                // --- Live Supervision Data Handler ---
                if (['agentStatusUpdate', 'newCall', 'callHangup'].includes(event.type)) {
                     const actionType = event.type.replace(/([A-Z])/g, '_$1').toUpperCase();
                    dispatch({ type: actionType as any, payload: event.payload });
                }
                
                // --- Application State Sync Handler ---
                if (event.type === 'campaignUpdate') {
                     setAllData(prev => {
                        const newCampaigns = prev.campaigns.map((c: Campaign) => c.id === event.payload.id ? event.payload : c);
                        const campaignExists = newCampaigns.some(c => c.id === event.payload.id);
                        if (!campaignExists) newCampaigns.push(event.payload);
                        return { ...prev, campaigns: newCampaigns };
                    });
                }
                
                if (event.type === 'userProfileUpdate') {
                     setAllData(prev => ({
                        ...prev,
                        users: prev.users.map((u: User) => u.id === event.payload.id ? event.payload : u)
                    }));
                    if (currentUser && currentUser.id === event.payload.id) {
                        setCurrentUser(event.payload);
                    }
                }

                // FIX: Added handler for 'agentRaisedHand' event. This was the missing piece
                // to make supervisor notifications work. It receives the event broadcasted by the
                // server and adds it to the local notifications state, which in turn triggers
                // the UI update in the Header component.
                if (event.type === 'agentRaisedHand') {
                     const newNotification: Notification = {
                        ...event.payload,
                        id: Date.now(),
                        timestamp: new Date().toISOString()
                    };
                    setNotifications(prev => [newNotification, ...prev]);
                    // FIX: Re-added the toast notification for immediate feedback, as requested.
                    showAlert(`L'agent ${event.payload.agentName} demande de l'aide !`, 'info');
                }
            };

            const unsubscribe = wsClient.onMessage(handleWebSocketMessage);
            const timer = setInterval(() => dispatch({ type: 'TICK' }), 1000);

            return () => {
                unsubscribe();
                clearInterval(timer);
                wsClient.disconnect();
            };
        }
    }, [currentUser, showAlert]);

    // Effect to initialize live data state once static data is loaded
    useEffect(() => {
        if (allData.users && allData.campaigns) {
            dispatch({ type: 'INIT_STATE', payload: { agents: allData.users, campaigns: allData.campaigns } });
        }
    }, [allData.users, allData.campaigns]);


    const handleLoginSuccess = async ({ user, token }: { user: User, token: string }) => {
        localStorage.setItem('authToken', token);
        try {
            // Fetch data first...
            await fetchApplicationData();
            // ...then set the user to trigger the render.
            setCurrentUser(user);
        } catch (error) {
            // If fetching data fails, log the user out to prevent a broken state
            localStorage.removeItem('authToken');
            setCurrentUser(null);
        }
    };

    const handleSaveOrUpdate = async (dataType: string, data: any, endpoint?: string) => {
        try {
            // A special map because some `dataType` values (for endpoints) don't match `allData` keys (for state).
            const dataTypeToStateKey: { [key: string]: keyof typeof allData } = {
                'users': 'users', 'user-groups': 'userGroups', 'scripts': 'savedScripts',
                'campaigns': 'campaigns', 'qualifications': 'qualifications', 'qualification-groups': 'qualificationGroups',
                'ivr-flows': 'ivrFlows', 'audio-files': 'audioFiles', 'trunks': 'trunks',
                'dids': 'dids', 'sites': 'sites', 'planning-events': 'planningEvents'
            };

            const collectionKey = dataTypeToStateKey[dataType];
            const collection = collectionKey ? allData[collectionKey] : [];
            const itemExistsInState = Array.isArray(collection) ? collection.some((item: any) => item.id === data.id) : false;
            
            // CORRECTED LOGIC: The sole source of truth to determine if an item is new
            // is its absence from the current application state. The format of the ID is irrelevant.
            const isNew = !itemExistsInState;

            const url = endpoint || `/${dataType.toLowerCase()}`;
            
            const response = isNew
                ? await apiClient.post(url, data)
                : await apiClient.put(`${url}/${data.id}`, data);
            
            // FIX: Re-enabled data fetching after mutations. The WebSocket implementation was
            // incomplete, causing the UI to become stale. This ensures the UI always reflects
            // the latest state after any save or update operation.
            await fetchApplicationData();
            showAlert(t('alerts.saveSuccess'), 'success');
            return response.data;
        } catch (error: any) {
            const errorMessage = error.response?.data?.error || t('alerts.saveError');
            console.error(`Failed to save ${dataType}:`, error);
            showAlert(errorMessage, 'error');
            throw error;
        }
    };
    
    // FIX: Corrected the signature and implementation of the `handleDelete` function to accept an optional `endpoint` parameter. This resolves errors where it was called with three arguments instead of the expected two, ensuring that API calls for deletion are made to the correct custom endpoints when provided.
    const handleDelete = async (dataType: string, id: string, endpoint?: string) => {
        if (window.confirm(t('alerts.confirmDelete'))) {
            try {
                const url = endpoint || `/${dataType.toLowerCase()}`;
                await apiClient.delete(`${url}/${id}`);
                await fetchApplicationData(); // Re-fetch on delete is still simplest
                showAlert(t('alerts.deleteSuccess'), 'success');
            } catch (error: any) {
                const errorMessage = error.response?.data?.error || t('alerts.deleteError');
                console.error(`Failed to delete ${dataType}:`, error);
                showAlert(errorMessage, 'error');
            }
        }
    };

    const handleSaveVisibilitySettings = (visibility: ModuleVisibility) => {
        // As there's no backend endpoint, this is a client-side state update for the current session.
        setAllData(prevData => ({
            ...prevData,
            moduleVisibility: visibility,
        }));
        showAlert(t('alerts.visibilitySettingsUpdated'), 'success');
    };

    const handleSaveSmtpSettings = async (settings: SystemSmtpSettings, password?: string) => {
        try {
            const payload: any = { ...settings };
            if (password) {
                payload.password = password;
            }
            await apiClient.put('/system/smtp-settings', payload);
            await fetchApplicationData(); 
            showAlert(t('alerts.smtpSettingsSaved'), 'success');
        } catch (error: any) {
            const errorMessage = error.response?.data?.error || t('alerts.saveError');
            showAlert(errorMessage, 'error');
            throw error;
        }
    };
    
    const handleSaveAppSettings = async (settings: SystemAppSettings) => {
        try {
            await apiClient.put('/system/app-settings', settings);
            // FIX: Update state locally instead of refetching.
            // The backend saves to .env but the running Node process doesn't see the change.
            // This local update ensures the theme is applied instantly.
            setAllData(prevData => ({
                ...prevData,
                appSettings: settings,
            }));
            showAlert(t('alerts.appSettingsSaved'), 'success');
        } catch (error: any) {
            const errorMessage = error.response?.data?.error || t('alerts.saveError');
            showAlert(errorMessage, 'error');
            throw error;
        }
    };

    const handleSaveUser = async (user: User, groupIds: string[]) => {
       await handleSaveOrUpdate('users', { ...user, groupIds });
    };

    const handleBulkUsers = async (users: User[], successMessage: string) => {
        try {
            await apiClient.post('/users/bulk', { users });
            await fetchApplicationData();
            showAlert(successMessage, 'success');
        } catch (error: any) {
            const errorMessage = error.response?.data?.error || t('alerts.bulkCreateError');
            console.error(`Failed to bulk create users:`, error);
            showAlert(errorMessage, 'error');
            throw error;
        }
    };
    
    const handleGenerateUsers = async (users: User[]) => {
        await handleBulkUsers(users, t('alerts.usersGenerated', { count: users.length }));
    };

    const handleImportUsers = async (users: User[]) => {
        await handleBulkUsers(users, t('alerts.usersImported', { count: users.length }));
    };

    const handleImportContacts = async (campaignId: string, contacts: Contact[], deduplicationConfig: { enabled: boolean; fieldIds: string[] }) => {
        try {
            const response = await apiClient.post(`/campaigns/${campaignId}/contacts`, { contacts, deduplicationConfig });
            await fetchApplicationData();
            // The API now returns a detailed summary, which we pass back to the modal.
            return response.data;
        } catch (error: any) {
            const errorMessage = error.response?.data?.error || t('alerts.contactImportError');
            showAlert(errorMessage, 'error');
            // Re-throw the error so the modal knows the operation failed.
            throw new Error(errorMessage);
        }
    };

    const handleUpdatePassword = async (passwordData: any) => {
        try {
            await apiClient.put('/users/me/password', passwordData);
            showAlert(t('alerts.passwordUpdateSuccess'), 'success');
            setIsProfileModalOpen(false);
        } catch (error: any) {
             const errorMessage = error.response?.data?.error || t('alerts.updateError');
            console.error(`Failed to update password:`, error);
            showAlert(errorMessage, 'error');
            throw error; // Rethrow to keep modal open and show error
        }
    };

    const handleUpdateProfilePicture = async (base64DataUrl: string) => {
        try {
            await apiClient.put('/users/me/picture', { pictureUrl: base64DataUrl });
            showAlert(t('alerts.profilePictureUpdateSuccess'), 'success');
            // Refresh all data to get the updated user object everywhere
            await fetchApplicationData(); 
        } catch (error: any) {
            const errorMessage = error.response?.data?.error || t('alerts.updateError');
            showAlert(errorMessage, 'error');
            throw error; // Rethrow to allow modal to handle UI state
        }
    };

    // FIX: Added callback to send agent-initiated status changes to the backend for real-time supervision.
    const handleAgentStatusChange = useCallback((status: 'En Attente' | 'En Appel' | 'En Post-Appel' | 'En Pause') => {
        if (currentUser && currentUser.role === 'Agent') {
            wsClient.send({
                type: 'agentStatusChange',
                payload: { agentId: currentUser.id, status }
            });
        }
    }, [currentUser]);

    const handleRespondToAgent = useCallback((agentId: string, message: string) => {
        wsClient.send({
            type: 'supervisorResponseToAgent',
            payload: { agentId, message }
        });
        showAlert(`Réponse envoyée à l'agent.`, 'success');
    }, []);

    const currentUserStatus: AgentStatus | undefined = useMemo(() => {
        if (!currentUser) return undefined;
        const agentState = liveState.agentStates.find(a => a.id === currentUser.id);
        return agentState?.status;
    }, [currentUser, liveState.agentStates]);


    if (isLoading) {
        return <div className="h-screen w-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">{t('common.loading')}...</div>;
    }

    if (!currentUser) {
        return <LoginScreen
            onLoginSuccess={handleLoginSuccess}
            appLogoUrl={allData.appSettings?.appLogoUrl}
            appName={allData.appSettings?.appName}
        />;
    }

    if (currentUser.role === 'Agent') {
        // FIX: The root cause of the blank screen bug is rendering AgentView before its `data` prop is populated.
        // This guard ensures that we show a loading screen until the necessary data is available,
        // providing a robust solution to the race condition. `allData.campaigns` is used as a proxy
        // to check if the main data fetch is complete.
        if (!allData.campaigns) {
             return <div className="h-screen w-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">Chargement de l'interface agent...</div>;
        }
        return <AgentView 
            currentUser={currentUser} 
            onLogout={handleLogout} 
            data={allData as any} 
            refreshData={fetchApplicationData}
            onUpdatePassword={handleUpdatePassword}
            onUpdateProfilePicture={handleUpdateProfilePicture}
            theme={theme}
            setTheme={setTheme}
            agentStatus={currentUserStatus}
            onStatusChange={handleAgentStatusChange}
        />;
    }

    const activeFeature = features.find(f => f.id === activeFeatureId) || null;
    const FeatureComponent = activeFeature?.component;

    const renderFeatureComponent = () => {
        if (!FeatureComponent) return null;

        const componentProps = {
            ...allData,
            // FIX: Conditionally spread liveState only for components that need it.
            // This prevents components like Reporting from re-rendering every second.
            ...( (activeFeatureId === 'supervision' || activeFeatureId === 'monitoring') && liveState),
            features: features, // Pass the main features array to all components
            feature: activeFeature,
            currentUser,
            onSaveUser: handleSaveUser,
            onDeleteUser: (id: string) => handleDelete('users', id),
            onGenerateUsers: handleGenerateUsers,
            onImportUsers: handleImportUsers,
            onSaveUserGroup: (group: UserGroup) => handleSaveOrUpdate('user-groups', group),
            onDeleteUserGroup: (id: string) => handleDelete('user-groups', id),
            onSaveOrUpdateScript: (script: SavedScript) => handleSaveOrUpdate('scripts', script),
            onDeleteScript: (id: string) => handleDelete('scripts', id),
            onDuplicateScript: async (id: string) => { await apiClient.post(`/scripts/${id}/duplicate`); await fetchApplicationData(); },
            onSaveCampaign: (campaign: Campaign) => handleSaveOrUpdate('campaigns', campaign),
            onDeleteCampaign: (id: string) => handleDelete('campaigns', id),
            onImportContacts: handleImportContacts,
            onSaveQualification: (q: Qualification) => handleSaveOrUpdate('qualifications', q),
            onDeleteQualification: (id: string) => handleDelete('qualifications', id),
            onSaveQualificationGroup: (group: QualificationGroup, assignedQualIds: string[]) => handleSaveOrUpdate('qualification-groups', { ...group, assignedQualIds }, '/qualification-groups/groups'),
            onDeleteQualificationGroup: (id: string) => handleDelete('qualification-groups', id, '/qualification-groups/groups'),
            onSaveOrUpdateIvrFlow: (flow: IvrFlow) => handleSaveOrUpdate('ivr-flows', flow),
            onDeleteIvrFlow: (id: string) => handleDelete('ivr-flows', id),
            onDuplicateIvrFlow: async (id: string) => { await apiClient.post(`/ivr-flows/${id}/duplicate`); await fetchApplicationData(); },
            onSaveAudioFile: (file: AudioFile) => handleSaveOrUpdate('audio-files', file),
            onDeleteAudioFile: (id: string) => handleDelete('audio-files', id),
            onSaveTrunk: (trunk: Trunk) => handleSaveOrUpdate('trunks', trunk, '/telephony/trunks'),
            onDeleteTrunk: (id: string) => handleDelete('trunks', id, '/telephony/trunks'),
            onSaveDid: (did: Did) => handleSaveOrUpdate('dids', did, '/telephony/dids'),
            onDeleteDid: (id: string) => handleDelete('dids', id, '/telephony/dids'),
            onSaveSite: (site: Site) => handleSaveOrUpdate('sites', site),
            onDeleteSite: (id: string) => handleDelete('sites', id),
            onSavePlanningEvent: (event: PlanningEvent) => handleSaveOrUpdate('planning-events', event),
            onDeletePlanningEvent: (id: string) => handleDelete('planning-events', id),
            onSaveVisibilitySettings: handleSaveVisibilitySettings,
            onSaveSmtpSettings: handleSaveSmtpSettings,
            onSaveAppSettings: handleSaveAppSettings,
            apiCall: apiClient, // Passe l'instance axios configurée
        };
        
        return <FeatureComponent {...componentProps} />;
    };
    
     const AlertComponent = () => {
        if (!alert) return null;
        const colors = {
            success: 'bg-green-100 border-green-500 text-green-700 dark:bg-green-900/50 dark:border-green-700 dark:text-green-200',
            error: 'bg-red-100 border-red-500 text-red-700 dark:bg-red-900/50 dark:border-red-700 dark:text-red-200',
            info: 'bg-blue-100 border-blue-500 text-blue-700 dark:bg-blue-900/50 dark:border-blue-700 dark:text-blue-200',
        };
        return (
            <div key={alert.key} className={`fixed bottom-5 right-5 p-4 border-l-4 rounded-md shadow-lg animate-fade-in-up ${colors[alert.type]}`}>
                {alert.message}
            </div>
        );
    };

    return (
        <AlertContext.Provider value={{ showAlert }}>
            <div className="h-screen w-screen flex flex-col font-sans bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200">
                {isProfileModalOpen && (
                    <UserProfileModal
                        user={currentUser}
                        onClose={() => setIsProfileModalOpen(false)}
                        onSavePassword={handleUpdatePassword}
                        onSaveProfilePicture={handleUpdateProfilePicture}
                    />
                )}
                <div className="flex flex-1 min-h-0">
                    <Sidebar
                        features={features}
                        activeFeatureId={activeFeatureId}
                        onSelectFeature={(id) => { setActiveFeatureId(id); setActiveView('app'); }}
                        currentUser={currentUser}
                        onLogout={handleLogout}
                        moduleVisibility={allData.moduleVisibility || { categories: {}, features: {} }}
                        agentStatus={currentUserStatus}
                        onOpenProfile={() => setIsProfileModalOpen(true)}
                        appLogoUrl={allData.appSettings?.appLogoUrl}
                        appName={allData.appSettings?.appName}
                    />
                    <div className="flex-1 flex flex-col min-w-0">
                        <Header 
                            activeView={activeView} 
                            onViewChange={setActiveView} 
                            theme={theme}
                            setTheme={setTheme}
                            notifications={notifications}
                            onClearNotifications={() => setNotifications([])}
                            onRespondToAgent={handleRespondToAgent}
                        />
                        <main className="flex-1 overflow-y-auto p-8">
                             {activeView === 'app' ? renderFeatureComponent() : <MonitoringDashboard {...({ ...allData, ...liveState, apiCall: apiClient } as any)} />}
                        </main>
                    </div>
                </div>
                 {alert && <AlertComponent />}
            </div>
        </AlertContext.Provider>
    );
};

const App: React.FC = () => (
    <I18nProvider>
        <AppContent />
    </I18nProvider>
);

export default App;