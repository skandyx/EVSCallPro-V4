import React, { useState, useMemo } from 'react';
import type { Feature, IvrFlow, IvrNode } from '../types.ts';
import IvrDesigner from './IvrDesigner.tsx';
import { EditIcon, DuplicateIcon, TrashIcon, PlusIcon, ChevronDownIcon } from './Icons.tsx';

interface IvrFeatureProps {
    feature: Feature;
    ivrFlows: IvrFlow[];
    onSaveOrUpdateIvrFlow: (flow: IvrFlow) => void;
    onDeleteIvrFlow: (flowId: string) => void;
    onDuplicateIvrFlow: (flowId: string) => void;
}

const IvrFeature: React.FC<IvrFeatureProps> = ({
    feature,
    ivrFlows,
    onSaveOrUpdateIvrFlow,
    onDeleteIvrFlow,
    onDuplicateIvrFlow,
}) => {
    const [view, setView] = useState<'list' | 'editor'>('list');
    const [activeFlow, setActiveFlow] = useState<IvrFlow | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: keyof IvrFlow; direction: 'ascending' | 'descending' }>({ key: 'name', direction: 'ascending' });

    const filteredAndSortedFlows = useMemo(() => {
        let sortableFlows = [...ivrFlows];

        if (searchTerm) {
            const lowerCaseSearchTerm = searchTerm.toLowerCase();
            sortableFlows = sortableFlows.filter(flow =>
                flow.name.toLowerCase().includes(lowerCaseSearchTerm) ||
                flow.id.toLowerCase().includes(lowerCaseSearchTerm)
            );
        }

        sortableFlows.sort((a, b) => {
            const key = sortConfig.key;
            const aValue = a[key as keyof IvrFlow] as string;
            const bValue = b[key as keyof IvrFlow] as string;

            if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
            return 0;
        });

        return sortableFlows;
    }, [ivrFlows, searchTerm, sortConfig]);

    const requestSort = (key: keyof IvrFlow) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const SortableHeader: React.FC<{ sortKey: keyof IvrFlow; label: string }> = ({ sortKey, label }) => (
        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
            <button onClick={() => requestSort(sortKey)} className="group inline-flex items-center gap-1">
                {label}
                <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                    {sortConfig.key === sortKey
                        ? <ChevronDownIcon className={`w-4 h-4 transition-transform ${sortConfig.direction === 'ascending' ? 'rotate-180' : ''}`} />
                        : <ChevronDownIcon className="w-4 h-4 text-slate-400" />
                    }
                </span>
            </button>
        </th>
    );

    const handleCreateNew = () => {
        const startNode: IvrNode = {
            id: `node-start-${Date.now()}`,
            type: 'start',
            name: 'Début',
            x: 50,
            y: 150,
            content: {},
        };

        setActiveFlow({
            id: `ivr-flow-${Date.now()}`,
            name: "Nouveau Flux SVI",
            nodes: [startNode],
            connections: [],
        });
        setView('editor');
    };

    const handleEdit = (flow: IvrFlow) => {
        setActiveFlow(JSON.parse(JSON.stringify(flow))); // Deep copy
        setView('editor');
    };

    const handleSave = (flow: IvrFlow) => {
        onSaveOrUpdateIvrFlow(flow);
        setView('list');
        setActiveFlow(null);
    };

    const handleCloseEditor = () => {
        setView('list');
        setActiveFlow(null);
    };

    if (view === 'editor' && activeFlow) {
        return (
            <IvrDesigner
                flow={activeFlow}
                onSave={handleSave}
                onClose={handleCloseEditor}
            />
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-8">
            <header>
                <h1 className="text-4xl font-bold text-slate-900 tracking-tight">{feature.title}</h1>
                <p className="mt-2 text-lg text-slate-600">{feature.description}</p>
            </header>
            
            <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-semibold text-slate-800">Flux SVI Sauvegardés</h2>
                    <button
                        onClick={handleCreateNew}
                        className="bg-primary hover:bg-primary-hover text-primary-text font-bold py-2 px-4 rounded-lg shadow-md transition-colors inline-flex items-center"
                    >
                        <PlusIcon className="w-5 h-5 mr-2" />
                        Créer un nouveau flux
                    </button>
                </div>

                <div className="mb-4">
                    <input
                        type="text"
                        placeholder="Rechercher par nom ou ID de flux..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full max-w-lg p-2 border border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    />
                </div>

                {filteredAndSortedFlows.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50">
                                <tr>
                                    <SortableHeader sortKey="id" label="ID" />
                                    <SortableHeader sortKey="name" label="Nom du Flux" />
                                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-200">
                                {filteredAndSortedFlows.map(flow => (
                                    <tr key={flow.id}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 font-mono">{flow.id}</td>
                                        <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-800">{flow.name}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-4">
                                            <button onClick={() => handleEdit(flow)} className="text-indigo-600 hover:text-indigo-900 inline-flex items-center"><EditIcon className="w-4 h-4 mr-1"/> Modifier</button>
                                            <button onClick={() => onDuplicateIvrFlow(flow.id)} className="text-slate-500 hover:text-slate-800 inline-flex items-center"><DuplicateIcon className="w-4 h-4 mr-1"/> Dupliquer</button>
                                            <button onClick={() => onDeleteIvrFlow(flow.id)} className="text-red-600 hover:text-red-900 inline-flex items-center"><TrashIcon className="w-4 h-4 mr-1"/> Supprimer</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p className="text-slate-500 text-center py-8">Aucun flux SVI ne correspond à votre recherche ou aucun flux n'a été créé.</p>
                )}
            </div>
        </div>
    );
};

export default IvrFeature;