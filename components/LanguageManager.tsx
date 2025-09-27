import React from 'react';
import type { Feature } from '../types.ts';
import { InformationCircleIcon } from './Icons.tsx';
import { useI18n } from '../src/i18n/index.tsx';

interface LanguageManagerProps {
    feature: Feature;
}

const LanguageManager: React.FC<LanguageManagerProps> = ({ feature }) => {
    const { t } = useI18n();
    
    return (
        <div className="max-w-5xl mx-auto space-y-8">
            <header>
                <h1 className="text-4xl font-bold text-slate-900 tracking-tight">{t(feature.titleKey)}</h1>
                <p className="mt-2 text-lg text-slate-600">{t(feature.descriptionKey)}</p>
            </header>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-lg">
                    <div className="flex">
                        <div className="flex-shrink-0">
                            <InformationCircleIcon className="h-5 w-5 text-blue-400" aria-hidden="true" />
                        </div>
                        <div className="ml-3">
                            <h3 className="text-sm font-medium text-blue-800">{t('features.languages.userJourney.title')}</h3>
                            <div className="mt-2 text-sm text-blue-700">
                                <p>{t('features.languages.userJourney.steps.0')}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-6">
                     <h2 className="text-2xl font-semibold text-slate-800">{t('features.languages.simplificationTip.title')}</h2>
                     <p className="mt-4 text-slate-600">
                        {t('features.languages.simplificationTip.content')}
                     </p>
                </div>
            </div>
        </div>
    );
};

export default LanguageManager;
