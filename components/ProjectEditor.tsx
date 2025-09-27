
import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Project, ProjectFile, ChatMessage, FileOperation } from '../types';
import { getProject, saveProject } from '../services/projectService';
import { generateWebsiteCode } from '../services/aiService';
import { createPreviewContent, createProjectZip } from '../utils/fileUtils';
import { BackIcon, CodeIcon, DownloadIcon, EyeIcon, SendIcon, UserIcon, BotIcon, EditIcon, RefreshIcon, PlannerIcon, ExecutorIcon, ReviewerIcon } from './Icons';
import { TypingIndicator } from './Loader';
import FileTree from './FileTree';
import CodeEditor from './CodeEditor';

interface ProjectEditorProps {
  projectId: string;
  onBack: () => void;
}

type MobileView = 'files' | 'editor' | 'chat';

const applyOperations = (currentFiles: ProjectFile[], operations: FileOperation[]): ProjectFile[] => {
  let updatedFiles = [...currentFiles];

  operations.forEach(op => {
    switch (op.type) {
      case 'CREATE':
        if (updatedFiles.some(f => f.path === op.path)) {
          updatedFiles = updatedFiles.map(f =>
            f.path === op.path ? { ...f, content: op.content || '' } : f
          );
        } else {
          updatedFiles.push({ path: op.path, content: op.content || '' });
        }
        break;
      case 'UPDATE':
        updatedFiles = updatedFiles.map(f =>
          f.path === op.path ? { ...f, content: op.content || '' } : f
        );
        break;
      case 'DELETE':
        updatedFiles = updatedFiles.filter(f => f.path !== op.path);
        break;
      default:
        console.warn(`Unknown operation type: ${(op as any).type}`);
    }
  });

  return updatedFiles;
};

const AgentIcon: React.FC<{ agent?: ChatMessage['agent'], className?: string }> = ({ agent, className }) => {
    const commonClass = className || "w-6 h-6 text-indigo-400 flex-shrink-0";
    switch (agent) {
        case 'Perencana':
            return <PlannerIcon className={commonClass} />;
        case 'Pelaksana':
            return <ExecutorIcon className={commonClass} />;
        case 'Peninjau':
            return <ReviewerIcon className={commonClass} />;
        default:
            return <BotIcon className={commonClass} />;
    }
};

