import React, { useState, useEffect, useCallback } from 'react';
import ProjectList from './components/ProjectList';
import ProjectEditor from './components/ProjectEditor';
import ProjectPreview from './components/ProjectPreview';

type AppRoute = 
  | { name: 'list' }
  | { name: 'editor', projectId: string }
  | { name: 'preview', projectId: string };

const App: React.FC = () => {
  const [route, setRoute] = useState<AppRoute>({ name: 'list' });

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1); // remove #
      const parts = hash.split('/').filter(p => p); // e.g., /project/123 -> ['project', '123']

      if (parts[0] === 'project' && parts[1]) {
        setRoute({ name: 'editor', projectId: parts[1] });
      } else if (parts[0] === 'preview' && parts[1]) {
        setRoute({ name: 'preview', projectId: parts[1] });
      } else {
        setRoute({ name: 'list' });
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

  const renderContent = () => {
    switch(route.name) {
      case 'preview':
        return <ProjectPreview projectId={route.projectId} />;
      case 'editor':
        return <ProjectEditor projectId={route.projectId} onBack={handleBackToList} />;
      case 'list':
      default:
        return <ProjectList onSelectProject={handleSelectProject} />;
    }
  }

  return (
    <div className="bg-slate-900 min-h-screen font-sans text-slate-200">
      {renderContent()}
    </div>
  );
};

export default App;