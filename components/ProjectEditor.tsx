

import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Project, ProjectFile, ChatMessage, FileOperation, BlueprintFile, FileOperationType } from '../types';
import { getProject, saveProject } from '../services/projectService';
import { runAIAgentWorkflow, AIConversationalError } from '../services/aiService';
import { createProjectZip, createPreviewHtml } from '../utils/fileUtils';
import { BackIcon, CodeIcon, DownloadIcon, EyeIcon, SendIcon, UserIcon, BotIcon, EditIcon, RefreshIcon, MenuIcon, XIcon, CloudUploadIcon, SpinnerIcon } from './Icons';
import { TypingIndicator } from './Loader';
import FileTree from './FileTree';
import CodeEditor from './CodeEditor';
import ShareModal from './ShareModal';

interface ProjectEditorProps {
  projectId: string;
  onBack: () => void;
}

type MobileView = 'files' | 'editor' | 'chat';

/**
 * Sends a signal to the preview window via localStorage to trigger a refresh.
 * @param projectId The ID of the project to signal an update for.
 */
const signalPreviewUpdate = (projectId: string) => {
  if (!projectId) return;
  localStorage.setItem(`preview-update-signal-${projectId}`, Date.now().toString());
};


const applyOperation = (currentFiles: ProjectFile[], operation: FileOperation): ProjectFile[] => {
  let updatedFiles = [...currentFiles];
  const { operation: opType, path, content = '' } = operation;
  
  const fileExists = updatedFiles.some(f => f.path === path);

  switch (opType) {
    case 'CREATE':
      if (fileExists) {
        // If file exists, treat CREATE as an UPDATE to be safe
        updatedFiles = updatedFiles.map(f =>
          f.path === path ? { ...f, content } : f
        );
      } else {
        updatedFiles.push({ path, content });
      }
      break;
    case 'UPDATE':
       if (!fileExists) {
        // If file doesn't exist, treat UPDATE as a CREATE
         updatedFiles.push({ path, content });
       } else {
         updatedFiles = updatedFiles.map(f =>
          f.path === path ? { ...f, content } : f
        );
       }
      break;
    case 'DELETE':
      updatedFiles = updatedFiles.filter(f => f.path !== path);
      break;
    default:
      console.warn(`Unknown operation type: ${opType}`);
  }
  return updatedFiles;
};