const ChatWindow: React.FC<{ chatHistory: ChatMessage[], isLoading: boolean }> = ({ chatHistory, isLoading }) => {
    const chatEndRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatHistory, isLoading]);

    return (
        <div className="bg-slate-800 rounded-lg flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 space-y-4 overflow-y-auto p-4">
                {chatHistory.map((msg, index) => (
                    <div key={index} className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                        {msg.role === 'assistant' && (
                            <div className="flex flex-col items-center gap-1 w-12 flex-shrink-0">
                                <AgentIcon agent={msg.agent} />
                                {msg.agent && <span className="text-xs text-slate-400 text-center">{msg.agent}</span>}
                            </div>
                        )}
                        <div className={`max-w-full lg:max-w-md p-3 rounded-lg ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-200'}`}>
                            <p className="whitespace-pre-wrap break-words" dangerouslySetInnerHTML={{ __html: msg.content.replace(/\n/g, '<br />').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }}></p>
                        </div>
                        {msg.role === 'user' && <UserIcon className="w-6 h-6 text-slate-400 flex-shrink-0 mt-1" />}
                    </div>
                ))}
                {isLoading && <div className="flex items-start gap-3"><BotIcon className="w-6 h-6 text-indigo-400 flex-shrink-0 mt-1" /><TypingIndicator/></div>}
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

  useEffect(() => {
    getProject(projectId).then(p => {
        if (p && !p.currentSessionId) {
            const updatedProject = {
                ...p,
                currentSessionId: Math.random().toString(36).substring(2, 9)
            };
            setProject(updatedProject);
            saveProject(updatedProject);
        } else {
            setProject(p);
        }
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
  
  const handleSaveFile = useCallback(async () => {
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

  }, [project, selectedFilePath, editorContent, isEditorDirty]);


  const handleSendMessage = useCallback(async () => {
    if (!userInput.trim() || !project) return;
    
    if (isEditorDirty) {
      if (confirm('Anda memiliki perubahan yang belum disimpan di editor. Simpan sebelum mengirim pesan?')) {
        await handleSaveFile();
      }
    }

    const userMessage: ChatMessage = { role: 'user', content: userInput };
    let currentProjectState: Project = {
        ...project,
        chatHistory: [...project.chatHistory, userMessage]
    };
    
    setProject(currentProjectState);
    const initialUserPrompt = userInput;
    setUserInput('');
    setIsLoading(true);
    setError(null);

    let continueLoop = true;
    let loopPrompt = initialUserPrompt;
    const projectIdentifier = `${project.name.replace(/\s+/g, '_')}-${project.currentSessionId}`;

    while (continueLoop) {
        try {
            const aiResponse = await generateWebsiteCode(loopPrompt, currentProjectState.files, projectIdentifier);
            
            const thought = aiResponse.thought;
            const plannerMatch = thought.match(/\*\*Perencana:\*\*\s*([\s\S]*?)(?=\n\*\*Pelaksana:\*\*|$)/);
            const executorMatch = thought.match(/\*\*Pelaksana:\*\*\s*([\s\S]*?)(?=\n\*\*Peninjau:\*\*|$)/);
            const reviewerMatch = thought.match(/\*\*Peninjau:\*\*\s*([\s\S]*)/);
            
            const agentThoughts: ChatMessage[] = [];
            if (plannerMatch?.[1]?.trim()) agentThoughts.push({ role: 'assistant', content: plannerMatch[1].trim(), agent: 'Perencana' });
            if (executorMatch?.[1]?.trim()) agentThoughts.push({ role: 'assistant', content: executorMatch[1].trim(), agent: 'Pelaksana' });
            if (reviewerMatch?.[1]?.trim()) agentThoughts.push({ role: 'assistant', content: reviewerMatch[1].trim(), agent: 'Peninjau' });

            if (agentThoughts.length > 0) {
                 for (const agentThought of agentThoughts) {
                    currentProjectState = {
                        ...currentProjectState,
                        chatHistory: [...currentProjectState.chatHistory, agentThought]
                    };
                    setProject(currentProjectState);
                    await new Promise(resolve => setTimeout(resolve, 800));
                }
            } else {
                const thoughtMessage: ChatMessage = { role: 'assistant', content: aiResponse.thought };
                currentProjectState = {
                    ...currentProjectState,
                    chatHistory: [...currentProjectState.chatHistory, thoughtMessage]
                };
                setProject(currentProjectState);
            }
            
            if (aiResponse.operations.length > 0) {
                const newFiles = applyOperations(currentProjectState.files, aiResponse.operations);
                currentProjectState = { ...currentProjectState, files: newFiles, updatedAt: Date.now() };

                if (selectedFilePath) {
                    const opForSelectedFile = aiResponse.operations.find(op => op.path === selectedFilePath);
                    if (opForSelectedFile) {
                        if (opForSelectedFile.type === 'DELETE') {
                            setSelectedFilePath(null);
                            setEditorContent('');
                        } else if (opForSelectedFile.content !== undefined) {
                            setEditorContent(opForSelectedFile.content);
                        }
                        setIsEditorDirty(false);
                    }
                }
            }
            
            setProject(currentProjectState);
            await saveProject(currentProjectState);

            if (aiResponse.status === 'COMPLETED') {
                continueLoop = false;
                if (aiResponse.summary) {
                    const summaryMessage: ChatMessage = { role: 'assistant', content: aiResponse.summary };
                    currentProjectState = { ...currentProjectState, chatHistory: [...currentProjectState.chatHistory, summaryMessage] };
                    setProject(currentProjectState);
                    await saveProject(currentProjectState);
                }
            } else {
                loopPrompt = "Tugas belum selesai. Lanjutkan ke langkah berikutnya berdasarkan keadaan saat ini.";
                await new Promise(resolve => setTimeout(resolve, 300));
            }

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Terjadi kesalahan yang tidak diketahui.';
            setError(`Gagal mendapatkan respons dari AI: ${errorMessage}`);
            const systemErrorMessage: ChatMessage = { role: 'assistant', content: `Maaf, terjadi kesalahan: ${errorMessage}` };
            setProject(p => p ? {...p, chatHistory: [...p.chatHistory, systemErrorMessage]} : null);
            continueLoop = false;
        }
    }

    setIsLoading(false);

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
      const previewUrl = `/#/preview/${project.id}`;
      window.open(previewUrl, '_blank');
    } else {
      alert('Tidak ada file untuk dipratinjau.');
    }
  };

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
  
  if (!project) return <div className="p-8">Memuat proyek...</div>;

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-900">
      <header className={`bg-slate-800/50 backdrop-blur-sm p-3 flex justify-between items-center border-b border-slate-700 flex-shrink-0 ${isEditorFullscreen ? 'hidden' : ''}`}>
        <button onClick={onBack} className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors p-2 rounded-md">
          <BackIcon />
          <span className="hidden sm:inline">Kembali ke Proyek</span>
        </button>
        <h2 className="text-xl font-bold text-slate-100 truncate">{project.name}</h2>
        <div className="flex items-center gap-2">
          <button onClick={handlePreview} title="Pratinjau Situs Web" className="p-2 bg-slate-700 hover:bg-indigo-600 rounded-lg text-slate-300 hover:text-white transition-colors">
            <EyeIcon />
          </button>
          <button onClick={handleDownload} title="Unduh Proyek" className="p-2 bg-slate-700 hover:bg-indigo-600 rounded-lg text-slate-300 hover:text-white transition-colors">
            <DownloadIcon />
          </button>
        </div>
      </header>
      <main className="flex-1 flex flex-col lg:grid lg:grid-cols-5 gap-4 p-4 overflow-y-auto lg:overflow-hidden">
        
        <aside className={`${isEditorFullscreen ? 'hidden' : ''} ${activeView === 'files' ? 'flex' : 'hidden'} flex-col bg-slate-800 rounded-lg p-4 lg:flex lg:col-span-1`}>
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2 text-slate-300 flex-shrink-0">
              <CodeIcon />
              File Proyek
          </h3>
          <div className="flex-grow overflow-y-auto">
             <FileTree files={project.files} onSelectFile={handleSelectFile} selectedFile={selectedFilePath} />
          </div>
        </aside>

        <section className={`${isEditorFullscreen ? 'fixed inset-0 z-50 p-2 bg-slate-900' : 'lg:col-span-3'} ${activeView === 'editor' ? 'flex' : 'hidden'} flex-col gap-4 lg:flex`}>
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
            <div className="flex-1 flex justify-center items-center bg-slate-800 rounded-lg">
              <p className="text-slate-400">Pilih file untuk dilihat atau diedit</p>
            </div>
          )}
        </section>

        <section className={`${isEditorFullscreen ? 'hidden' : ''} ${activeView === 'chat' ? 'flex' : 'hidden'} flex-col gap-4 min-h-0 lg:flex lg:col-span-1`}>
            <ChatWindow chatHistory={project.chatHistory} isLoading={isLoading} />
            {error && <div className="text-red-400 bg-red-900/50 p-3 rounded-md text-sm">{error}</div>}
            <div className="flex items-center gap-2 p-2 bg-slate-800 rounded-lg">
                <textarea
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                    placeholder="Jelaskan perubahan Anda..."
                    className="flex-1 bg-slate-700 border border-slate-600 text-slate-100 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                    rows={2}
                    disabled={isLoading}
                />
                <div className="flex flex-col gap-2">
                    <button
                        onClick={handleSendMessage}
                        disabled={isLoading || !userInput.trim()}
                        className="p-3 bg-indigo-600 text-white rounded-lg disabled:bg-slate-600 disabled:cursor-not-allowed hover:bg-indigo-500 transition-all"
                        aria-label="Kirim pesan"
                    >
                        <SendIcon className="w-5 h-5" />
                    </button>
                     <button
                        onClick={handleNewChat}
                        disabled={isLoading}
                        className="p-3 bg-slate-600 text-white rounded-lg disabled:bg-slate-700 disabled:cursor-not-allowed hover:bg-slate-500 transition-all"
                        aria-label="Mulai obrolan baru"
                        title="New Chat"
                    >
                        <RefreshIcon className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </section>
      </main>

      <nav className={`lg:hidden flex justify-around items-center p-2 bg-slate-800/80 backdrop-blur-sm border-t border-slate-700 flex-shrink-0 ${isEditorFullscreen ? 'hidden' : ''}`}>
        <button onClick={() => setActiveView('files')} className={`flex flex-col items-center gap-1 p-2 rounded-md transition-colors w-20 ${activeView === 'files' ? 'text-indigo-400' : 'text-slate-400 hover:text-white'}`}>
            <CodeIcon className="w-6 h-6"/>
            <span className="text-xs font-medium">Files</span>
        </button>
        <button onClick={() => setActiveView('editor')} className={`flex flex-col items-center gap-1 p-2 rounded-md transition-colors w-20 ${activeView === 'editor' ? 'text-indigo-400' : 'text-slate-400 hover:text-white'} disabled:text-slate-600 disabled:cursor-not-allowed`} disabled={!selectedFilePath}>
            <EditIcon className="w-6 h-6"/>
            <span className="text-xs font-medium">Editor</span>
        </button>
        <button onClick={() => setActiveView('chat')} className={`flex flex-col items-center gap-1 p-2 rounded-md transition-colors w-20 ${activeView === 'chat' ? 'text-indigo-400' : 'text-slate-400 hover:text-white'}`}>
            <BotIcon className="w-6 h-6"/>
            <span className="text-xs font-medium">Chat</span>
        </button>
      </nav>

    </div>
  );
};

export default ProjectEditor;
