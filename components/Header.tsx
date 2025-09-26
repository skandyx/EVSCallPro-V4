import React, { useState, useEffect } from 'react';
import { WrenchScrewdriverIcon, ServerStackIcon, ComputerDesktopIcon, SunIcon, MoonIcon } from './Icons.tsx';

type Theme = 'light' | 'dark' | 'system';

interface HeaderProps {
    activeView: 'app' | 'monitoring';
    onViewChange: (view: 'app' | 'monitoring') => void;
    theme: Theme;
    setTheme: (theme: Theme) => void;
}

// --- Clock Component ---
const Clock: React.FC = () => {
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const timerId = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timerId);
    }, []);

    return (
        <div className="text-sm font-medium text-slate-500 dark:text-slate-400 font-mono">
            {time.toLocaleTimeString('fr-FR')}
        </div>
    );
};

// --- ThemeSwitcher Component ---
const ThemeSwitcher: React.FC<{ theme: Theme; setTheme: (theme: Theme) => void; }> = ({ theme, setTheme }) => {
    const options: { name: Theme; icon: React.FC<any>; title: string }[] = [
        { name: 'system', icon: ComputerDesktopIcon, title: 'Thème du système' },
        { name: 'light', icon: SunIcon, title: 'Thème clair' },
        { name: 'dark', icon: MoonIcon, title: 'Thème sombre' },
    ];

    return (
        <div className="flex items-center p-1 space-x-1 bg-slate-100 dark:bg-slate-700 rounded-full">
            {options.map(option => (
                <button
                    key={option.name}
                    onClick={() => setTheme(option.name)}
                    className={`p-1.5 rounded-full transition-colors ${
                        theme === option.name
                            ? 'bg-white dark:bg-slate-900 shadow-sm text-indigo-600 dark:text-indigo-400'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                    title={option.title}
                >
                    <option.icon className="w-5 h-5" />
                </button>
            ))}
        </div>
    );
};


const Header: React.FC<HeaderProps> = ({ activeView, onViewChange, theme, setTheme }) => {
    const TabButton: React.FC<{
        viewName: 'app' | 'monitoring';
        label: string;
        icon: React.FC<React.SVGProps<SVGSVGElement>>;
    }> = ({ viewName, label, icon: Icon }) => {
        const isActive = activeView === viewName;
        return (
            <button
                onClick={() => onViewChange(viewName)}
                className={`flex items-center space-x-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
                    isActive
                        ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                        : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
            >
                <Icon className="w-5 h-5" />
                <span>{label}</span>
            </button>
        );
    };

    return (
        <header className="flex-shrink-0 bg-white dark:bg-slate-800 shadow-sm border-b border-slate-200 dark:border-slate-700 flex justify-between items-center pr-4">
            <nav className="flex space-x-2">
                <TabButton viewName="app" label="Application" icon={WrenchScrewdriverIcon} />
                <TabButton viewName="monitoring" label="Monitoring" icon={ServerStackIcon} />
            </nav>
            <div className="flex items-center gap-4">
                <Clock />
                <ThemeSwitcher theme={theme} setTheme={setTheme} />
            </div>
        </header>
    );
};

export default Header;