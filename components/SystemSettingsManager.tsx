import React, { useState, useEffect } from 'react';
import type { Feature, SystemSmtpSettings, SystemAppSettings } from '../types.ts';
import { PaletteIcon, EnvelopeIcon, BuildingOfficeIcon, PaperAirplaneIcon, Cog6ToothIcon, CreditCardIcon } from './Icons.tsx';

interface SystemSettingsManagerProps {
    feature: Feature;
    smtpSettings: SystemSmtpSettings;
    appSettings: SystemAppSettings;
    apiClient: any;
    refreshData: () => void;
}

type Tab = 'appearance' | 'smtp' | 'licenses';

const themes = [
    { id: 'default', name: 'Indigo Intense', colors: ['#4f46e5', '#3730a3', '#e0e7ff'] },
    { id: 'forest', name: 'Vert Forêt', colors: ['#16a34a', '#15803d', '#dcfce7'] },
    { id: 'ocean', name: 'Bleu Océan', colors: ['#2563eb', '#1d4ed8', '#dbeafe'] },
    { id: 'sunset', name: 'Coucher de Soleil', colors: ['#f97316', '#c2410c', '#ffedd5'] },
    { id: 'slate', name: 'Gris Ardoise', colors: ['#475569', '#334155', '#f1f5f9'] },
    { id: 'rose', name: 'Rose Corail', colors: ['#e11d48', '#be123c', '#ffe4e6'] },
    { id: 'amber', name: 'Ambre Doré', colors: ['#d97706', '#b45309', '#fef3c7'] },
    { id: 'cyan', name: 'Cyan Lagon', colors: ['#0891b2', '#0e7490', '#cffafe'] },
];

