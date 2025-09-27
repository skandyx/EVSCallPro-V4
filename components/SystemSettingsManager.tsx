import React, { useState, useEffect } from 'react';
import type { Feature, SystemSmtpSettings, SystemAppSettings } from '../types.ts';
import { Cog6ToothIcon, EnvelopeIcon, PaperAirplaneIcon, PaletteIcon, BuildingOfficeIcon } from './Icons.tsx';
import { useI18n } from '../src/i18n/index.tsx';

const ToggleSwitch: React.FC<{ enabled: boolean; onChange: (enabled: boolean) => void; }> = ({ enabled, onChange }) => (
    <button type="button" onClick={() => onChange(!enabled)} className={`${enabled ? 'bg-primary' : 'bg-slate-200'} relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out`} role="switch" aria-checked={enabled}>
        <span aria-hidden="true" className={`${enabled ? 'translate-x-5' : 'translate-x-0'} pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`} />
    </button>
);

interface SystemSettingsManagerProps {
    feature: Feature;
    smtpSettings: SystemSmtpSettings;
    appSettings: SystemAppSettings;
    onSaveSmtpSettings: (settings: SystemSmtpSettings, password?: string) => Promise<void>;
    onSaveAppSettings: (settings: SystemAppSettings) => Promise<void>;
    apiCall: any; // AxiosInstance
}

const PALETTES: { id: SystemAppSettings['colorPalette']; name: string; colors: string[] }[] = [
    { id: 'default', name: 'Indigo Intense', colors: ['#4f46e5', '#4338ca', '#e0e7ff'] },
    { id: 'forest', name: 'Vert Forêt', colors: ['#16a34a', '#15803d', '#dcfce7'] },
    { id: 'ocean', name: 'Bleu Océan', colors: ['#2563eb', '#1d4ed8', '#dbeafe'] },
    { id: 'sunset', name: 'Coucher de Soleil', colors: ['#ea580c', '#c2410c', '#fff7ed'] },
    { id: 'slate', name: 'Gris Ardoise', colors: ['#475569', '#334155', '#f1f5f9'] },
    { id: 'rose', name: 'Rose Corail', colors: ['#e11d48', '#be123c', '#fff1f2'] },
    { id: 'amber', name: 'Ambre Doré', colors: ['#d97706', '#b45309', '#fffbeb'] },
    { id: 'cyan', name: 'Cyan Lagon', colors: ['#0891b2', '#0e7490', '#ecfeff'] },
];

