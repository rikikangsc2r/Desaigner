import React, { useState, useEffect } from 'react';
import { getProjects, saveProject, deleteProject } from '../services/projectService';
import { getTemplateFiles } from '../services/templates';
import type { Project, TemplateType, StyleLibrary } from '../types';
import { PlusIcon, TrashIcon, CodeIcon, FolderIcon, BoxIcon, IdCardIcon, NewspaperIcon, RocketIcon } from './Icons';
import ConfirmModal from './ConfirmModal';

interface ProjectListProps {
  onSelectProject: (id: string) => void;
}

const projectTemplates: { id: TemplateType; name: string; desc: string; Icon: React.FC<{className?: string;}> }[] = [
    { id: 'blank', name: 'Blank Project', desc: 'A classic starting point with HTML, CSS, and JS.', Icon: BoxIcon },
    { id: 'portfolio', name: 'Portfolio', desc: 'A simple, clean page to showcase your work.', Icon: IdCardIcon },
    { id: 'blog', name: 'Blog', desc: 'A classic blog layout with a main content area and sidebar.', Icon: NewspaperIcon },
    { id: 'landing-page', name: 'Landing Page', desc: 'A hero section, features, and a call-to-action.', Icon: RocketIcon },
];

const styles: { id: StyleLibrary; name: string }[] = [
    { id: 'none', name: 'None' },
    { id: 'tailwindcss', name: 'TailwindCSS' },
    { id: 'bootstrap', name: 'Bootstrap' },
];

const TemplateButton: React.FC<{ 
  id: TemplateType; 
  name: string; 
  desc: string; 
  isSelected: boolean; 
  onSelect: (id: TemplateType) => void;
  Icon: React.FC<{className?: string}>;
}> = ({ id, name, desc, isSelected, onSelect, Icon }) => (
    <button 
      onClick={() => onSelect(id)}
      className={`p-4 border-2 rounded-lg text-left transition-all duration-200 flex items-center gap-4 ${isSelected ? 'border-indigo-500 bg-indigo-900/30 ring-2 ring-indigo-500' : 'border-slate-700 hover:border-indigo-500/50 bg-slate-800'}`}
    >
      <div className="p-3 bg-slate-700/50 rounded-lg">
        <Icon className="w-6 h-6 text-indigo-400" />
      </div>
      <div>
        <h3 className="font-bold text-lg text-slate-100">{name}</h3>
        <p className="text-sm text-slate-400 mt-1">{desc}</p>
      </div>
    </button>
);


const ProjectList: React.FC<ProjectListProps> = ({ onSelectProject }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [newProjectName, setNewProjectName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateType>('blank');
  const [selectedStyle, setSelectedStyle] = useState<StyleLibrary>('none');

  useEffect(() => {
    getProjects().then(projects => {
      setProjects(projects.sort((a, b) => b.updatedAt - a.updatedAt));
    });
  }, []);

  const handleCreateProject = async () => {
    if (newProjectName.trim() === '') return;

    const templateFiles = getTemplateFiles(selectedTemplate, newProjectName.trim(), selectedStyle);

    const newProject: Project = {
      id: `proj_${Date.now()}`,
      name: newProjectName.trim(),
      files: templateFiles,
      chatHistory: [],
      updatedAt: Date.now(),
      currentSessionId: Math.random().toString(36).substring(2, 9),
      template: selectedTemplate,
      styleLibrary: selectedStyle,
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
      <div className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8">
        <header className="flex justify-between items-center mb-10">
          <h1 className="text-4xl font-extrabold text-slate-100 tracking-tight">My Projects</h1>
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold py-2 px-5 rounded-lg shadow-lg transition-transform transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-indigo-500/50"
          >
            <PlusIcon />
            New Project
          </button>
        </header>
        
        {isCreating && (
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 p-6 rounded-xl mb-10 shadow-2xl transition-all duration-300">
              <h2 className="text-2xl font-bold mb-6">Create a New Project</h2>
              
              <div className="mb-6">
                <label htmlFor="projectName" className="block text-sm font-medium text-slate-300 mb-2">Project Name</label>
                <input
                    id="projectName"
                    type="text"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="e.g., My Awesome Portfolio"
                    className="w-full bg-slate-700/50 border border-slate-600 text-slate-100 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
                    autoFocus
                />
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-300 mb-3">Choose a Starting Point</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {projectTemplates.map(t => (
                      <TemplateButton 
                        key={t.id} 
                        {...t} 
                        isSelected={selectedTemplate === t.id} 
                        onSelect={setSelectedTemplate} 
                      />
                    ))}
                </div>
              </div>

              <div className="mb-8">
                <label className="block text-sm font-medium text-slate-300 mb-3">Select a Style CDN (Optional)</label>
                <div className="flex flex-wrap gap-3">
                    {styles.map(s => (
                        <button key={s.id} onClick={() => setSelectedStyle(s.id)}
                            className={`px-4 py-2 text-sm font-semibold rounded-full border-2 transition-colors ${selectedStyle === s.id ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-700/50 border-slate-600 hover:border-slate-500 text-slate-200'}`}>
                            {s.name}
                        </button>
                    ))}
                </div>
              </div>

              <div className="flex justify-end gap-4">
                  <button onClick={() => setIsCreating(false)} className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-5 rounded-lg transition-colors">Cancel</button>
                  <button onClick={handleCreateProject} disabled={!newProjectName.trim()} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-5 rounded-lg disabled:bg-slate-500 disabled:cursor-not-allowed transition-colors">Create Project</button>
              </div>
          </div>
        )}

        {projects.length === 0 && !isCreating ? (
          <div className="text-center py-20 px-6 bg-slate-800/50 border border-slate-700 rounded-xl shadow-inner">
              <CodeIcon className="w-20 h-20 mx-auto text-slate-600 mb-6" />
            <h2 className="text-2xl font-semibold text-slate-300">Your workspace is empty</h2>
            <p className="text-slate-400 mt-2 max-w-md mx-auto">Start by creating a new project and let the AI build something amazing for you.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map(project => (
              <div key={project.id} className="group bg-slate-800 rounded-xl shadow-lg flex flex-col justify-between transition-all duration-300 border border-slate-700 hover:border-indigo-500/80 hover:shadow-indigo-500/10 hover:shadow-2xl hover:-translate-y-1">
                <div className="p-5 cursor-pointer flex-grow flex flex-col" onClick={() => onSelectProject(project.id)}>
                    <div className="flex-grow">
                        <div className="flex justify-between items-start">
                            <div className="p-3 bg-slate-700/50 rounded-lg inline-block">
                                <FolderIcon className="w-6 h-6 text-indigo-400" />
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); handleDeleteRequest(project); }} className="text-slate-500 hover:text-red-500 p-2 -mr-2 -mt-2 rounded-full transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100" aria-label={`Delete project ${project.name}`}>
                                <TrashIcon className="w-5 h-5"/>
                            </button>
                        </div>
                        <h3 className="font-bold text-lg mt-4 text-slate-100">{project.name}</h3>
                    </div>
                    <p className="text-sm text-slate-400 mt-2">
                        {project.files.length} file{project.files.length !== 1 ? 's' : ''}
                    </p>
                </div>
                <div className="bg-slate-800/30 px-5 py-3 border-t border-slate-700">
                   <p className="text-xs text-slate-500">
                    Last updated: {new Date(project.updatedAt).toLocaleString()}
                  </p>
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
        <p className="mt-2 text-sm text-slate-400">This action cannot be undone and all files will be permanently removed.</p>
      </ConfirmModal>
    </>
  );
};

export default ProjectList;
