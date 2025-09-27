import React, { useState, useEffect } from 'react';
import { getProjects, saveProject, deleteProject } from '../services/projectService';
import type { Project } from '../types';
import { PlusIcon, TrashIcon, CodeIcon } from './Icons';
import ConfirmModal from './ConfirmModal';

interface ProjectListProps {
  onSelectProject: (id: string) => void;
}

const ProjectList: React.FC<ProjectListProps> = ({ onSelectProject }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [newProjectName, setNewProjectName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);

  useEffect(() => {
    getProjects().then(projects => {
      setProjects(projects.sort((a, b) => b.updatedAt - a.updatedAt));
    });
  }, []);

  const handleCreateProject = async () => {
    if (newProjectName.trim() === '') return;
    const newProject: Project = {
      id: `proj_${Date.now()}`,
      name: newProjectName.trim(),
      files: [],
      chatHistory: [],
      updatedAt: Date.now(),
      currentSessionId: Math.random().toString(36).substring(2, 9),
    };
    await saveProject(newProject);
    setProjects(prev => [newProject, ...prev].sort((a, b) => b.updatedAt - a.updatedAt));
    setNewProjectName('');
    setIsCreating(false);
    onSelectProject(newProject.id);
  };

  const handleDeleteRequest = (project: Project) => {
    setProjectToDelete(project);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!projectToDelete) return;
    await deleteProject(projectToDelete.id);
    setProjects(projects.filter(p => p.id !== projectToDelete.id));
    setIsDeleteModalOpen(false);
    setProjectToDelete(null);
  };

  return (
    <>
      <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
        <header className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-slate-100">My Projects</h1>
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition-transform transform hover:scale-105"
          >
            <PlusIcon />
            New Project
          </button>
        </header>
        
        {isCreating && (
          <div className="bg-slate-800 p-4 rounded-lg mb-6 shadow-lg">
              <h2 className="text-lg font-semibold mb-2">Create a New Project</h2>
              <div className="flex gap-2">
                  <input
                      type="text"
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      placeholder="Enter project name..."
                      className="flex-grow bg-slate-700 border border-slate-600 text-slate-100 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
                  />
                  <button onClick={handleCreateProject} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-4 rounded-md">Create</button>
                  <button onClick={() => setIsCreating(false)} className="bg-slate-600 hover:bg-slate-500 text-white font-bold py-2 px-4 rounded-md">Cancel</button>
              </div>
          </div>
        )}

        {projects.length === 0 && !isCreating ? (
          <div className="text-center py-16 px-6 bg-slate-800 rounded-lg shadow-inner">
              <CodeIcon className="w-16 h-16 mx-auto text-slate-500 mb-4" />
            <h2 className="text-xl font-semibold text-slate-300">No projects yet</h2>
            <p className="text-slate-400 mt-2">Click "New Project" to start building something amazing.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map(project => (
              <div key={project.id} className="bg-slate-800 rounded-lg shadow-lg overflow-hidden flex flex-col justify-between hover:ring-2 hover:ring-indigo-500 transition-all duration-300">
                <div className="p-5 cursor-pointer" onClick={() => onSelectProject(project.id)}>
                  <h3 className="font-bold text-lg truncate text-slate-100">{project.name}</h3>
                  <p className="text-sm text-slate-400 mt-1">
                    Last updated: {new Date(project.updatedAt).toLocaleString()}
                  </p>
                  <p className="text-sm text-slate-400 mt-1">
                    {project.files.length} file{project.files.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="bg-slate-800/50 p-3 flex justify-end">
                  <button onClick={(e) => { e.stopPropagation(); handleDeleteRequest(project); }} className="text-slate-400 hover:text-red-500 p-2 rounded-full transition-colors">
                    <TrashIcon />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Confirm Deletion"
        confirmText="Delete"
      >
        <p>Are you sure you want to delete the project named <strong className="font-semibold text-slate-100">"{projectToDelete?.name}"</strong>?</p>
        <p className="mt-2 text-sm text-slate-400">This action cannot be undone.</p>
      </ConfirmModal>
    </>
  );
};

export default ProjectList;