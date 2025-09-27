import React from 'react';
import type { Feature } from '../types.ts';

interface MonitoringDashboardProps {
  feature: Feature;
}

const MonitoringDashboard: React.FC<MonitoringDashboardProps> = ({ feature }) => {
  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <header>
        <h1 className="text-4xl font-bold text-slate-900 tracking-tight">{feature.title}</h1>
        <p className="mt-2 text-lg text-slate-600">{feature.description}</p>
      </header>
      <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
        <p className="text-center text-slate-500">
          Contenu pour la fonctionnalité "{feature.title}" à venir.
        </p>
      </div>
    </div>
  );
};

export default MonitoringDashboard;
