import React, { useState, useEffect } from 'react';
import type { Project } from '../types';
import { getProject } from '../services/projectService';
import { createPreviewUrl } from '../utils/fileUtils';
import Loader from './Loader';

interface ProjectPreviewProps {
    projectId: string;
}

const ProjectPreview: React.FC<ProjectPreviewProps> = ({ projectId }) => {
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let objectUrls: string[] = [];

        getProject(projectId)
            .then(p => {
                if (p && p.files.length > 0) {
                    const { previewUrl, blobUrls } = createPreviewUrl(p.files);
                    objectUrls = blobUrls;
                    setPreviewUrl(previewUrl);
                } else if (p) {
                    setError('Project has no files to preview.');
                } else {
                    setError('Project not found.');
                }
            })
            .catch(err => {
                setError(`Failed to load project: ${err.message}`);
            })
            .finally(() => {
                setIsLoading(false);
            });

        // Cleanup function to revoke blob URLs on component unmount
        return () => {
            objectUrls.forEach(url => URL.revokeObjectURL(url));
        };
    }, [projectId]);
    
    if (isLoading) {
        return (
            <div className="w-screen h-screen flex flex-col justify-center items-center bg-slate-950">
                <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-indigo-500 mb-4"></div>
                <p className="mt-4 text-slate-300 text-lg">Loading Preview...</p>
            </div>
        );
    }
    
    if (error || !previewUrl) {
         return (
            <div className="w-screen h-screen flex flex-col justify-center items-center bg-slate-950 p-4">
                <p className="text-red-400 text-center">{error || 'Project could not be loaded for preview.'}</p>
            </div>
        );
    }

    return (
        <iframe
            src={previewUrl}
            title={`Preview of project ${projectId}`}
            className="w-full h-screen border-none bg-white"
            sandbox="allow-scripts allow-same-origin"
        />
    );
};

export default ProjectPreview;