const ChatWindow: React.FC<{ chatHistory: ChatMessage[], isLoading: boolean }> = ({ chatHistory, isLoading }) => {
    const chatEndRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatHistory, isLoading]);

    return (
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 space-y-4 overflow-y-auto p-4">
                {chatHistory.filter(msg => msg.role !== 'system').map((msg, index) => (
                    <div key={index} className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                        {msg.role === 'assistant' && (
                           <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center flex-shrink-0 mt-1 ring-1 ring-indigo-500/30">
                             <BotIcon className="w-5 h-5 text-indigo-100" />
                           </div>
                        )}
                        <div className={`max-w-[85%] lg:max-w-md p-3 rounded-lg ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-200'}`}>
                            <p className="whitespace-pre-wrap break-words" dangerouslySetInnerHTML={{ __html: msg.content.replace(/\n/g, '<br />').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code class="bg-slate-800 rounded-sm px-1 font-mono text-sm">$1</code>') }}></p>
                        </div>
                        {msg.role === 'user' && (
                          <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center flex-shrink-0 mt-1">
                            <UserIcon className="w-5 h-5 text-slate-300" />
                          </div>
                        )}
                    </div>
                ))}
                {isLoading && <div className="flex items-start gap-3"><div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center flex-shrink-0 mt-1 ring-1 ring-indigo-500/30"><BotIcon className="w-5 h-5 text-indigo-100" /></div><TypingIndicator/></div>}
                <div ref={chatEndRef} />
            </div>
        </div>
    );
}

const ProjectEditor: React.FC<ProjectEditorProps> = ({ projectId, onBack }) => {
  const [project, setProject] = useState<Project | null>(null);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [editorContent, setEditorContent] = useState<string>('');
  const [isEditorDirty, setIsEditorDirty] = useState(false);
  const [activeView, setActiveView] = useState<MobileView>('chat');
  const [isEditorFullscreen, setIsEditorFullscreen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState('');
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const projectRef = useRef<Project | null>(null);

  useEffect(() => {
      projectRef.current = project;
  }, [project]);

  useEffect(() => {
    const setAppHeight = () => {
      document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
    };
    window.addEventListener('resize', setAppHeight);
    setAppHeight();

    return () => window.removeEventListener('resize', setAppHeight);
  }, []);


  useEffect(() => {
    getProject(projectId).then(p => {
        if (p) {
            // Add defaults for projects created before template/style properties existed
            const projectWithDefaults: Project = {
                ...p,
                // FIX: Changed default template from deprecated 'vanilla' to 'blank'.
                template: p.template || 'blank',
                styleLibrary: p.styleLibrary || 'none',
                currentSessionId: p.currentSessionId || Math.random().toString(36).substring(2, 9),
            };

            setProject(projectWithDefaults);
            // Save back if defaults were added
            if (!p.template || !p.styleLibrary || !p.currentSessionId) {
                saveProject(projectWithDefaults).catch(err => {
                    console.error("Failed to save project with new defaults:", err);
                });
            }
        } else {
            setError(`Project tidak ditemukan.`);
        }
    }).catch(err => {
        console.error("Failed to load project:", err);
        const errorMessage = err instanceof Error ? err.message : 'Terjadi kesalahan yang tidak diketahui.';
        setError(`Gagal memuat proyek: ${errorMessage}`);
    });
  }, [projectId]);

  const handleSelectFile = useCallback((path: string) => {
    if (isEditorDirty) {
      if (!confirm('Anda memiliki perubahan yang belum disimpan. Apakah Anda yakin ingin beralih file dan membuangnya?')) {
        return;
      }
    }
    const file = project?.files.find(f => f.path === path);
    if (file) {
      setSelectedFilePath(path);
      setEditorContent(file.content);
      setIsEditorDirty(false);
      // Switch to editor view on mobile for better UX
      if (window.innerWidth < 1024) {
        setActiveView('editor');
      }
    }
  }, [project, isEditorDirty]);

  const handleEditorChange = (newContent: string) => {
    setEditorContent(newContent);
    setIsEditorDirty(true);
  };
  
  const handleSaveFile = useCallback(async (options: { signal?: boolean } = {}) => {
    const { signal = true } = options;
    if (!project || !selectedFilePath || !isEditorDirty) return;
    
    const updatedFiles = project.files.map(f =>
      f.path === selectedFilePath ? { ...f, content: editorContent } : f
    );
    
    const updatedProject = {
      ...project,
      files: updatedFiles,
      updatedAt: Date.now(),
    };
    
    setProject(updatedProject);
    await saveProject(updatedProject);
    setIsEditorDirty(false);

    if (signal) {
      signalPreviewUpdate(project.id);
    }
  }, [project, selectedFilePath, editorContent, isEditorDirty]);

  const handleSendMessage = useCallback(async () => {
    if (!userInput.trim() || !project) return;

    if (isEditorDirty) {
        if (confirm('Anda memiliki perubahan yang belum disimpan di editor. Simpan sebelum mengirim pesan?')) {
            await handleSaveFile({ signal: false });
        }
    }

    const userGoal = userInput;
    const originalTimestamp = project.updatedAt;
    setUserInput('');
    setIsLoading(true);
    setError(null);
    
    let workingProject = projectRef.current!;

    const applyUpdate = (updater: (p: Project) => Project) => {
        workingProject = updater(workingProject);
        setProject(workingProject);
    };

    const userMessage: ChatMessage = { role: 'user', content: userGoal };
    applyUpdate(p => ({ ...p, chatHistory: [...p.chatHistory, userMessage] }));

    try {
        // New Single API Call Workflow
        const { explanation, operations } = await runAIAgentWorkflow(userGoal, workingProject.files, workingProject.template, workingProject.styleLibrary);

        // 1. Show the explanation from the AI as its response.
        const explanationMessage: ChatMessage = { role: 'assistant', content: explanation };
        applyUpdate(p => ({
            ...p,
            chatHistory: [...p.chatHistory, explanationMessage]
        }));
        
        // 2. Apply the file operations if any were generated
        if (operations.length > 0) {
            let currentFiles = workingProject.files;
            for (const op of operations) {
                currentFiles = applyOperation(currentFiles, op);
                
                // Update editor if the selected file was changed
                if (op.path === selectedFilePath) {
                    if(op.operation === 'DELETE') { 
                        setSelectedFilePath(null);
                        setEditorContent('');
                    } else {
                        setEditorContent(op.content ?? '');
                    }
                    setIsEditorDirty(false); // Changes came from AI, so editor is not "dirty" from user's perspective
                }
            }
            
            applyUpdate(p => ({
                ...p,
                files: currentFiles,
                updatedAt: Date.now(),
            }));
        }
        // No extra success message needed as the explanation covers it.
    
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Terjadi kesalahan yang tidak diketahui.';
        setError(`Gagal mendapatkan respons dari AI: ${errorMessage}`);
        const finalMessage: ChatMessage = { role: 'assistant', content: `Maaf, terjadi kesalahan: ${errorMessage}` };
        applyUpdate(p => ({ ...p, chatHistory: [...p.chatHistory, finalMessage] }));
    } finally {
        setIsLoading(false);
        // Sync the final state back to the ref and save to DB
        projectRef.current = workingProject;
        if (projectRef.current) {
            await saveProject(projectRef.current);
            // If the project was updated, signal the preview to refresh
            if (projectRef.current.updatedAt > originalTimestamp) {
                signalPreviewUpdate(projectRef.current.id);
            }
        }
    }
  }, [project, userInput, isEditorDirty, selectedFilePath, handleSaveFile]);

  const handleNewChat = useCallback(async () => {
    if (!project || isLoading) return;
    if (confirm('Are you sure you want to start a new chat? The current conversation history will be cleared.')) {
        const newSessionId = Math.random().toString(36).substring(2, 9);
        const updatedProject = {
            ...project,
            chatHistory: [],
            currentSessionId: newSessionId,
        };
        setProject(updatedProject);
        await saveProject(updatedProject);
    }
  }, [project, isLoading]);

  const handlePreview = () => {
    if (project && project.files.length > 0) {
      window.open(`/#/preview/${project.id}`, '_blank');
    } else {
      alert('Tidak ada file untuk dipratinjau.');
    }
  };
  
  const handlePublish = useCallback(async () => {
    if (!project || isPublishing) return;
    setIsPublishing(true);
    setError(null);
    try {
        const previewHtml = createPreviewHtml(project.files);
        const payload = {
            files: project.files,
            previewHtml: previewHtml,
            template: project.template,
            styleLibrary: project.styleLibrary,
            name: project.name,
        };
        const response = await fetch('https://jsonblob.com/api/jsonBlob', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`JSONBlob API error (${response.status}): ${errorBody}`);
        }
        const blobUrl = response.headers.get('Location');
        if (!blobUrl) {
            throw new Error('Could not get blob URL from JSONBlob response header.');
        }
        const blobId = blobUrl.split('/').pop();
        if (!blobId) {
             throw new Error('Could not parse blob ID from URL.');
        }
        const shareableUrl = `${window.location.origin}${window.location.pathname}#/view/jsonblob/${blobId}`;
        setPublishedUrl(shareableUrl);
        setIsShareModalOpen(true);
    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
        setError(`Failed to publish: ${errorMessage}`);
    } finally {
        setIsPublishing(false);
    }
  }, [project, isPublishing]);


  const handleDownload = async () => {
    if (project && project.files.length > 0) {
      try {
        const zipBlob = await createProjectZip(project.files);
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${project.name.replace(/\s+/g, '_')}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (e) {
        alert(`Gagal membuat file ZIP: ${e}`);
      }
    } else {
      alert('Tidak ada file untuk diunduh.');
    }
  };
  
  if (error) {
    return (
        <div className="w-screen h-screen flex flex-col justify-center items-center bg-slate-900 p-4">
            <h2 className="text-2xl font-bold text-red-400 mb-4">Gagal Memuat Proyek</h2>
            <p className="text-slate-300 text-center mb-6">{error}</p>
            <button onClick={onBack} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition-transform transform hover:scale-105">
                <BackIcon />
                Kembali ke Daftar Proyek
            </button>
        </div>
    );
  }
  
  if (!project) return (
      <div className="w-screen h-screen flex flex-col justify-center items-center bg-slate-950">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-indigo-500 mb-4"></div>
          <p className="text-slate-300">Loading Project...</p>
      </div>
  );

  return (
    <div className="h-dynamic-screen w-screen flex flex-col bg-slate-900 overflow-hidden">
        {isMobileMenuOpen && (
            <div className="fixed inset-0 bg-slate-900 z-50 p-4 flex flex-col lg:hidden" role="dialog" aria-modal="true">
                <div className="flex justify-between items-center mb-8">
                    <h3 className="text-2xl font-bold text-slate-100">Menu</h3>
                    <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 rounded-full hover:bg-slate-800">
                        <XIcon />
                    </button>
                </div>
                <nav className="flex flex-col gap-2 text-slate-200">
                    {(['files', 'editor', 'chat'] as MobileView[]).map(view => {
                        const isDisabled = view === 'editor' && !selectedFilePath;
                        const getIcon = () => {
                            if (view === 'files') return <CodeIcon />;
                            if (view === 'editor') return <EditIcon />;
                            return <BotIcon />;
                        };
                        return (
                            <button
                                key={view}
                                disabled={isDisabled}
                                onClick={() => {
                                    setActiveView(view);
                                    setIsMobileMenuOpen(false);
                                }}
                                className={`flex items-center gap-3 p-4 rounded-lg text-lg text-left transition-colors w-full disabled:opacity-50 disabled:cursor-not-allowed ${activeView === view ? 'bg-indigo-500/20 text-indigo-300 font-semibold' : 'hover:bg-slate-800'}`}
                            >
                                {getIcon()}
                                <span className="capitalize">{view}</span>
                            </button>
                        )
                    })}
                </nav>
                <div className="border-t border-slate-700 my-6"></div>
                <button
                    onClick={() => {
                        onBack();
                        setIsMobileMenuOpen(false);
                    }}
                    className="flex items-center gap-3 p-4 rounded-lg text-lg text-left transition-colors w-full hover:bg-slate-800 text-slate-200"
                >
                    <BackIcon />
                    <span>Back to Projects</span>
                </button>
            </div>
        )}

      <header className={`bg-slate-800 p-3 flex justify-between items-center border-b border-slate-700 flex-shrink-0 ${isEditorFullscreen ? 'hidden' : ''}`}>
        <div className="flex-1">
            <button onClick={onBack} className="hidden lg:flex items-center gap-2 text-slate-300 hover:text-white transition-colors p-2 rounded-lg hover:bg-slate-700">
                <BackIcon />
                <span className="font-medium">Projects</span>
            </button>
            <button onClick={() => setIsMobileMenuOpen(true)} className="lg:hidden p-2 -ml-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700">
                <MenuIcon className="w-6 h-6"/>
            </button>
        </div>
        <h2 className="text-xl font-bold text-slate-100 truncate mx-2 text-center">{project.name}</h2>
        <div className="flex-1 flex justify-end items-center gap-2">
          <button onClick={handlePublish} disabled={isPublishing} title="Publish Website" className="p-2 bg-slate-700 hover:bg-indigo-600 rounded-lg text-slate-300 hover:text-white transition-colors disabled:bg-slate-600 disabled:cursor-wait">
            {isPublishing ? <SpinnerIcon /> : <CloudUploadIcon />}
          </button>
          <button onClick={handlePreview} title="Preview Website" className="p-2 bg-slate-700 hover:bg-indigo-600 rounded-lg text-slate-300 hover:text-white transition-colors">
            <EyeIcon />
          </button>
          <button onClick={handleDownload} title="Download Project" className="p-2 bg-slate-700 hover:bg-indigo-600 rounded-lg text-slate-300 hover:text-white transition-colors">
            <DownloadIcon />
          </button>
        </div>
      </header>
      <main className="flex-1 flex flex-col lg:grid lg:grid-cols-[minmax(250px,1fr)_3fr_2fr] gap-4 p-4 overflow-y-auto lg:overflow-hidden">
        
        <aside className={`${isEditorFullscreen ? 'hidden' : ''} ${activeView === 'files' ? 'flex' : 'hidden'} flex-1 flex-col bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl lg:flex`}>
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2 text-slate-200 flex-shrink-0 p-4 border-b border-slate-700">
              <CodeIcon />
              Project Files
          </h3>
          <div className="flex-grow overflow-y-auto p-2">
             <FileTree files={project.files} onSelectFile={handleSelectFile} selectedFile={selectedFilePath} />
          </div>
        </aside>

        <section className={`${isEditorFullscreen ? 'fixed inset-0 z-50 p-2 bg-slate-900' : 'lg:col-span-1'} ${activeView === 'editor' ? 'flex' : 'hidden'} flex-1 flex-col gap-4 lg:flex min-h-0`}>
          {selectedFilePath ? (
            <CodeEditor
              filePath={selectedFilePath}
              content={editorContent}
              onChange={handleEditorChange}
              onSave={handleSaveFile}
              isDirty={isEditorDirty}
              isFullScreen={isEditorFullscreen}
              onToggleFullScreen={() => setIsEditorFullscreen(p => !p)}
            />
          ) : (
            <div className="flex-1 flex justify-center items-center bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl">
              <p className="text-slate-400">Select a file to view or edit</p>
            </div>
          )}
        </section>

        <section className={`${isEditorFullscreen ? 'hidden' : ''} ${activeView === 'chat' ? 'flex' : 'hidden'} flex-1 flex-col gap-4 min-h-0 lg:flex lg:col-span-1`}>
            <ChatWindow chatHistory={project.chatHistory} isLoading={isLoading} />
            {error && <div className="text-red-400 bg-red-900/50 p-3 rounded-md text-sm">{error}</div>}
            <div className="flex gap-2 p-2 bg-slate-800/50 border border-slate-700 rounded-xl">
                <textarea
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                    placeholder="Describe your changes..."
                    className="flex-1 bg-slate-700/50 border border-slate-600 text-slate-100 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                    rows={2}
                    disabled={isLoading}
                />
                <div className="flex flex-col gap-2">
                    <button
                        onClick={handleSendMessage}
                        disabled={isLoading || !userInput.trim()}
                        className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-lg disabled:from-slate-600 disabled:to-slate-600 disabled:cursor-not-allowed hover:from-indigo-600 hover:to-purple-700 transition-all flex-1 flex justify-center items-center"
                        aria-label="Send message"
                    >
                        <SendIcon className="w-5 h-5" />
                    </button>
                     <button
                        onClick={handleNewChat}
                        disabled={isLoading}
                        className="p-3 bg-slate-600 text-white rounded-lg disabled:bg-slate-700 disabled:cursor-not-allowed hover:bg-slate-500 transition-all flex-1 flex justify-center items-center"
                        aria-label="Start new chat"
                        title="New Chat"
                    >
                        <RefreshIcon className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </section>
      </main>
      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        title="Project Published!"
        url={publishedUrl}
      />
    </div>
  );
};

export default ProjectEditor;
