import React, { useState, useEffect } from 'react';

interface ForkProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFork: (projectName: string) => void;
  defaultName?: string;
}

const ForkProjectModal: React.FC<ForkProjectModalProps> = ({ isOpen, onClose, onFork, defaultName = "Forked Project" }) => {
  const [projectName, setProjectName] = useState(defaultName);

  useEffect(() => {
    if (isOpen) {
        setProjectName(defaultName);
    }
  }, [isOpen, defaultName]);

  if (!isOpen) return null;
  
  const handleFork = () => {
    if (projectName.trim()) {
        onFork(projectName.trim());
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center backdrop-blur-sm transition-opacity duration-300"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div 
        className="bg-slate-800 rounded-xl shadow-2xl p-6 w-full max-w-md m-4 ring-1 ring-slate-700 transition-transform transform scale-95 duration-300"
        style={{ transform: 'scale(1)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold text-slate-100 mb-4">Fork Project</h2>
        <div className="text-slate-300 mb-6">
          <p>Enter a name for your new forked project.</p>
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="e.g., My Awesome Project"
            className="mt-4 w-full bg-slate-700/50 border border-slate-600 text-slate-100 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
            onKeyDown={(e) => e.key === 'Enter' && handleFork()}
            autoFocus
          />
        </div>
        <div className="flex justify-end gap-4">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-600 hover:bg-slate-500 text-white font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500"
          >
            Cancel
          </button>
          <button
            onClick={handleFork}
            disabled={!projectName.trim()}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-500 disabled:cursor-not-allowed"
          >
            Fork
          </button>
        </div>
      </div>
    </div>
  );
};

export default ForkProjectModal;