const SystemSettingsManager: React.FC<SystemSettingsManagerProps> = ({ feature, smtpSettings, appSettings, apiClient, refreshData }) => {
    const [activeTab, setActiveTab] = useState<Tab>('appearance');
    const [localSmtp, setLocalSmtp] = useState(smtpSettings);
    const [localApp, setLocalApp] = useState(appSettings);
    const [smtpPassword, setSmtpPassword] = useState('');
    const [testEmail, setTestEmail] = useState('');
    const [isTestingEmail, setIsTestingEmail] = useState(false);
    const [testResult, setTestResult] = useState<{ status: 'success' | 'error'; message: string } | null>(null);

    useEffect(() => {
        setLocalSmtp(smtpSettings);
        setLocalApp(appSettings);
    }, [smtpSettings, appSettings]);
    
    useEffect(() => {
        // Apply theme preview when localApp.colorPalette changes
        document.documentElement.setAttribute('data-theme', localApp.colorPalette);
    }, [localApp.colorPalette]);


    const handleSmtpChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        const checked = (e.target as HTMLInputElement).checked;
        setLocalSmtp(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleAppChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setLocalApp(prev => ({ ...prev, [name]: value }));
    };

    const handleSaveSmtp = async () => {
        try {
            await apiClient.put('/system/smtp-settings', { ...localSmtp, password: smtpPassword });
            alert("Paramètres SMTP enregistrés.");
            refreshData();
        } catch (error) {
            alert("Erreur lors de l'enregistrement des paramètres SMTP.");
        }
    };
    
    const handleSaveApp = async () => {
        try {
            await apiClient.put('/system/app-settings', localApp);
            localStorage.setItem('colorPalette', localApp.colorPalette);
            alert("Paramètres de l'application enregistrés.");
            refreshData();
        } catch (error) {
            alert("Erreur lors de l'enregistrement des paramètres de l'application.");
        }
    };

    const handleTestEmail = async () => {
        setIsTestingEmail(true);
        setTestResult(null);
        try {
            const response = await apiClient.post('/system/test-email', {
                smtpConfig: { ...localSmtp, password: smtpPassword },
                recipient: testEmail
            });
            setTestResult({ status: 'success', message: response.data.message });
        } catch (error: any) {
            setTestResult({ status: 'error', message: error.response?.data?.message || 'Erreur inconnue.' });
        } finally {
            setIsTestingEmail(false);
        }
    };
    
    const TabButton: React.FC<{tabId: Tab, label: string, icon: React.FC<any>}> = ({ tabId, label, icon: Icon }) => (
        <button
            onClick={() => setActiveTab(tabId)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md ${activeTab === tabId ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary'}`}
        >
            <Icon className="w-5 h-5"/>
            {label}
        </button>
    )

    return (
        <div className="max-w-5xl mx-auto space-y-8">
            <header>
                <h1 className="text-4xl font-bold text-slate-900 tracking-tight flex items-center"><Cog6ToothIcon className="w-9 h-9 mr-3"/>{feature.title}</h1>
                <p className="mt-2 text-lg text-slate-600">{feature.description}</p>
            </header>

            <div className="bg-card p-2 rounded-lg shadow-sm border border-border">
                <nav className="flex space-x-2">
                    <TabButton tabId="appearance" label="Apparence" icon={PaletteIcon} />
                    <TabButton tabId="smtp" label="Email (SMTP)" icon={EnvelopeIcon} />
                    <TabButton tabId="licenses" label="Licences" icon={CreditCardIcon} />
                </nav>
            </div>
            
            {activeTab === 'appearance' && (
                <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <h3 className="font-semibold text-lg flex items-center mb-4"><BuildingOfficeIcon className="w-5 h-5 mr-2"/>Informations Société</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm font-medium">Nom de l'application</label>
                                    <input name="appName" value={localApp.appName} onChange={handleAppChange} className="mt-1 w-full p-2 border border-input rounded-md"/>
                                </div>
                                <div>
                                    <label className="text-sm font-medium">Adresse de la société</label>
                                    <textarea name="companyAddress" value={localApp.companyAddress} onChange={handleAppChange} rows={4} className="mt-1 w-full p-2 border border-input rounded-md"/>
                                </div>
                                <div>
                                    <label className="text-sm font-medium">URL du Logo de l'application</label>
                                    <input name="appLogoUrl" value={localApp.appLogoUrl} onChange={handleAppChange} placeholder="https://.../logo.png" className="mt-1 w-full p-2 border border-input rounded-md"/>
                                </div>
                            </div>
                        </div>
                         <div>
                            <h3 className="font-semibold text-lg flex items-center mb-4"><PaletteIcon className="w-5 h-5 mr-2"/>Thème de l'Application</h3>
                             <p className="text-sm text-muted-foreground mb-4">Choisissez une palette de couleurs pour personnaliser l'apparence des boutons et des menus.</p>
                             <div className="grid grid-cols-2 gap-3">
                                {themes.map(theme => (
                                    <button 
                                        key={theme.id}
                                        onClick={() => setLocalApp(prev => ({ ...prev, colorPalette: theme.id as any }))}
                                        className={`p-4 rounded-lg border-2 ${localApp.colorPalette === theme.id ? 'border-primary' : 'border-border hover:border-muted'}`}
                                    >
                                        <p className="font-semibold text-left">{theme.name}</p>
                                        <div className="flex items-center gap-2 mt-2">
                                            {theme.colors.map(color => <div key={color} className="w-6 h-6 rounded-full" style={{ backgroundColor: color }}></div>)}
                                        </div>
                                    </button>
                                ))}
                             </div>
                        </div>
                    </div>
                     <div className="flex justify-end mt-8 pt-6 border-t border-border">
                        <button onClick={handleSaveApp} className="bg-primary text-primary-foreground font-bold py-2 px-4 rounded-lg shadow-md">Enregistrer l'apparence</button>
                    </div>
                </div>
            )}

            {activeTab === 'smtp' && (
                <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
                    <h2 className="text-2xl font-semibold text-foreground flex items-center mb-6"><EnvelopeIcon className="w-6 h-6 mr-3"/> Paramètres SMTP</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input name="server" value={localSmtp.server} onChange={handleSmtpChange} placeholder="Serveur SMTP" className="p-2 border border-input rounded" />
                        <input name="port" type="number" value={localSmtp.port} onChange={handleSmtpChange} placeholder="Port" className="p-2 border border-input rounded" />
                        <input name="user" value={localSmtp.user} onChange={handleSmtpChange} placeholder="Utilisateur" className="p-2 border border-input rounded" />
                        <input name="password" type="password" value={smtpPassword} onChange={e => setSmtpPassword(e.target.value)} placeholder="Mot de passe" className="p-2 border border-input rounded" />
                        <input name="from" value={localSmtp.from} onChange={handleSmtpChange} placeholder="Adresse d'expédition" className="p-2 border border-input rounded col-span-2" />
                        <div className="flex items-center gap-2"><input type="checkbox" name="auth" checked={localSmtp.auth} onChange={handleSmtpChange} /> Authentification</div>
                        <div className="flex items-center gap-2"><input type="checkbox" name="secure" checked={localSmtp.secure} onChange={handleSmtpChange} /> Connexion sécurisée (TLS)</div>
                    </div>
                     <div className="flex justify-end mt-6">
                        <button onClick={handleSaveSmtp} className="bg-primary text-primary-foreground font-bold py-2 px-4 rounded-lg">Enregistrer SMTP</button>
                    </div>
                    <div className="mt-6 pt-6 border-t border-border">
                        <h3 className="font-semibold">Tester la configuration</h3>
                        <div className="flex gap-2 mt-2">
                            <input type="email" value={testEmail} onChange={e => setTestEmail(e.target.value)} placeholder="Email destinataire" className="flex-1 p-2 border border-input rounded" />
                            <button onClick={handleTestEmail} disabled={isTestingEmail || !testEmail} className="bg-primary text-primary-foreground font-bold py-2 px-4 rounded-lg disabled:opacity-50 inline-flex items-center"><PaperAirplaneIcon className="w-4 h-4 mr-2"/>{isTestingEmail ? 'Envoi...' : 'Envoyer test'}</button>
                        </div>
                        {testResult && <p className={`mt-2 text-sm ${testResult.status === 'success' ? 'text-green-600' : 'text-red-600'}`}>{testResult.message}</p>}
                    </div>
                </div>
            )}
            
            {activeTab === 'licenses' && (
                <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
                     <h2 className="text-2xl font-semibold text-foreground flex items-center mb-6"><CreditCardIcon className="w-6 h-6 mr-3"/> Gestion des Licences</h2>
                     <p className="text-center text-muted-foreground py-12">Ce module est en cours de développement.</p>
                </div>
            )}
        </div>
    );
};

export default SystemSettingsManager;