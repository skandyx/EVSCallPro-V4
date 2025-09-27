import React from 'react';
import type { User } from '../types.ts';
import { UserCircleIcon, PowerIcon } from './Icons.tsx';

interface HeaderProps {
    user: User;
    onLogout: () => void;
}

const Header: React.FC<HeaderProps> = ({ user, onLogout }) => {
    return (
        <header className="flex justify-between items-center p-4 bg-white border-b border-slate-200">
            <div>
                {/* Could add breadcrumbs or title here */}
            </div>
            <div className="flex items-center gap-4">
                 <div className="text-right">
                    <p className="text-sm font-semibold text-slate-800">{user.firstName} {user.lastName}</p>
                    <p className="text-xs text-slate-500">{user.role}</p>
                </div>
                <UserCircleIcon className="w-10 h-10 text-slate-400" />
                <button onClick={onLogout} title="Logout" className="p-2 rounded-full hover:bg-slate-100">
                    <PowerIcon className="w-5 h-5 text-slate-600" />
                </button>
            </div>
        </header>
    );
};

export default Header;
