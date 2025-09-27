
import React, { useState, useEffect } from 'react';
import type { Project } from '../types';
import { getProject } from '../services/projectService';
import { createPreviewContent } from '../utils/fileUtils';
import Loader from './Loader';

interface ProjectPreviewProps {
    projectId: string;
}

const ProjectPreview: React.FC<ProjectPreviewProps> = ({ projectId }) => {
    const [project, setProject] = useState<Project | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        getProject(projectId)
            .then(p => {
                if (p) {
                    setProject(p);
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
    }, [projectId]);
    
    if (isLoading) {
        return (
            <div className="w-screen h-screen flex flex-col justify-center items-center bg-slate-900">
                <Loader />
                <p className="mt-4 text-slate-300">Loading Preview...</p>
            </div>
        );
    }
    
    if (error || !project) {
         return (
            <div className="w-screen h-screen flex flex-col justify-center items-center bg-slate-900">
                <p className="text-red-400">{error || 'Project could not be loaded.'}</p>
            </div>
        );
    }

    const previewContent = createPreviewContent(project.files);

    return (
        <iframe
            srcDoc={previewContent}
            title={`Preview of ${project.name}`}
            className="w-full h-screen border-none"
            sandbox="allow-scripts allow-same-origin"
        />
    );
};

export default ProjectPreview;
