import React, { useState, useEffect } from 'react';
import type { User } from '../types.ts';
import { UserCircleIcon, SunIcon, MoonIcon, PowerIcon } from './Icons.tsx';

interface HeaderProps {
    user: User;
    onLogout: () => void;
}

const Header: React.FC<HeaderProps> = ({ user, onLogout }) => {
    const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true');
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);
    
    useEffect(() => {
        if (isDarkMode) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('darkMode', 'true');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('darkMode', 'false');
        }
    }, [isDarkMode]);

    return (
        <header className="flex-shrink-0 flex justify-end items-center p-4 bg-card border-b border-border h-16">
            <div className="flex items-center gap-4">
                <div className="text-right">
                    <p className="text-sm font-semibold text-foreground">{time.toLocaleTimeString('fr-FR')}</p>
                    <p className="text-xs text-muted-foreground">{time.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>
                <button
                    onClick={() => setIsDarkMode(!isDarkMode)}
                    className="p-2 rounded-full hover:bg-secondary text-muted-foreground"
                    title={isDarkMode ? 'Passer au mode clair' : 'Passer au mode sombre'}
                >
                    {isDarkMode ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
                </button>
            </div>
        </header>
    );
};

export default Header;