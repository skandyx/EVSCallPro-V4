import React from 'react';
import type { Feature } from '../types.ts';
import { CreditCardIcon } from './Icons.tsx';
import { useI18n } from '../src/i18n/index.tsx';

interface BillingManagerProps {
    feature: Feature;
}

const BillingManager: React.FC<BillingManagerProps> = ({ feature }) => {
    const { t } = useI18n();
    return (
        <div className="max-w-5xl mx-auto space-y-8">
            <header>
                <h1 className="text-4xl font-bold text-slate-900 tracking-tight flex items-center">
                    <CreditCardIcon className="w-9 h-9 mr-3 text-indigo-600"/>
                    {/* FIX: Replaced direct property access with translation function 't' to use i18n keys. */}
                    {t(feature.titleKey)}
                </h1>
                {/* FIX: Replaced direct property access with translation function 't' and corrected property name. */}
                <p className="mt-2 text-lg text-slate-600">{t(feature.descriptionKey)}</p>
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