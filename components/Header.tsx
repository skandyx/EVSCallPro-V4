import React, { useState, useEffect } from 'react';
import { WrenchScrewdriverIcon, ServerStackIcon, ComputerDesktopIcon, SunIcon, MoonIcon, ChevronDownIcon } from './Icons.tsx';
import { useI18n } from '../src/i18n/index.tsx';

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
    const { t } = useI18n();
    const options: { name: Theme; icon: React.FC<any>; titleKey: string }[] = [
        { name: 'system', icon: ComputerDesktopIcon, titleKey: 'header.theme.system' },
        { name: 'light', icon: SunIcon, titleKey: 'header.theme.light' },
        { name: 'dark', icon: MoonIcon, titleKey: 'header.theme.dark' },
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
                    title={t(option.titleKey)}
                >
                    <option.icon className="w-5 h-5" />
                </button>
            ))}
        </div>
    );
};

// --- LanguageSwitcher Component ---
const LanguageSwitcher: React.FC = () => {
    const { language, setLanguage, t } = useI18n();
    const [isOpen, setIsOpen] = useState(false);
    const languages = [
        { code: 'fr', name: 'Français' },
        { code: 'en', name: 'English' },
    ];

    const toggleDropdown = () => setIsOpen(!isOpen);

    useEffect(() => {
        const close = () => setIsOpen(false);
        if (isOpen) {
            window.addEventListener('click', close);
        }
        return () => window.removeEventListener('click', close);
    }, [isOpen]);
    
    const getFlagSrc = (code: string) => {
        if (code === 'fr') return '/fr-flag.svg';
        if (code === 'en') return '/en-flag.svg';
        if (code === 'ar') return '/sa-flag.svg';
        return '';
    }

    return (
        <div className="relative">
            <button onClick={(e) => { e.stopPropagation(); toggleDropdown(); }} className="flex items-center p-1 space-x-2 bg-slate-100 dark:bg-slate-700 rounded-full text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600">
                <span className="w-6 h-6 rounded-full overflow-hidden">
                    <img src={getFlagSrc(language)} alt={language} className="w-full h-full object-cover" />
                </span>
                <span className="hidden sm:inline">{language.toUpperCase()}</span>
                <ChevronDownIcon className="w-4 h-4 text-slate-500 dark:text-slate-400 mr-1" />
            </button>
            {isOpen && (
                <div className="absolute right-0 mt-2 w-36 origin-top-right bg-white dark:bg-slate-800 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-20">
                    <div className="py-1">
                        {languages.map(lang => (
                             <button
                                key={lang.code}
                                onClick={() => { setLanguage(lang.code); setIsOpen(false); }}
                                className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                            >
                                <img src={getFlagSrc(lang.code)} alt={lang.name} className="w-5 h-auto rounded-sm" />
                                {lang.name}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}


const Header: React.FC<HeaderProps> = ({ activeView, onViewChange, theme, setTheme }) => {
    const { t } = useI18n();

    const TabButton: React.FC<{
        viewName: 'app' | 'monitoring';
        labelKey: string;
        icon: React.FC<React.SVGProps<SVGSVGElement>>;
    }> = ({ viewName, labelKey, icon: Icon }) => {
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
                <span>{t(labelKey)}</span>
            </button>
        );
    };

    return (
        <header className="flex-shrink-0 bg-white dark:bg-slate-800 shadow-sm border-b border-slate-200 dark:border-slate-700 flex justify-between items-center px-4">
            <nav className="flex space-x-2">
                <TabButton viewName="app" labelKey="header.tabs.application" icon={WrenchScrewdriverIcon} />
                <TabButton viewName="monitoring" labelKey="header.tabs.monitoring" icon={ServerStackIcon} />
            </nav>
            <div className="flex items-center gap-4">
                <Clock />
                <ThemeSwitcher theme={theme} setTheme={setTheme} />
                <LanguageSwitcher />
            </div>
        </header>
    );
};

export default Header;