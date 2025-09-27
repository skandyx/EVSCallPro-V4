
import React from 'react';
import type { Feature } from '../types.ts';
import { UserJourneyIcon, SpecsIcon, LightbulbIcon } from './Icons.tsx';
import { useI18n } from '../src/i18n/index.tsx';

interface FeatureDetailProps {
  feature: Feature | null;
}

const FeatureDetail: React.FC<FeatureDetailProps> = ({ feature }) => {
  const { t } = useI18n();

  if (!feature) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500">
        <h2 className="text-2xl font-semibold">Bienvenue !</h2>
        <p className="mt-2 text-lg">Sélectionnez une fonctionnalité dans le menu de gauche pour commencer.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <header>
        {/* FIX: Replaced direct property access with translation function 't' to use i18n keys. */}
        <h1 className="text-4xl font-bold text-slate-900 tracking-tight">{t(feature.titleKey)}</h1>
        {/* FIX: Replaced direct property access with translation function 't' and corrected property name. */}
        <p className="mt-2 text-lg text-slate-600">{t(feature.descriptionKey)}</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
          <h2 className="text-2xl font-semibold text-slate-800 mb-4 flex items-center">
            <UserJourneyIcon className="w-6 h-6 mr-3 text-indigo-500" />
            {/* FIX: Replaced direct property access with translation function 't' to use i18n keys. */}
            {t(feature.userJourney.titleKey)}
          </h2>
          <ol className="list-decimal list-inside space-y-2 text-slate-700">
            {/* FIX: Corrected property name from 'steps' to 'stepsKeys' and translated each step key. */}
            {feature.userJourney.stepsKeys.map((step, index) => (
              <li key={index}>{t(step)}</li>
            ))}
          </ol>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
          <h2 className="text-2xl font-semibold text-slate-800 mb-4 flex items-center">
            <SpecsIcon className="w-6 h-6 mr-3 text-indigo-500" />
            {/* FIX: Replaced direct property access with translation function 't' to use i18n keys. */}
            {t(feature.specs.titleKey)}
          </h2>
          <ul className="list-disc list-inside space-y-2 text-slate-700">
            {/* FIX: Corrected property name from 'points' to 'pointsKeys' and translated each point key. */}
            {feature.specs.pointsKeys.map((point, index) => (
              <li key={index}>{t(point)}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-6 rounded-r-lg">
        <h3 className="text-lg font-bold text-yellow-900 mb-2 flex items-center">
          <LightbulbIcon className="w-6 h-6 mr-3 text-yellow-600" />
          {/* FIX: Replaced direct property access with translation function 't' to use i18n keys. */}
          {t(feature.simplificationTip.titleKey)}
        </h3>
        {/* FIX: Corrected property name from 'content' to 'contentKey' and translated the content. */}
        <p className="text-yellow-800">{t(feature.simplificationTip.contentKey)}</p>
      </div>
    </div>
  );
};

export default FeatureDetail;
