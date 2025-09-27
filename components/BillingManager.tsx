import React from 'react';
import type { Feature } from '../types.ts';
import { CreditCardIcon } from './Icons.tsx';

interface BillingManagerProps {
    feature: Feature;
}

const BillingManager: React.FC<BillingManagerProps> = ({ feature }) => {
    return (
        <div className="max-w-5xl mx-auto space-y-8">
            <header>
                <h1 className="text-4xl font-bold text-slate-900 tracking-tight flex items-center">
                    <CreditCardIcon className="w-9 h-9 mr-3 text-indigo-600"/>
                    {feature.title}
                </h1>
                <p className="mt-2 text-lg text-slate-600">{feature.description}</p>
            </header>
            <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                <h2 className="text-2xl font-semibold text-slate-800">Module de Facturation</h2>
                <p className="mt-4 text-slate-600">
                    Ce module est en cours de développement. Il permettra de gérer les abonnements, de consulter l'historique de facturation et de télécharger les factures.
                </p>
            </div>
        </div>
    );
};

export default BillingManager;