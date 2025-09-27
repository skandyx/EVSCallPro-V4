import React, { useState } from 'react';
import type { Feature } from '../types.ts';
import { Cog6ToothIcon, EnvelopeIcon, PaperAirplaneIcon } from './Icons.tsx';

const ToggleSwitch: React.FC<{ enabled: boolean; onChange: (enabled: boolean) => void; }> = ({ enabled, onChange }) => (
    <button type="button" onClick={() => onChange(!enabled)} className={`${enabled ? 'bg-indigo-600' : 'bg-slate-200'} relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out`} role="switch" aria-checked={enabled}>
        <span aria-hidden="true" className={`${enabled ? 'translate-x-5' : 'translate-x-0'} pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`} />
    </button>
);

interface SystemSettingsManagerProps {
    feature: Feature;
}

const SystemSettingsManager: React.FC<SystemSettingsManagerProps> = ({ feature }) => {
    const [activeTab, setActiveTab] = useState('email');
    const [smtpConfig, setSmtpConfig] = useState({
        server: '',
        port: 587,
        auth: true,
        user: '',
        password: '',
        from: ''
    });
    const [testEmail, setTestEmail] = useState('');
    const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');

    const handleSmtpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        setSmtpConfig(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleTestEmail = () => {
        if (!testEmail) {
            alert("Veuillez entrer une adresse e-mail de destination.");
            return;
        }
        setTestStatus('testing');
        // Simulate API call
        setTimeout(() => {
            const success = Math.random() > 0.2;
            setTestStatus(success ? 'success' : 'error');
            setTimeout(() => setTestStatus('idle'), 4000);
        }, 1500);
    };

    return (
        <div className="max-w-5xl mx-auto space-y-8">
            <header>
                <h1 className="text-4xl font-bold text-slate-900 tracking-tight flex items-center">
                    <Cog6ToothIcon className="w-9 h-9 mr-3 text-indigo-600"/>
                    {feature.title}
                </h1>
                <p className="mt-2 text-lg text-slate-600">{feature.description}</p>
            </header>
            <div className="bg-white rounded-lg shadow-sm border border-slate-200">
                <div className="border-b">
                    <nav className="-mb-px flex space-x-6 px-6">
                        <button className={`flex items-center gap-2 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm border-indigo-500 text-indigo-600`}>
                            <EnvelopeIcon className="w-5 h-5" />
                            Email (SMTP)
                        </button>
                    </nav>
                </div>
                <div className="p-6 space-y-6">
                    <div>
                        <h3 className="text-xl font-semibold text-slate-800">Configuration du serveur d'envoi d'e-mails</h3>
                        <p className="text-sm text-slate-500 mt-1">Configurez les paramètres SMTP pour l'envoi d'e-mails système (rapports, alertes, etc.).</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div><label className="block text-sm font-medium text-slate-700">Serveur SMTP</label><input type="text" name="server" value={smtpConfig.server} onChange={handleSmtpChange} className="mt-1 block w-full p-2 border border-slate-300 rounded-md" placeholder="smtp.example.com"/></div>
                        <div><label className="block text-sm font-medium text-slate-700">Port</label><input type="number" name="port" value={smtpConfig.port} onChange={handleSmtpChange} className="mt-1 block w-full p-2 border border-slate-300 rounded-md"/></div>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-md border">
                        <p className="font-medium text-slate-800">Utiliser l'authentification</p>
                        <ToggleSwitch enabled={smtpConfig.auth} onChange={val => setSmtpConfig(p => ({...p, auth: val}))}/>
                    </div>
                    {smtpConfig.auth && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div><label className="block text-sm font-medium text-slate-700">Nom d'utilisateur</label><input type="text" name="user" value={smtpConfig.user} onChange={handleSmtpChange} className="mt-1 block w-full p-2 border border-slate-300 rounded-md"/></div>
                            <div><label className="block text-sm font-medium text-slate-700">Mot de passe</label><input type="password" name="password" value={smtpConfig.password} onChange={handleSmtpChange} className="mt-1 block w-full p-2 border border-slate-300 rounded-md"/></div>
                        </div>
                    )}
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Adresse d'expéditeur par défaut (From)</label>
                        <input type="email" name="from" value={smtpConfig.from} onChange={handleSmtpChange} className="mt-1 block w-full p-2 border border-slate-300 rounded-md" placeholder="no-reply@example.com"/>
                    </div>
                    <div className="pt-6 border-t">
                        <h4 className="font-semibold text-slate-700">Tester la configuration</h4>
                        <div className="flex items-end gap-4 mt-2">
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-slate-700">Envoyer un e-mail de test à :</label>
                                <input type="email" value={testEmail} onChange={e => setTestEmail(e.target.value)} className="mt-1 block w-full p-2 border border-slate-300 rounded-md" placeholder="votre.email@test.com"/>
                            </div>
                            <button onClick={handleTestEmail} disabled={testStatus === 'testing'} className="bg-slate-700 hover:bg-slate-800 text-white font-bold py-2 px-4 rounded-lg shadow-md inline-flex items-center disabled:opacity-50">
                                <PaperAirplaneIcon className="w-5 h-5 mr-2"/>
                                {testStatus === 'testing' ? 'Envoi...' : 'Tester l\'envoi'}
                            </button>
                        </div>
                        {testStatus === 'success' && <p className="text-sm text-green-600 mt-2">E-mail de test envoyé avec succès !</p>}
                        {testStatus === 'error' && <p className="text-sm text-red-600 mt-2">Échec de l'envoi de l'e-mail. Vérifiez la configuration et les logs.</p>}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SystemSettingsManager;