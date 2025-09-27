import React, { useState } from 'react';
import type { Feature, User, FeatureCategory } from '../types.ts';
import { LogoIcon, UserCircleIcon, PowerIcon, ChevronDownIcon } from './Icons.tsx';

interface SidebarProps {
    features: Feature[];
    user: User;
    activeFeatureId: string;
    onSelectFeature: (id: string) => void;
    onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ features, user, activeFeatureId, onSelectFeature, onLogout }) => {
    const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({ 'Agent': true });

    const toggleCategory = (category: string) => {
        setOpenCategories(prev => ({ ...prev, [category]: !prev[category] }));
    };

    const featuresByCategory = features.reduce((acc, feature) => {
        if (!acc[feature.category]) {
            acc[feature.category] = [];
        }
        acc[feature.category].push(feature);
        return acc;
    }, {} as Record<FeatureCategory, Feature[]>);
    
    const orderedCategories = Object.keys(featuresByCategory) as FeatureCategory[];

    return (
        <aside className="w-64 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col">
            <div className="h-16 flex-shrink-0 flex items-center px-4 border-b border-slate-200">
                <LogoIcon className="w-8 h-8 text-indigo-600" />
                <h1 className="ml-2 text-xl font-bold text-slate-800">Solution Archi</h1>
            </div>
            <nav className="flex-1 overflow-y-auto p-4 space-y-4">
                {orderedCategories.map(category => (
                    <div key={category}>
                        <button
                            onClick={() => toggleCategory(category)}
                            className="w-full flex justify-between items-center text-left text-sm font-semibold text-slate-500 hover:text-slate-800"
                        >
                            {category.toUpperCase()}
                            <ChevronDownIcon className={`w-4 h-4 transition-transform ${openCategories[category] ? '' : '-rotate-90'}`} />
                        </button>
                        {openCategories[category] && (
                            <div className="mt-2 space-y-1">
                                {featuresByCategory[category].map(feature => (
                                    <a
                                        key={feature.id}
                                        href="#"
                                        onClick={(e) => { e.preventDefault(); onSelectFeature(feature.id); }}
                                        className={`block w-full text-left px-3 py-2 rounded-md text-sm font-medium ${activeFeatureId === feature.id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-100'}`}
                                    >
                                        {feature.title}
                                    </a>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </nav>
            <div className="flex-shrink-0 p-4 border-t border-slate-200">
                <div className="flex items-center">
                    {user.profilePictureUrl ? (
                         <img src={user.profilePictureUrl} alt="Avatar" className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                         <UserCircleIcon className="w-10 h-10 text-slate-400" />
                    )}
                    <div className="ml-3">
                        <p className="text-sm font-semibold text-slate-800">{user.firstName} {user.lastName}</p>
                        <p className="text-xs text-slate-500">{user.role}</p>
                    </div>
                </div>
                <button
                    onClick={onLogout}
                    className="w-full mt-4 flex items-center justify-center px-3 py-2 rounded-md text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200"
                >
                    <PowerIcon className="w-4 h-4 mr-2" />
                    Déconnexion
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
