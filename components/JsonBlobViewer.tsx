
import React, { useState, useEffect, useCallback } from 'react';
import type { Project, ProjectFile, StyleLibrary, TemplateType } from '../types';
import { saveProject } from '../services/projectService';
import ForkProjectModal from './ForkProjectModal';
import { GitBranchIcon } from './Icons';

interface JsonBlobViewerProps {
    blobId: string;
}

interface ForkableProjectData {
    files: ProjectFile[];
    template: TemplateType;
    styleLibrary: StyleLibrary;
    name: string;
}

const JsonBlobViewer: React.FC<JsonBlobViewerProps> = ({ blobId }) => {
    const [htmlContent, setHtmlContent] = useState<string | null>(null);
    const [forkableProjectData, setForkableProjectData] = useState<ForkableProjectData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isForkModalOpen, setIsForkModalOpen] = useState(false);

    useEffect(() => {
        fetch(`https://jsonblob.com/api/jsonBlob/${blobId}`)
            .then(res => {
                if (!res.ok) {
                    throw new Error(`Could not fetch content from JSONBlob: ${res.statusText}`);
                }
                return res.json();
            })
            .then(data => {
                if (data && data.previewHtml && Array.isArray(data.files)) {
                    setHtmlContent(data.previewHtml);
                    setForkableProjectData({
                        files: data.files,
                        template: data.template === 'vanilla' ? 'blank' : data.template || 'blank',
                        styleLibrary: data.styleLibrary || 'none',
                        name: data.name || `Fork of ${blobId.substring(0,8)}`
                    });
                } 
                else if (data && data.html && typeof data.html === 'string') {
                    setHtmlContent(data.html);
                    setForkableProjectData({
                        files: [{ path: 'index.html', content: data.html }],
                        template: 'blank', // Legacy 'html' type maps to 'blank'
                        styleLibrary: 'none',
                        name: `Fork of ${blobId.substring(0,8)}`
                    });
                } else {
                    setError('Invalid content format found at the URL.');
                }
            })
            .catch(err => {
                const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
                setError(`Failed to load content: ${errorMessage}`);
            })
            .finally(() => {
                setIsLoading(false);
            });
    }, [blobId]);

    const handleForkProject = useCallback(async (projectName: string) => {
        if (!forkableProjectData) {
            alert('Cannot fork project: content is not available.');
            return;
        }

        const newProject: Project = {
            id: `proj_${Date.now()}`,
            name: projectName,
            files: forkableProjectData.files,
            chatHistory: [],
            updatedAt: Date.now(),
            currentSessionId: Math.random().toString(36).substring(2, 9),
            template: forkableProjectData.template,
            styleLibrary: forkableProjectData.styleLibrary,
        };

        try {
            await saveProject(newProject);
            setIsForkModalOpen(false);
            // Navigate to the new project
            window.location.hash = `/project/${newProject.id}`;
        } catch (err) {
            console.error('Failed to save forked project:', err);
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
            alert(`Failed to fork project: ${errorMessage}`);
        }

    }, [forkableProjectData]);
    
    if (isLoading) {
        return (
            <div className="w-screen h-screen flex flex-col justify-center items-center bg-slate-950">
                <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-indigo-500 mb-4"></div>
                <p className="mt-4 text-slate-300 text-lg">Loading Content...</p>
            </div>
        );
    }
    
    if (error || !htmlContent) {
         return (
            <div className="w-screen h-screen flex flex-col justify-center items-center bg-slate-950 p-4">
                <h1 className="text-2xl font-bold text-red-400 mb-4">Error</h1>
                <p className="text-red-300 text-center">{error || 'Content could not be loaded.'}</p>
            </div>
        );
    }

    return (
        <div className="w-screen h-screen relative">
            <header className="absolute top-0 left-0 right-0 h-16 bg-slate-900/80 backdrop-blur-sm z-10 flex items-center justify-between px-4 sm:px-6">
                <h1 className="text-lg font-semibold text-slate-200">Public Preview</h1>
                <button
                    onClick={() => setIsForkModalOpen(true)}
                    className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold py-2 px-4 rounded-lg shadow-lg transition-transform transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-indigo-500/50"
                >
                    <GitBranchIcon className="w-5 h-5" />
                    Fork Project
                </button>
            </header>
            <iframe
                srcDoc={htmlContent}
                title={`Public preview ${blobId}`}
                className="w-full h-full border-none bg-white"
                sandbox="allow-scripts allow-same-origin allow-forms"
            />
            <ForkProjectModal
                isOpen={isForkModalOpen}
                onClose={() => setIsForkModalOpen(false)}
                onFork={handleForkProject}
                defaultName={forkableProjectData?.name || `Fork of ${blobId.substring(0,8)}`}
            />
        </div>
    );
};
export default JsonBlobViewer;