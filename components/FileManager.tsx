// components/FileManager.tsx
import React, { useState, useEffect } from 'react';
import type { Feature } from '../types.ts';
import { FolderIcon, ArrowDownTrayIcon } from './Icons.tsx';
import { useI18n } from '../src/i18n/index.tsx';
import apiClient from '../src/lib/axios.ts';

interface FileNode {
    name: string;
    type: 'folder' | 'file';
    path: string;
    children?: FileNode[];
}

const FileManager: React.FC<{ feature: Feature }> = ({ feature }) => {
    const { t } = useI18n();
    const [fileTree, setFileTree] = useState<FileNode[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchFiles = async () => {
            setIsLoading(true);
            try {
                const response = await apiClient.get('/files');
                setFileTree(response.data);
            } catch (error) {
                console.error("Failed to fetch file list:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchFiles();
    }, []);

    const FileTree: React.FC<{ nodes: FileNode[], level?: number }> = ({ nodes, level = 0 }) => {
        return (
            <div>
                {nodes.sort((a,b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name)).map(node => (
                    <div key={node.path}>
                        <div 
                            className="flex items-center p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700"
                            style={{ paddingLeft: `${1 + level * 1.5}rem` }}
                        >
                            {node.type === 'folder' ? (
                                <FolderIcon className="w-5 h-5 mr-3 text-amber-500" />
                            ) : (
                                <div className="w-5 h-5 mr-3" /> // Placeholder for alignment
                            )}
                            <span className="font-medium text-slate-700 dark:text-slate-300 flex-1">{node.name}</span>
                            {node.type === 'file' && (
                                <a 
                                    href={`/files/${node.path}`} 
                                    download 
                                    className="text-indigo-600 dark:text-indigo-400 hover:underline text-sm font-semibold inline-flex items-center gap-1"
                                >
                                    <ArrowDownTrayIcon className="w-4 h-4" />
                                    {t('common.download')}
                                </a>
                            )}
                        </div>
                        {node.children && <FileTree nodes={node.children} level={level + 1} />}
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="space-y-8">
            <header>
                <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">{t(feature.titleKey)}</h1>
                <p className="mt-2 text-lg text-slate-600 dark:text-slate-400">{t(feature.descriptionKey)}</p>
            </header>
            <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-200 mb-4">{t('fileManager.title')}</h2>
                {isLoading ? (
                    <p className="text-center text-slate-500 dark:text-slate-400 py-8">{t('common.loading')}...</p>
                ) : (
                    <div className="border rounded-md dark:border-slate-700">
                        <FileTree nodes={fileTree} />
                    </div>
                )}
            </div>
        </div>
    );
};

export default FileManager;
