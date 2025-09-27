import React, { useState, useEffect } from 'react';
import type { Feature, SystemSmtpSettings, SystemAppSettings } from '../types.ts';
import { PaletteIcon, EnvelopeIcon, BuildingOfficeIcon, PaperAirplaneIcon } from './Icons.tsx';

interface SystemSettingsManagerProps {
    feature: Feature;
    smtpSettings: SystemSmtpSettings;
    appSettings: SystemAppSettings;
    apiClient: any;
    refreshData: () => void;
}

const SystemSettingsManager: React.FC<SystemSettingsManagerProps> = ({ feature, smtpSettings, appSettings, apiClient, refreshData }) => {
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
            alert("Paramètres de l'application enregistrés. Rafraîchissez la page pour voir les changements.");
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

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <header>
                <h1 className="text-4xl font-bold text-slate-900 tracking-tight">{feature.title}</h1>
                <p className="mt-2 text-lg text-slate-600">{feature.description}</p>
            </header>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                <h2 className="text-2xl font-semibold text-slate-800 flex items-center mb-6"><PaletteIcon className="w-6 h-6 mr-3 text-indigo-600"/> Apparence de l'application</h2>
                <div className="space-y-4">
                     <div>
                        <label className="text-sm font-medium">Nom de l'application</label>
                        <input name="appName" value={localApp.appName} onChange={handleAppChange} className="mt-1 w-full p-2 border rounded-md"/>
                    </div>
                    <div>
                        <label className="text-sm font-medium">Palette de couleurs</label>
                        <select name="colorPalette" value={localApp.colorPalette} onChange={handleAppChange} className="mt-1 w-full p-2 border rounded-md bg-white">
                            <option value="default">Défaut (Indigo)</option>
                            <option value="slate">Ardoise</option>
                            <option value="rose">Rose</option>
                            <option value="amber">Ambre</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-sm font-medium">URL du logo (laisser vide pour le logo par défaut)</label>
                        <input name="appLogoUrl" value={localApp.appLogoUrl} onChange={handleAppChange} placeholder="https://example.com/logo.png" className="mt-1 w-full p-2 border rounded-md"/>
                    </div>
                </div>
                <div className="flex justify-end mt-6">
                    <button onClick={handleSaveApp} className="bg-slate-700 hover:bg-slate-800 text-white font-bold py-2 px-4 rounded-lg">Enregistrer l'Apparence</button>
                </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                <h2 className="text-2xl font-semibold text-slate-800 flex items-center mb-6"><EnvelopeIcon className="w-6 h-6 mr-3 text-indigo-600"/> Paramètres SMTP</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input name="server" value={localSmtp.server} onChange={handleSmtpChange} placeholder="Serveur SMTP" className="p-2 border rounded" />
                    <input name="port" type="number" value={localSmtp.port} onChange={handleSmtpChange} placeholder="Port" className="p-2 border rounded" />
                    <input name="user" value={localSmtp.user} onChange={handleSmtpChange} placeholder="Utilisateur" className="p-2 border rounded" />
                    <input name="password" type="password" value={smtpPassword} onChange={e => setSmtpPassword(e.target.value)} placeholder="Mot de passe" className="p-2 border rounded" />
                    <input name="from" value={localSmtp.from} onChange={handleSmtpChange} placeholder="Adresse d'expédition" className="p-2 border rounded col-span-2" />
                    <div className="flex items-center gap-2"><input type="checkbox" name="auth" checked={localSmtp.auth} onChange={handleSmtpChange} /> Authentification</div>
                    <div className="flex items-center gap-2"><input type="checkbox" name="secure" checked={localSmtp.secure} onChange={handleSmtpChange} /> Connexion sécurisée (TLS)</div>
                </div>
                 <div className="flex justify-end mt-6">
                    <button onClick={handleSaveSmtp} className="bg-slate-700 hover:bg-slate-800 text-white font-bold py-2 px-4 rounded-lg">Enregistrer SMTP</button>
                </div>
                <div className="mt-6 pt-6 border-t">
                    <h3 className="font-semibold">Tester la configuration</h3>
                    <div className="flex gap-2 mt-2">
                        <input type="email" value={testEmail} onChange={e => setTestEmail(e.target.value)} placeholder="Email destinataire" className="flex-1 p-2 border rounded" />
                        <button onClick={handleTestEmail} disabled={isTestingEmail || !testEmail} className="bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg disabled:bg-indigo-300 inline-flex items-center"><PaperAirplaneIcon className="w-4 h-4 mr-2"/>{isTestingEmail ? 'Envoi...' : 'Envoyer test'}</button>
                    </div>
                    {testResult && <p className={`mt-2 text-sm ${testResult.status === 'success' ? 'text-green-600' : 'text-red-600'}`}>{testResult.message}</p>}
                </div>
            </div>
        </div>
    );
};

export default SystemSettingsManager;
