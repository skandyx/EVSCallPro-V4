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
    | { type: 'AGENT_STATUS_UPDATE'; payload: Partial<AgentState> & { agentId: string } }
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
            const initialAgentStates: AgentState[] = action.payload.agents
                .filter(u => u.role === 'Agent')
                .map(agent => ({
                    ...agent,
                    status: 'En Attente',
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
                        ? { ...agent, ...action.payload, statusDuration: 0 } // Reset timer on status change
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

const App: React.FC = () => {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [activeFeatureId, setActiveFeatureId] = useState<FeatureId>('users');
    const [allData, setAllData] = useState<Record<string, any> & { appSettings?: SystemAppSettings }>({});
    const [isLoading, setIsLoading] = useState(true);
    const [activeView, setActiveView] = useState<'app' | 'monitoring'>('app');
    const [alert, setAlert] = useState<{ message: string; type: 'success' | 'error' | 'info'; key: number } | null>(null);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false); // State for the new modal
    const [liveState, dispatch] = useReducer(liveDataReducer, initialState);
    const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('theme') as Theme) || 'system');

     // Effect to apply theme class to <html> element
    useEffect(() => {
        const root = window.document.documentElement;
        const isDark =
            theme === 'dark' ||
            (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
        
        root.classList.toggle('dark', isDark);
        localStorage.setItem('theme', theme);
    }, [theme]);
    
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
    
    // Effect to inject dynamic color palette styles
    useEffect(() => {
        const appSettings = allData.appSettings;
        if (appSettings) {
            let styleElement = document.getElementById('app-theme-styles');
            if (!styleElement) {
                styleElement = document.createElement('style');
                styleElement.id = 'app-theme-styles';
                document.head.appendChild(styleElement);
            }

            const palette = appSettings.colorPalette || 'default';
            const palettes = {
                default: { // Indigo
                    '--color-primary-600': '79 70 229',
                    '--color-primary-700': '67 56 202',
                    '--color-sidebar-active-bg': '#eeefff',
                    '--color-sidebar-active-text': '#4338ca',
                    '--color-sidebar-active-dark-bg': 'rgba(79, 70, 229, 0.2)',
                    '--color-sidebar-active-dark-text': '#a5b4fc',
                    '--color-link-text-light': '#4f46e5',
                    '--color-link-text-dark': '#a5b4fc',
                },
                forest: { // Green
                    '--color-primary-600': '22 163 74',
                    '--color-primary-700': '21 128 61',
                    '--color-sidebar-active-bg': '#f0fdf4',
                    '--color-sidebar-active-text': '#166534',
                    '--color-sidebar-active-dark-bg': 'rgba(34, 197, 94, 0.2)',
                    '--color-sidebar-active-dark-text': '#86efac',
                    '--color-link-text-light': '#16a34a',
                    '--color-link-text-dark': '#86efac',
                },
                ocean: { // Blue
                    '--color-primary-600': '37 99 235',
                    '--color-primary-700': '29 78 216',
                    '--color-sidebar-active-bg': '#eff6ff',
                    '--color-sidebar-active-text': '#1e3a8a',
                    '--color-sidebar-active-dark-bg': 'rgba(59, 130, 246, 0.2)',
                    '--color-sidebar-active-dark-text': '#93c5fd',
                    '--color-link-text-light': '#2563eb',
                    '--color-link-text-dark': '#93c5fd',
                },
                sunset: { // Orange
                    '--color-primary-600': '234 88 12',
                    '--color-primary-700': '194 65 12',
                    '--color-sidebar-active-bg': '#fff7ed',
                    '--color-sidebar-active-text': '#9a3412',
                    '--color-sidebar-active-dark-bg': 'rgba(249, 115, 22, 0.2)',
                    '--color-sidebar-active-dark-text': '#fdba74',
                    '--color-link-text-light': '#f97316',
                    '--color-link-text-dark': '#fdba74',
                },
                slate: { // Slate
                    '--color-primary-600': '71 85 105',
                    '--color-primary-700': '51 65 85',
                    '--color-sidebar-active-bg': '#f1f5f9',
                    '--color-sidebar-active-text': '#334155',
                    '--color-sidebar-active-dark-bg': 'rgba(100, 116, 139, 0.2)',
                    '--color-sidebar-active-dark-text': '#cbd5e1',
                    '--color-link-text-light': '#475569',
                    '--color-link-text-dark': '#94a3b8',
                },
                rose: { // Rose
                    '--color-primary-600': '225 29 72',
                    '--color-primary-700': '190 18 60',
                    '--color-sidebar-active-bg': '#fff1f2',
                    '--color-sidebar-active-text': '#9f1239',
                    '--color-sidebar-active-dark-bg': 'rgba(244, 63, 94, 0.2)',
                    '--color-sidebar-active-dark-text': '#fda4af',
                    '--color-link-text-light': '#e11d48',
                    '--color-link-text-dark': '#fb7185',
                },
                amber: { // Amber
                    '--color-primary-600': '217 119 6',
                    '--color-primary-700': '180 83 9',
                    '--color-sidebar-active-bg': '#fffbeb',
                    '--color-sidebar-active-text': '#92400e',
                    '--color-sidebar-active-dark-bg': 'rgba(245, 158, 11, 0.2)',
                    '--color-sidebar-active-dark-text': '#fcd34d',
                    '--color-link-text-light': '#d97706',
                    '--color-link-text-dark': '#fbbf24',
                },
                cyan: { // Cyan
                    '--color-primary-600': '8 145 178',
                    '--color-primary-700': '14 116 144',
                    '--color-sidebar-active-bg': '#ecfeff',
                    '--color-sidebar-active-text': '#155e75',
                    '--color-sidebar-active-dark-bg': 'rgba(6, 182, 212, 0.2)',
                    '--color-sidebar-active-dark-text': '#67e8f9',
                    '--color-link-text-light': '#0891b2',
                    '--color-link-text-dark': '#22d3ee',
                }
            };

            const selectedPalette = palettes[palette] || palettes.default;
            const css = `
                :root {
                    ${Object.entries(selectedPalette).map(([key, value]) => `${key}: ${value};`).join('\n')}
                }
                .bg-primary { background-color: rgb(var(--color-primary-600)); }
                .hover\\:bg-primary-hover:hover { background-color: rgb(var(--color-primary-700)); }
                .text-primary-text { color: white; }
                .bg-sidebar-active { background-color: var(--color-sidebar-active-bg); }
                .text-sidebar-active-text { color: var(--color-sidebar-active-text); }
                .dark .bg-sidebar-active { background-color: var(--color-sidebar-active-dark-bg); }
                .dark .text-sidebar-active-text { color: var(--color-sidebar-active-dark-text); }
                .text-link { color: var(--color-link-text-light); }
                .dark .text-link { color: var(--color-link-text-dark); }
            `;
            styleElement.innerHTML = css;
        }
    }, [allData.appSettings]);

    const showAlert = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
        setAlert({ message, type, key: Date.now() });
    }, []);

    // Effect to automatically hide the alert after a delay
    useEffect(() => {
        if (alert) {
            const timer = setTimeout(() => {
                setAlert(null);
            }, 3000); // Hide after 3 seconds

            return () => clearTimeout(timer);
        }
    }, [alert]);

    const fetchApplicationData = useCallback(async () => {
        try {
            const response = await apiClient.get('/application-data');
            setAllData(response.data);
        } catch (error) {
            console.error("Failed to fetch application data:", error);
            showAlert("Impossible de charger les données de l'application.", 'error');
        }
    }, [showAlert]);
    
    const handleLogout = useCallback(() => {
        localStorage.removeItem('authToken');
        setCurrentUser(null);
        // We keep appSettings in allData so the login screen displays correctly
        setAllData(prev => ({ appSettings: prev.appSettings }));
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
                    const meResponse = await apiClient.get('/auth/me');
                    setCurrentUser(meResponse.data.user);
                    await fetchApplicationData(); // Fetches all protected data
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
        if (currentUser) {
            const token = localStorage.getItem('authToken');
            if (token) {
                wsClient.connect(token);
            }

            const handleWebSocketMessage = (event: any) => {
                if (event.type && event.payload) {
                    const actionType = event.type.replace(/([A-Z])/g, '_$1').toUpperCase();
                    dispatch({ type: actionType as any, payload: event.payload });
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
    }, [currentUser]);

    // Effect to initialize live data state once static data is loaded
    useEffect(() => {
        if (allData.users && allData.campaigns) {
            dispatch({ type: 'INIT_STATE', payload: { agents: allData.users, campaigns: allData.campaigns } });
        }
    }, [allData.users, allData.campaigns]);


    const handleLoginSuccess = ({ user, token }: { user: User, token: string }) => {
        localStorage.setItem('authToken', token);
        setCurrentUser(user);
        setIsLoading(true);
        fetchApplicationData().finally(() => setIsLoading(false));
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
            
            await fetchApplicationData(); // Re-fetch all data to ensure consistency
            showAlert('Enregistrement réussi !', 'success');
            return response.data;
        } catch (error: any) {
            const errorMessage = error.response?.data?.error || `Échec de l'enregistrement.`;
            console.error(`Failed to save ${dataType}:`, error);
            showAlert(errorMessage, 'error');
            throw error;
        }
    };
    
    // FIX: Corrected the signature and implementation of the `handleDelete` function to accept an optional `endpoint` parameter. This resolves errors where it was called with three arguments instead of the expected two, ensuring that API calls for deletion are made to the correct custom endpoints when provided.
    const handleDelete = async (dataType: string, id: string, endpoint?: string) => {
        if (window.confirm("Êtes-vous sûr de vouloir supprimer cet élément ?")) {
            try {
                const url = endpoint || `/${dataType.toLowerCase()}`;
                await apiClient.delete(`${url}/${id}`);
                await fetchApplicationData();
                showAlert('Suppression réussie !', 'success');
            } catch (error: any) {
                const errorMessage = error.response?.data?.error || `Échec de la suppression.`;
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
        showAlert('Paramètres de visibilité mis à jour.', 'success');
    };

    const handleSaveSmtpSettings = async (settings: SystemSmtpSettings, password?: string) => {
        try {
            const payload: any = { ...settings };
            if (password) {
                payload.password = password;
            }
            await apiClient.put('/system/smtp-settings', payload);
            await fetchApplicationData(); 
            showAlert('Paramètres SMTP enregistrés. Un redémarrage du serveur peut être nécessaire.', 'success');
        } catch (error: any) {
            const errorMessage = error.response?.data?.error || `Échec de l'enregistrement.`;
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
            showAlert("Paramètres de l'application enregistrés.", 'success');
        } catch (error: any) {
            const errorMessage = error.response?.data?.error || `Échec de l'enregistrement.`;
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
            const errorMessage = error.response?.data?.error || `Échec de la création en masse.`;
            console.error(`Failed to bulk create users:`, error);
            showAlert(errorMessage, 'error');
            throw error;
        }
    };
    
    const handleGenerateUsers = async (users: User[]) => {
        await handleBulkUsers(users, `${users.length} utilisateurs générés avec succès.`);
    };

    const handleImportUsers = async (users: User[]) => {
        await handleBulkUsers(users, `${users.length} utilisateurs importés avec succès.`);
    };

    const handleImportContacts = async (campaignId: string, contacts: Contact[], deduplicationConfig: { enabled: boolean; fieldIds: string[] }) => {
        try {
            await apiClient.post(`/campaigns/${campaignId}/contacts`, { contacts, deduplicationConfig });
            await fetchApplicationData();
            showAlert(`${contacts.length} contacts importés avec succès.`, 'success');
        } catch (error) {
            showAlert("Erreur lors de l'importation des contacts.", 'error');
        }
    };

    const handleUpdatePassword = async (passwordData: any) => {
        try {
            await apiClient.put('/users/me/password', passwordData);
            showAlert('Mot de passe mis à jour avec succès.', 'success');
            setIsProfileModalOpen(false);
        } catch (error: any) {
             const errorMessage = error.response?.data?.error || `Échec de la mise à jour.`;
            console.error(`Failed to update password:`, error);
            showAlert(errorMessage, 'error');
            throw error; // Rethrow to keep modal open and show error
        }
    };

    const handleUpdateProfilePicture = async (base64DataUrl: string) => {
        try {
            await apiClient.put('/users/me/picture', { pictureUrl: base64DataUrl });
            showAlert('Photo de profil mise à jour.', 'success');
            // Refresh all data to get the updated user object everywhere
            await fetchApplicationData(); 
        } catch (error: any) {
            const errorMessage = error.response?.data?.error || `Échec de la mise à jour.`;
            showAlert(errorMessage, 'error');
            throw error; // Rethrow to allow modal to handle UI state
        }
    };

    const currentUserStatus: AgentStatus | undefined = useMemo(() => {
        if (!currentUser) return undefined;
        const agentState = liveState.agentStates.find(a => a.id === currentUser.id);
        return agentState?.status;
    }, [currentUser, liveState.agentStates]);


    if (isLoading) {
        return <div className="h-screen w-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">Chargement...</div>;
    }

    if (!currentUser) {
        return <LoginScreen
            onLoginSuccess={handleLoginSuccess}
            appLogoUrl={allData.appSettings?.appLogoUrl}
            appName={allData.appSettings?.appName}
        />;
    }

    if (currentUser.role === 'Agent') {
        return <AgentView 
            currentUser={currentUser} 
            onLogout={handleLogout} 
            data={allData as any} 
            refreshData={fetchApplicationData}
            onUpdatePassword={handleUpdatePassword}
            onUpdateProfilePicture={handleUpdateProfilePicture}
        />;
    }

    const activeFeature = features.find(f => f.id === activeFeatureId) || null;
    const FeatureComponent = activeFeature?.component;

    const renderFeatureComponent = () => {
        if (!FeatureComponent) return null;

        const componentProps = {
            ...allData,
            ...liveState,
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

export default App;