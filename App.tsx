
import React, { useState, useEffect, useCallback } from 'react';
import ProjectList from './components/ProjectList';
import ProjectEditor from './components/ProjectEditor';
import ProjectPreview from './components/ProjectPreview';

const App: React.FC = () => {
  const [route, setRoute] = useState({ name: 'list', projectId: null as string | null });

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1); // remove #
      const parts = hash.split('/').filter(p => p); // e.g., /project/123 -> ['project', '123']

      if (parts[0] === 'project' && parts[1]) {
        setRoute({ name: 'editor', projectId: parts[1] });
      } else if (parts[0] === 'preview' && parts[1]) {
        setRoute({ name: 'preview', projectId: parts[1] });
      } else {
        setRoute({ name: 'list', projectId: null });
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    handleHashChange(); // Initial check on load

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  const handleSelectProject = useCallback((id: string) => {
    window.location.hash = `/project/${id}`;
  }, []);

  const handleBackToList = useCallback(() => {
    window.location.hash = '';
  }, []);

  if (route.name === 'preview' && route.projectId) {
    return <ProjectPreview projectId={route.projectId} />;
  }

  return (
    <div className="bg-slate-900 min-h-screen font-sans text-slate-100">
      {route.name === 'editor' && route.projectId ? (
        <ProjectEditor projectId={route.projectId} onBack={handleBackToList} />
      ) : (
        <ProjectList onSelectProject={handleSelectProject} />
      )}
    </div>
  );
};

export default App;
