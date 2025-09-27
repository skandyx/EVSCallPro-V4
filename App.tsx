import React, { useState, useEffect, useCallback } from 'react';
import type { Feature, User, Campaign, Contact, Qualification, SavedScript, QualificationGroup, ContactNote, PersonalCallback, UserGroup, Trunk, Did, Site, PlanningEvent, ActivityType, AudioFile, SystemConnectionSettings, SystemSmtpSettings, SystemAppSettings, ModuleVisibility, BackupLog, BackupSchedule, SystemLog, VersionInfo, ConnectivityService, IvrFlow, CallHistoryRecord, AgentSession } from './types.ts';
import { features as allFeatures } from './data/features.ts';
import Sidebar from './components/Sidebar.tsx';
import FeatureDetail from './components/FeatureDetail.tsx';
import LoginScreen from './components/LoginScreen.tsx';
import AgentView from './components/AgentView.tsx';
import apiClient from './src/lib/axios.ts';
import wsClient from './src/services/wsClient.ts';

// This mirrors the structure of the /api/application-data response
export interface ApplicationData {
    users: User[];
    userGroups: UserGroup[];
    savedScripts: SavedScript[];
    campaigns: Campaign[];
    qualifications: Qualification[];
    qualificationGroups: QualificationGroup[];
    ivrFlows: IvrFlow[];
    audioFiles: AudioFile[];
    trunks: Trunk[];
    dids: Did[];
    sites: Site[];
    planningEvents: PlanningEvent[];
    activityTypes: ActivityType[];
    personalCallbacks: PersonalCallback[];
    callHistory: CallHistoryRecord[];
    agentSessions: AgentSession[];
    contactNotes: ContactNote[];
    systemConnectionSettings: SystemConnectionSettings;
    smtpSettings: SystemSmtpSettings;
    appSettings: SystemAppSettings;
    moduleVisibility: ModuleVisibility;
    backupLogs: BackupLog[];
    backupSchedule: BackupSchedule;
    systemLogs: SystemLog[];
    versionInfo: VersionInfo;
    connectivityServices: ConnectivityService[];
}

const App: React.FC = () => {
    const [isLoading, setIsLoading] = useState(true);
    const [data, setData] = useState<ApplicationData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [activeFeatureId, setActiveFeatureId] = useState<string>('users');

    const handleLogout = useCallback(() => {
        localStorage.removeItem('authToken');
        setCurrentUser(null);
        wsClient.disconnect();
    }, []);

    const refreshData = useCallback(async () => {
        try {
            const response = await apiClient.get('/application-data');
            setData(response.data);
        } catch (err) {
            console.error("Failed to refresh data", err);
            setError('Could not refresh application data.');
        }
    }, []);

    const handleLogin = (user: User, token: string) => {
        localStorage.setItem('authToken', token);
        setCurrentUser(user);
        wsClient.connect(token);
        fetchData();
    };

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const token = localStorage.getItem('authToken');
            if (token) {
                // apiClient interceptor will add the token
                const appDataPromise = apiClient.get<ApplicationData>('/application-data');
                const mePromise = apiClient.get<{ user: User }>('/auth/me');

                const [appDataRes, meRes] = await Promise.all([appDataPromise, mePromise]);
                
                setData(appDataRes.data);
                setCurrentUser(meRes.data.user);
                 if (wsClient.isDisconnected()) {
                    wsClient.connect(token);
                }
            }
        } catch (err) {
            console.error("Initialization error:", err);
            handleLogout(); // If token is invalid or fetching fails, log out
        } finally {
            setIsLoading(false);
        }
    }, [handleLogout]);

    useEffect(() => {
        fetchData();
        
        const handleLogoutEvent = () => handleLogout();
        window.addEventListener('logoutEvent', handleLogoutEvent);
        return () => window.removeEventListener('logoutEvent', handleLogoutEvent);

    }, [fetchData, handleLogout]);

    const handleUpdatePassword = async (passwordData: any) => {
        await apiClient.put('/users/me/password', passwordData);
    };

    const handleUpdateProfilePicture = async (base64DataUrl: string) => {
        const res = await apiClient.put('/users/me/picture', { pictureUrl: base64DataUrl });
        setCurrentUser(prev => prev ? { ...prev, profilePictureUrl: res.data.profilePictureUrl } : null);
    };

    if (isLoading) {
        return <div className="flex h-screen w-screen items-center justify-center">Loading...</div>;
    }

    if (!currentUser || !data) {
        return <LoginScreen onLogin={handleLogin} loginError={error} />;
    }

    if (currentUser.role === 'Agent') {
        return <AgentView 
            currentUser={currentUser} 
            onLogout={handleLogout} 
            data={{
                campaigns: data.campaigns,
                qualifications: data.qualifications,
                qualificationGroups: data.qualificationGroups,
                savedScripts: data.savedScripts,
                contactNotes: data.contactNotes,
                users: data.users,
                personalCallbacks: data.personalCallbacks,
            }}
            refreshData={refreshData}
            onUpdatePassword={handleUpdatePassword}
            onUpdateProfilePicture={handleUpdateProfilePicture}
        />;
    }
    
    const activeFeature = allFeatures.find(f => f.id === activeFeatureId) || allFeatures[0];
    const FeatureComponent = activeFeature.component;

    return (
        <div className="flex h-screen bg-slate-100">
            <Sidebar
                features={allFeatures}
                user={currentUser}
                onSelectFeature={setActiveFeatureId}
                activeFeatureId={activeFeatureId}
                onLogout={handleLogout}
            />
            <main className="flex-1 p-8 overflow-y-auto">
                <FeatureComponent 
                    feature={activeFeature}
                    {...data}
                    apiClient={apiClient}
                    refreshData={refreshData}
                    onSaveOrUpdateScript={async (script: SavedScript) => { 
                        await apiClient.put(`/scripts/${script.id}`, script);
                        refreshData();
                    }}
                    onDeleteScript={async (scriptId: string) => {
                        await apiClient.delete(`/scripts/${scriptId}`);
                        refreshData();
                    }}
                    onDuplicateScript={async (scriptId: string) => {
                        await apiClient.post(`/scripts/${scriptId}/duplicate`);
                        refreshData();
                    }}
                    onSaveOrUpdateIvrFlow={async (flow: IvrFlow) => {
                        await apiClient.put(`/ivr-flows/${flow.id}`, flow);
                        refreshData();
                    }}
                    onDeleteIvrFlow={async (flowId: string) => {
                        await apiClient.delete(`/ivr-flows/${flowId}`);
                        refreshData();
                    }}
                    onDuplicateIvrFlow={async (flowId: string) => {
                        await apiClient.post(`/ivr-flows/${flowId}/duplicate`);
                        refreshData();
                    }}
                />
            </main>
        </div>
    );
};

export default App;