const SystemSettingsManager: React.FC<SystemSettingsManagerProps> = ({ feature, smtpSettings, appSettings, onSaveSmtpSettings, onSaveAppSettings, apiCall }) => {
    const [activeTab, setActiveTab] = useState('apparence');
    const { t } = useI18n();

    // --- SMTP State ---
    const [smtpConfig, setSmtpConfig] = useState<SystemSmtpSettings>(smtpSettings || { server: '', port: 0, auth: false, secure: false, user: '', from: '' });
    const [smtpPassword, setSmtpPassword] = useState('');
    const [testEmail, setTestEmail] = useState('');
    const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
    const [isSavingSmtp, setIsSavingSmtp] = useState(false);
    const [showSmtpSuccess, setShowSmtpSuccess] = useState(false);

    // --- Apparence State ---
    const [localAppSettings, setLocalAppSettings] = useState<SystemAppSettings>(appSettings);
    const [isSavingApp, setIsSavingApp] = useState(false);
    const [showAppSuccess, setShowAppSuccess] = useState(false);


    useEffect(() => {
        if (smtpSettings) {
            setSmtpConfig(smtpSettings);
        }
        if (appSettings) {
            setLocalAppSettings(appSettings);
        }
    }, [smtpSettings, appSettings]);
    
    // --- Handlers ---
    const handleSmtpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        setSmtpConfig(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };
    
    const handleAppSettingChange = (field: keyof SystemAppSettings, value: any) => {
        setLocalAppSettings(prev => ({...prev, [field]: value }));
    };

    const handleTestEmail = async () => {
        if (!testEmail) { alert("Veuillez entrer une adresse e-mail de destination."); return; }
        setTestStatus('testing');
        try {
            await apiCall.post('/system/test-email', { smtpConfig: { ...smtpConfig, password: smtpPassword }, recipient: testEmail });
            setTestStatus('success');
        } catch (err) { setTestStatus('error'); } 
        finally { setTimeout(() => setTestStatus('idle'), 4000); }
    };

    const handleSaveSmtp = async () => {
        setIsSavingSmtp(true);
        setShowSmtpSuccess(false);
        try {
            await onSaveSmtpSettings(smtpConfig, smtpPassword);
            setShowSmtpSuccess(true);
            setSmtpPassword('');
            setTimeout(() => setShowSmtpSuccess(false), 2500);
        } catch (error) { /* Error shown by App component */ } 
        finally { setIsSavingSmtp(false); }
    };

    const handleSaveApp = async () => {
        setIsSavingApp(true);
        setShowAppSuccess(false);
        try {
            await onSaveAppSettings(localAppSettings);
            setShowAppSuccess(true);
            setTimeout(() => setShowAppSuccess(false), 2500);
        } catch(error) { /* Error shown by App component */ }
        finally { setIsSavingApp(false); }
    };

    const TabButton: React.FC<{ tab: string; label: string; icon: React.FC<any>}> = ({ tab, label, icon: Icon }) => (
         <button
            onClick={() => setActiveTab(tab)}
            className={`flex items-center gap-2 whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm transition-colors ${
              activeTab === tab
                ? 'border-primary text-link'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
        >
            <Icon className="w-5 h-5" />
            {label}
        </button>
    );

    const renderSmtpContent = () => (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
            <div className="md:col-span-2"><h3 className="text-lg font-semibold text-slate-800 border-b pb-2">Paramètres du Serveur</h3></div>
            <div><label className="text-sm font-medium">Serveur SMTP</label><input type="text" name="server" value={smtpConfig?.server || ''} onChange={handleSmtpChange} className="mt-1 w-full p-2 border rounded-md"/></div>
            <div><label className="text-sm font-medium">Port</label><input type="number" name="port" value={smtpConfig?.port || 0} onChange={handleSmtpChange} className="mt-1 w-full p-2 border rounded-md"/></div>
            <div className="md:col-span-2 flex items-center justify-between p-3 bg-slate-50 rounded-md border"><div><p className="font-medium">Authentification Requise</p><p className="text-xs text-slate-500">Si votre serveur SMTP requiert un login/mot de passe.</p></div><ToggleSwitch enabled={smtpConfig?.auth || false} onChange={e => setSmtpConfig(c => ({...c, auth: e}))} /></div>
            {smtpConfig?.auth && <>
                <div><label className="text-sm font-medium">Utilisateur</label><input type="text" name="user" value={smtpConfig.user} onChange={handleSmtpChange} className="mt-1 w-full p-2 border rounded-md"/></div>
                <div><label className="text-sm font-medium">Mot de passe</label><input type="password" value={smtpPassword} onChange={e => setSmtpPassword(e.target.value)} placeholder="Laisser vide pour ne pas changer" className="mt-1 w-full p-2 border rounded-md"/></div>
            </>}
            <div className="md:col-span-2 flex items-center justify-between p-3 bg-slate-50 rounded-md border"><div><p className="font-medium">Type de sécurité</p><p className="text-xs text-slate-500">Utiliser une connexion sécurisée (SSL/TLS).</p></div><ToggleSwitch enabled={smtpConfig?.secure || false} onChange={e => setSmtpConfig(c => ({...c, secure: e}))} /></div>
            <div><label className="text-sm font-medium">Adresse d'expédition "From"</label><input type="email" name="from" value={smtpConfig?.from || ''} onChange={handleSmtpChange} className="mt-1 w-full p-2 border rounded-md"/></div>
            <div className="md:col-span-2 pt-4 border-t flex justify-end items-center gap-4">
                {showSmtpSuccess && <span className="text-green-600 font-semibold">Enregistré !</span>}
                <button onClick={handleSaveSmtp} disabled={isSavingSmtp} className="bg-primary hover:bg-primary-hover text-primary-text font-bold py-2 px-4 rounded-lg shadow-md disabled:opacity-50">{isSavingSmtp ? 'Enregistrement...' : 'Enregistrer les paramètres SMTP'}</button>
            </div>
            <div className="md:col-span-2"><h3 className="text-lg font-semibold text-slate-800 border-b pb-2 mt-4">Tester la Connexion</h3></div>
            <div className="md:col-span-2 flex items-end gap-3">
                <div className="flex-grow"><label className="text-sm font-medium">Envoyer un email de test à</label><input type="email" value={testEmail} onChange={e => setTestEmail(e.target.value)} className="mt-1 w-full p-2 border rounded-md"/></div>
                <button onClick={handleTestEmail} disabled={testStatus === 'testing'} className="bg-slate-200 hover:bg-slate-300 font-semibold py-2 px-4 rounded-lg shadow-sm disabled:opacity-50 inline-flex items-center"><PaperAirplaneIcon className="w-5 h-5 mr-2"/>{testStatus === 'testing' ? 'Envoi...' : 'Envoyer'}</button>
            </div>
            {testStatus === 'success' && <div className="md:col-span-2 text-green-600 font-semibold">Email de test envoyé avec succès !</div>}
            {testStatus === 'error' && <div className="md:col-span-2 text-red-600 font-semibold">Échec de l'envoi de l'email. Vérifiez la console pour les détails.</div>}
        </div>
    );
    
    const renderApparenceContent = () => (
         <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
            <div className="md:col-span-2"><h3 className="text-lg font-semibold text-slate-800 border-b pb-2 flex items-center gap-2"><BuildingOfficeIcon className="w-5 h-5"/>Informations Société</h3></div>
            <div>
                <label className="text-sm font-medium">Adresse de la société</label>
                <textarea value={localAppSettings?.companyAddress || ''} onChange={e => handleAppSettingChange('companyAddress', e.target.value)} rows={4} className="mt-1 w-full p-2 border rounded-md"/>
            </div>
             <div>
                <label className="text-sm font-medium">URL du Logo de l'application</label>
                <input type="url" value={localAppSettings?.appLogoUrl || ''} onChange={e => handleAppSettingChange('appLogoUrl', e.target.value)} className="mt-1 w-full p-2 border rounded-md" placeholder="https://.../logo.png"/>
                {localAppSettings?.appLogoUrl && <img src={localAppSettings.appLogoUrl} alt="Aperçu du logo" className="mt-2 h-12 w-auto bg-slate-100 p-1 rounded-md"/>}
            </div>
            <div className="md:col-span-2">
                <label className="text-sm font-medium">Nom de l'application</label>
                <input 
                    type="text" 
                    value={localAppSettings?.appName || ''} 
                    onChange={e => handleAppSettingChange('appName', e.target.value)} 
                    className="mt-1 w-full p-2 border rounded-md" 
                    placeholder="Le nom affiché sur la page de connexion et dans la barre latérale"
                />
            </div>
            <div className="md:col-span-2"><h3 className="text-lg font-semibold text-slate-800 border-b pb-2 mt-4 flex items-center gap-2"><PaletteIcon className="w-5 h-5"/>Thème de l'Application</h3></div>
            <div className="md:col-span-2">
                <p className="text-sm text-slate-600 mb-3">Choisissez une palette de couleurs pour personnaliser l'apparence des boutons et des menus.</p>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {PALETTES.map(palette => (
                        <button key={palette.id} onClick={() => handleAppSettingChange('colorPalette', palette.id)} className={`p-3 rounded-lg border-2 transition-all ${localAppSettings?.colorPalette === palette.id ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-slate-300 hover:border-indigo-400'}`}>
                            <p className="font-semibold text-slate-800">{palette.name}</p>
                            <div className="flex items-center gap-2 mt-2">
                                {palette.colors.map(color => <div key={color} style={{ backgroundColor: color }} className="w-6 h-6 rounded-full border border-slate-200"/>)}
                            </div>
                        </button>
                    ))}
                </div>
            </div>
             <div className="md:col-span-2 pt-4 border-t flex justify-end items-center gap-4">
                {showAppSuccess && <span className="text-green-600 font-semibold">Enregistré !</span>}
                <button onClick={handleSaveApp} disabled={isSavingApp} className="bg-primary hover:bg-primary-hover text-primary-text font-bold py-2 px-4 rounded-lg shadow-md disabled:opacity-50">{isSavingApp ? 'Enregistrement...' : "Enregistrer l'apparence"}</button>
            </div>
         </div>
    );
    
    const renderLicencesContent = () => (
        <div className="text-center p-8 text-slate-500">
            <h3 className="text-xl font-semibold">Gestion des Licences</h3>
            <p className="mt-2">Ce module est en cours de développement.</p>
        </div>
    );

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <header>
                {/* FIX: Replaced direct property access with translation function 't' to use i18n keys. */}
                <h1 className="text-4xl font-bold text-slate-900 tracking-tight flex items-center"><Cog6ToothIcon className="w-9 h-9 mr-3 text-indigo-600"/>{t(feature.titleKey)}</h1>
                {/* FIX: Replaced direct property access with translation function 't' and corrected property name. */}
                <p className="mt-2 text-lg text-slate-600">{t(feature.descriptionKey)}</p>
            </header>

            <div className="bg-white rounded-lg shadow-sm border border-slate-200">
                <div className="border-b border-slate-200">
                    <nav className="-mb-px flex space-x-6 px-6">
                        <TabButton tab="apparence" label="Apparence" icon={PaletteIcon} />
                        <TabButton tab="email" label="Email (SMTP)" icon={EnvelopeIcon} />
                        <TabButton tab="licences" label="Licences" icon={Cog6ToothIcon} />
                    </nav>
                </div>
                <div className="p-6">
                    {activeTab === 'apparence' && renderApparenceContent()}
                    {activeTab === 'email' && renderSmtpContent()}
                    {activeTab === 'licences' && renderLicencesContent()}
                </div>
            </div>
        </div>
    );
};

export default SystemSettingsManager;