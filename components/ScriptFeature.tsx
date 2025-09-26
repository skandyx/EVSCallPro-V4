import React, { useState, useMemo } from 'react';
import type { Feature, SavedScript, Page, ScriptBlock } from '../types.ts';
import ScriptBuilder from './ScriptBuilder.tsx';
import AgentPreview from './AgentPreview.tsx';
import { EditIcon, DuplicateIcon, TrashIcon, PlusIcon, ChevronDownIcon } from './Icons.tsx';

interface ScriptFeatureProps {
    feature: Feature;
    savedScripts: SavedScript[];
    onSaveOrUpdateScript: (script: SavedScript) => void;
    onDeleteScript: (scriptId: string) => void;
    onDuplicateScript: (scriptId: string) => void;
}

const ScriptFeature: React.FC<ScriptFeatureProps> = ({
    feature,
    savedScripts,
    onSaveOrUpdateScript,
    onDeleteScript,
    onDuplicateScript
}) => {
    const [view, setView] = useState<'list' | 'editor' | 'preview'>('list');
    const [activeScript, setActiveScript] = useState<SavedScript | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: keyof SavedScript; direction: 'ascending' | 'descending' }>({ key: 'name', direction: 'ascending' });

    const filteredAndSortedScripts = useMemo(() => {
        let sortableScripts = [...savedScripts];

        if (searchTerm) {
            const lowerCaseSearchTerm = searchTerm.toLowerCase();
            sortableScripts = sortableScripts.filter(script =>
                script.name.toLowerCase().includes(lowerCaseSearchTerm) ||
                script.id.toLowerCase().includes(lowerCaseSearchTerm)
            );
        }

        sortableScripts.sort((a, b) => {
            const key = sortConfig.key;
            // Basic string comparison is sufficient for name and id
            const aValue = a[key as keyof SavedScript] as string;
            const bValue = b[key as keyof SavedScript] as string;

            if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
            return 0;
        });

        return sortableScripts;
    }, [savedScripts, searchTerm, sortConfig]);

    const requestSort = (key: keyof SavedScript) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const SortableHeader: React.FC<{ sortKey: keyof SavedScript; label: string }> = ({ sortKey, label }) => (
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
        const now = Date.now();
        const standardBlocks: ScriptBlock[] = [
            { id: `block-${now}-1`, name: 'Prénom', fieldName: 'first_name', type: 'input', x: 20, y: 20, width: 300, height: 70, content: { placeholder: 'Prénom du contact' }, isStandard: true, isVisible: true, displayCondition: null, parentId: null },
            { id: `block-${now}-2`, name: 'Nom', fieldName: 'last_name', type: 'input', x: 340, y: 20, width: 300, height: 70, content: { placeholder: 'Nom du contact' }, isStandard: true, isVisible: true, displayCondition: null, parentId: null },
            { id: `block-${now}-3`, name: 'Numéro de Téléphone', fieldName: 'phone_number', type: 'phone', x: 20, y: 110, width: 300, height: 70, content: { placeholder: 'Numéro de téléphone' }, isStandard: true, isVisible: true, displayCondition: null, parentId: null },
            { id: `block-${now}-4`, name: 'Code Postal', fieldName: 'postal_code', type: 'input', x: 340, y: 110, width: 300, height: 70, content: { placeholder: 'Code postal' }, isStandard: true, isVisible: true, displayCondition: null, parentId: null },
        ];

        const firstPage: Page = {
            id: `page-${now}`,
            name: "Page 1",
            blocks: standardBlocks
        };
        setActiveScript({
            id: `script-${now}`,
            name: "Nouveau Script",
            pages: [firstPage],
            startPageId: firstPage.id,
            backgroundColor: '#f1f5f9'
        });
        setView('editor');
    };

    const handleEdit = (script: SavedScript) => {
        setActiveScript(JSON.parse(JSON.stringify(script))); // Deep copy to avoid mutation
        setView('editor');
    };
    
    const handlePreview = (script: SavedScript) => {
        setActiveScript(script);
        setView('preview');
    };

    const handleSave = (script: SavedScript) => {
        onSaveOrUpdateScript(script);
        setView('list');
        setActiveScript(null);
    };

    const handleCloseEditor = () => {
        setView('list');
        setActiveScript(null);
    }

    if (view === 'editor' && activeScript) {
        return (
            <ScriptBuilder
                script={activeScript}
                onSave={handleSave}
                onClose={handleCloseEditor}
                onPreview={handlePreview}
            />
        );
    }
    
    if (view === 'preview' && activeScript) {
        return (
            <AgentPreview 
                script={activeScript}
                onClose={() => setView('editor')} // Go back to editor from preview
            />
        )
    }

    return (
        <div className="max-w-7xl mx-auto space-y-8">
            <header>
                <h1 className="text-4xl font-bold text-slate-900 tracking-tight">{feature.title}</h1>
                <p className="mt-2 text-lg text-slate-600">{feature.description}</p>
            </header>
            
            <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-semibold text-slate-800">Scripts Sauvegardés</h2>
                    <button
                        onClick={handleCreateNew}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-colors inline-flex items-center"
                    >
                        <PlusIcon className="w-5 h-5 mr-2" />
                        Créer un nouveau script
                    </button>
                </div>

                <div className="mb-4">
                    <input
                        type="text"
                        placeholder="Rechercher par nom ou ID de script..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full max-w-lg p-2 border border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    />
                </div>

                {filteredAndSortedScripts.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50">
                                <tr>
                                    <SortableHeader sortKey="id" label="ID" />
                                    <SortableHeader sortKey="name" label="Nom du Script" />
                                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-200">
                                {filteredAndSortedScripts.map(script => (
                                    <tr key={script.id}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 font-mono">{script.id}</td>
                                        <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-800">{script.name}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-4">
                                            <button onClick={() => handleEdit(script)} className="text-indigo-600 hover:text-indigo-900 inline-flex items-center"><EditIcon className="w-4 h-4 mr-1"/> Modifier</button>
                                            <button onClick={() => onDuplicateScript(script.id)} className="text-slate-500 hover:text-slate-800 inline-flex items-center"><DuplicateIcon className="w-4 h-4 mr-1"/> Dupliquer</button>
                                            <button onClick={() => onDeleteScript(script.id)} className="text-red-600 hover:text-red-900 inline-flex items-center"><TrashIcon className="w-4 h-4 mr-1"/> Supprimer</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p className="text-slate-500 text-center py-8">Aucun script ne correspond à votre recherche ou aucun script n'a été créé.</p>
                )}
            </div>
        </div>
    );
};

export default ScriptFeature;