import React, { useState } from 'react';
import type { User } from '../types.ts';
import apiClient from '../src/lib/axios.ts';
import { LogoIcon } from './Icons.tsx';

interface LoginScreenProps {
    onLogin: (user: User, token: string) => void;
    loginError: string | null;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, loginError }) => {
    const [loginId, setLoginId] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        try {
            const response = await apiClient.post('/auth/login', { loginId, password });
            const { user, accessToken } = response.data;
            onLogin(user, accessToken);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Erreur de connexion');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <LogoIcon className="mx-auto h-12 w-auto text-indigo-600" />
                <h1 className="mt-6 text-center text-3xl font-extrabold text-slate-900">Architecte de Solutions</h1>
                <p className="mt-2 text-center text-sm text-slate-600">Connectez-vous à votre compte</p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white py-8 px-4 shadow-lg sm:rounded-lg sm:px-10">
                    <form className="space-y-6" onSubmit={handleSubmit}>
                        <div>
                            <label htmlFor="loginId" className="block text-sm font-medium text-slate-700">
                                Identifiant / Extension
                            </label>
                            <div className="mt-1">
                                <input
                                    id="loginId"
                                    name="loginId"
                                    type="text"
                                    autoComplete="username"
                                    required
                                    value={loginId}
                                    onChange={(e) => setLoginId(e.target.value)}
                                    className="appearance-none block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                                Mot de passe
                            </label>
                            <div className="mt-1">
                                <input
                                    id="password"
                                    name="password"
                                    type="password"
                                    autoComplete="current-password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="appearance-none block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                />
                            </div>
                        </div>

                        {(error || loginError) && (
                            <div className="bg-red-50 p-3 rounded-md">
                                <p className="text-sm text-red-700">{error || loginError}</p>
                            </div>
                        )}

                        <div>
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                            >
                                {isLoading ? 'Connexion...' : 'Se connecter'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default LoginScreen;
