
import React, { useState, useCallback } from 'react';
import ProjectList from './components/ProjectList';
import ProjectEditor from './components/ProjectEditor';

const App: React.FC = () => {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const handleSelectProject = useCallback((id: string) => {
    setSelectedProjectId(id);
  }, []);

  const handleBackToList = useCallback(() => {
    setSelectedProjectId(null);
  }, []);

  return (
    <div className="bg-slate-900 min-h-screen font-sans text-slate-100">
      {selectedProjectId ? (
        <ProjectEditor projectId={selectedProjectId} onBack={handleBackToList} />
      ) : (
        <ProjectList onSelectProject={handleSelectProject} />
      )}
    </div>
  );
};

export default App;
