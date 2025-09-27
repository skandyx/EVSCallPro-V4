import React, { useState, useEffect } from 'react';
import type { Feature, SystemSmtpSettings, SystemAppSettings } from '../types.ts';
import { Cog6ToothIcon, EnvelopeIcon, BuildingOfficeIcon, PaletteIcon, PaperAirplaneIcon } from './Icons.tsx';
import { useI18n } from '../src/i18n/index.tsx';

// Props definition
interface SystemSettingsManagerProps {
    feature: Feature;
    smtpSettings: SystemSmtpSettings;
    appSettings: SystemAppSettings;
    onSaveSmtpSettings: (settings: SystemSmtpSettings, password?: string) => Promise<void>;
    onSaveAppSettings: (settings: SystemAppSettings) => Promise<void>;
    apiCall: any; // Axios instance for test email
}

// ToggleSwitch component for UI
const ToggleSwitch: React.FC<{ enabled: boolean; onChange: (enabled: boolean) => void; label: string; }> = ({ enabled, onChange, label }) => (
    <button
        type="button"
        onClick={() => onChange(!enabled)}
        className={`${enabled ? 'bg-primary' : 'bg-slate-200'} relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out`}
        role="switch"
        aria-checked={enabled}
        aria-label={label}
    >
        <span
            aria-hidden="true"
            className={`${enabled ? 'translate-x-5' : 'translate-x-0'} pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
        />
    </button>
);

const COLOR_PALETTES = [
    { id: 'default', name: 'Défaut (Indigo)' },
    { id: 'forest', name: 'Forêt (Vert)' },
    { id: 'ocean', name: 'Océan (Bleu)' },
    { id: 'sunset', name: 'Crépuscule (Orange)' },
    { id: 'slate', name: 'Ardoise (Gris)' },
    { id: 'rose', name: 'Rose' },
    { id: 'amber', name: 'Ambre' },
    { id: 'cyan', name: 'Cyan' },
];

const SystemSettingsManager: React.FC<SystemSettingsManagerProps> = ({ feature, smtpSettings, appSettings, onSaveSmtpSettings, onSaveAppSettings, apiCall }) => {
    const [localSmtp, setLocalSmtp] = useState(smtpSettings);
    const [smtpPassword, setSmtpPassword] = useState('');
    const [localApp, setLocalApp] = useState(appSettings);
    const [isSaving, setIsSaving] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [testEmail, setTestEmail] = useState('');
    const [testStatus, setTestStatus] = useState<{ status: 'idle' | 'testing' | 'success' | 'error', message: string }>({ status: 'idle', message: '' });
    const { t } = useI18n();

    useEffect(() => {
        setLocalSmtp(smtpSettings);
        setLocalApp(appSettings);
    }, [smtpSettings, appSettings]);

    const handleSmtpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setLocalSmtp(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleAppChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setLocalApp(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        setShowSuccess(false);
        try {
            await onSaveSmtpSettings(localSmtp, smtpPassword || undefined);
            await onSaveAppSettings(localApp);
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 3000);
        } catch (error) {
            console.error("Failed to save settings", error);
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleTestEmail = async () => {
        setTestStatus({ status: 'testing', message: 'Envoi en cours...' });
        try {
            const configToSend = { ...localSmtp, password: smtpPassword || undefined };
            const response = await apiCall.post('/system/test-email', { smtpConfig: configToSend, recipient: testEmail });
            setTestStatus({ status: 'success', message: response.data.message });
        } catch (error: any) {
            setTestStatus({ status: 'error', message: error.response?.data?.message || 'Échec de l\'envoi.' });
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <header>
                <h1 className="text-4xl font-bold text-slate-900 tracking-tight flex items-center"><Cog6ToothIcon className="w-9 h-9 mr-3 text-indigo-600"/>{t(feature.titleKey)}</h1>
                <p className="mt-2 text-lg text-slate-600">{t(feature.descriptionKey)}</p>
            </header>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                <h2 className="text-2xl font-semibold text-slate-800 flex items-center mb-6"><PaletteIcon className="w-6 h-6 mr-3 text-indigo-600"/> Personnalisation de l'Application</h2>
                <div className="space-y-4">
                    <div>
                        <label className="text-sm font-medium">Nom de l'application</label>
                        <input type="text" name="appName" value={localApp.appName} onChange={handleAppChange} className="mt-1 w-full p-2 border rounded-md"/>
                    </div>
                    <div>
                        <label className="text-sm font-medium">URL du logo (pour l'écran de connexion)</label>
                        <input type="text" name="appLogoUrl" value={localApp.appLogoUrl} onChange={handleAppChange} placeholder="https://example.com/logo.png" className="mt-1 w-full p-2 border rounded-md"/>
                    </div>
                    <div>
                        <label className="text-sm font-medium">Palette de couleurs</label>
                        <select name="colorPalette" value={localApp.colorPalette} onChange={handleAppChange} className="mt-1 w-full p-2 border bg-white rounded-md">
                            {COLOR_PALETTES.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-sm font-medium flex items-center"><BuildingOfficeIcon className="w-5 h-5 mr-2 text-slate-500"/>Adresse de l'entreprise (affichée sur les documents)</label>
                        <textarea name="companyAddress" value={localApp.companyAddress} onChange={handleAppChange} rows={3} className="mt-1 w-full p-2 border rounded-md"/>
                    </div>
                </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                <h2 className="text-2xl font-semibold text-slate-800 flex items-center mb-6"><EnvelopeIcon className="w-6 h-6 mr-3 text-indigo-600"/> Paramètres d'Envoi d'Email (SMTP)</h2>
                <div className="space-y-4">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label className="text-sm font-medium">Serveur SMTP</label><input type="text" name="server" value={localSmtp.server} onChange={handleSmtpChange} className="mt-1 w-full p-2 border rounded-md"/></div>
                        <div><label className="text-sm font-medium">Port</label><input type="number" name="port" value={localSmtp.port} onChange={handleSmtpChange} className="mt-1 w-full p-2 border rounded-md"/></div>
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-md border">
                            <label className="text-sm font-medium">Authentification requise</label>
                            <ToggleSwitch label="Authentification requise" enabled={localSmtp.auth} onChange={e => setLocalSmtp(p => ({...p, auth: e}))}/>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-md border">
                             <label className="text-sm font-medium">Connexion sécurisée (TLS)</label>
                            <ToggleSwitch label="Connexion sécurisée" enabled={localSmtp.secure} onChange={e => setLocalSmtp(p => ({...p, secure: e}))}/>
                        </div>
                    </div>
                    {localSmtp.auth && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div><label className="text-sm font-medium">Utilisateur</label><input type="text" name="user" value={localSmtp.user} onChange={handleSmtpChange} className="mt-1 w-full p-2 border rounded-md"/></div>
                            <div><label className="text-sm font-medium">Mot de passe</label><input type="password" value={smtpPassword} onChange={e => setSmtpPassword(e.target.value)} placeholder="Laisser vide pour ne pas changer" className="mt-1 w-full p-2 border rounded-md"/></div>
                        </div>
                    )}
                     <div><label className="text-sm font-medium">Adresse d'expédition ("From")</label><input type="email" name="from" value={localSmtp.from} onChange={handleSmtpChange} className="mt-1 w-full p-2 border rounded-md"/></div>
                    <div className="pt-4 border-t space-y-2">
                         <h4 className="font-semibold text-slate-700">Tester la configuration SMTP</h4>
                         <div className="flex items-center gap-2">
                            <input type="email" value={testEmail} onChange={e => setTestEmail(e.target.value)} placeholder="email@destinataire.com" className="flex-1 p-2 border rounded-md"/>
                             <button onClick={handleTestEmail} disabled={!testEmail || testStatus.status === 'testing'} className="font-semibold py-2 px-4 rounded-lg bg-slate-200 hover:bg-slate-300 disabled:opacity-50 inline-flex items-center">
                                <PaperAirplaneIcon className="w-5 h-5 mr-2"/>
                                {testStatus.status === 'testing' ? 'Envoi...' : 'Envoyer un test'}
                            </button>
                         </div>
                         {testStatus.status !== 'idle' && (
                             <div className={`p-2 rounded-md text-sm ${testStatus.status === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{testStatus.message}</div>
                         )}
                    </div>
                </div>
            </div>

            <div className="flex justify-end items-center mt-2">
                {showSuccess && <span className="text-green-600 font-semibold mr-4">Modifications enregistrées !</span>}
                <button onClick={handleSave} disabled={isSaving} className="bg-primary hover:bg-primary-hover text-primary-text font-bold py-2 px-6 rounded-lg shadow-md disabled:opacity-50">
                    {isSaving ? 'Enregistrement...' : 'Enregistrer tous les paramètres'}
                </button>
            </div>
        </div>
    );
};

export default SystemSettingsManager;
