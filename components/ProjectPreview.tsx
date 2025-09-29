import React, { useState, useEffect, useCallback } from 'react';
import type { Project } from '../types';
import { getProject } from '../services/projectService';
import { createPreviewHtml } from '../utils/fileUtils';
import Loader from './Loader';

interface ProjectPreviewProps {
    projectId: string;
}

const ProjectPreview: React.FC<ProjectPreviewProps> = ({ projectId }) => {
    const [htmlContent, setHtmlContent] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [previewKey, setPreviewKey] = useState(Date.now());

    const loadProject = useCallback((isInitialLoad = false) => {
        if (isInitialLoad) {
            setIsLoading(true);
        }
        setError(null);
        getProject(projectId)
            .then(p => {
                if (p && p.files.length > 0) {
                    const content = createPreviewHtml(p.files);
                    setHtmlContent(content);
                    setPreviewKey(Date.now()); // Force iframe remount for reliable updates
                } else if (p) {
                    setError('Project has no files to preview.');
                    setHtmlContent(null);
                } else {
                    setError('Project not found.');
                    setHtmlContent(null);
                }
            })
            .catch(err => {
                const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
                setError(`Failed to load project: ${errorMessage}`);
                setHtmlContent(null);
            })
            .finally(() => {
                if (isInitialLoad) {
                    setIsLoading(false);
                }
            });
    }, [projectId]);

    useEffect(() => {
        loadProject(true); // Initial load

        const handleStorageChange = (event: StorageEvent) => {
            if (event.key === `preview-update-signal-${projectId}`) {
                loadProject(false); // Subsequent reloads
            }
        };

        window.addEventListener('storage', handleStorageChange);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
        };
    }, [projectId, loadProject]);
    
    if (isLoading) {
        return (
            <div className="w-screen h-screen flex flex-col justify-center items-center bg-slate-950">
                <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-indigo-500 mb-4"></div>
                <p className="mt-4 text-slate-300 text-lg">Loading Preview...</p>
            </div>
        );
    }
    
    if (error || !htmlContent) {
         return (
            <div className="w-screen h-screen flex flex-col justify-center items-center bg-slate-950 p-4">
                <p className="text-red-400 text-center">{error || 'Project could not be loaded for preview.'}</p>
            </div>
        );
    }

    return (
        <iframe
            key={previewKey}
            srcDoc={htmlContent}
            title={`Preview of project ${projectId}`}
            className="w-full h-screen border-none bg-white"
            sandbox="allow-scripts allow-same-origin allow-forms"
        />
    );
};

export default ProjectPreview;
