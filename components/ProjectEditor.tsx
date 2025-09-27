
import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Project, ProjectFile, ChatMessage, FileOperation } from '../types';
import { getProject, saveProject } from '../services/projectService';
import { generateFileOperations } from '../services/aiService';
import { createProjectZip } from '../utils/fileUtils';
import { BackIcon, CodeIcon, DownloadIcon, EyeIcon, SendIcon, UserIcon, BotIcon, EditIcon, RefreshIcon } from './Icons';
import { TypingIndicator } from './Loader';
import FileTree from './FileTree';
import CodeEditor from './CodeEditor';

interface ProjectEditorProps {
  projectId: string;
  onBack: () => void;
}

type MobileView = 'files' | 'editor' | 'chat';

// FIX: Updated function to use 'operation' property instead of 'type' for consistency.
const applyOperation = (currentFiles: ProjectFile[], operation: FileOperation): ProjectFile[] => {
  let updatedFiles = [...currentFiles];
  const { operation: opType, path, content = '' } = operation;

  switch (opType) {
    case 'CREATE':
      if (updatedFiles.some(f => f.path === path)) {
        updatedFiles = updatedFiles.map(f =>
          f.path === path ? { ...f, content } : f
        );
      } else {
        updatedFiles.push({ path, content });
      }
      break;
    case 'UPDATE':
      updatedFiles = updatedFiles.map(f =>
        f.path === path ? { ...f, content } : f
      );
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
        <div className="bg-slate-800 rounded-lg flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 space-y-4 overflow-y-auto p-4">
                {chatHistory.map((msg, index) => (
                    <div key={index} className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                        {msg.role === 'assistant' && (
                           <BotIcon className="w-6 h-6 text-indigo-400 flex-shrink-0 mt-1" />
                        )}
                        <div className={`max-w-full lg:max-w-md p-3 rounded-lg ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-200'}`}>
                            <p className="whitespace-pre-wrap break-words" dangerouslySetInnerHTML={{ __html: msg.content.replace(/\n/g, '<br />').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code class="bg-slate-800 rounded-sm px-1 font-mono text-sm">$1</code>') }}></p>
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
        if (p) {
            if (!p.currentSessionId) {
                const updatedProject = {
                    ...p,
                    currentSessionId: Math.random().toString(36).substring(2, 9)
                };
                setProject(updatedProject);
                saveProject(updatedProject).catch(err => {
                    console.error("Failed to save project with new session ID:", err);
                });
            } else {
                setProject(p);
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
    const initialUserPrompt = userInput;
    setUserInput('');
    setIsLoading(true);
    setError(null);
    
    // Use a function to get the latest project state for the AI call
    let currentProjectState = project;

    // Add user message to chat and save
    setProject(p => {
        const newProject = { ...p!, chatHistory: [...p!.chatHistory, userMessage] };
        currentProjectState = newProject;
        saveProject(newProject);
        return newProject;
    });
    
    const projectIdentifier = `${project.name.replace(/\s+/g, '_')}-${project.currentSessionId}`;

    // Helper to add messages and update state
    const addMessage = async (content: string) => {
        const newMessage: ChatMessage = { role: 'assistant', content };
        setProject(p => {
            const newProject = { ...p!, chatHistory: [...p!.chatHistory, newMessage] };
            currentProjectState = newProject;
            saveProject(newProject);
            return newProject;
        });
        await new Promise(r => setTimeout(r, 100)); // Short delay for UI update
    };

    // Helper to apply operation and update state
    const executeOperation = async (operation: FileOperation) => {
        setProject(p => {
            const newFiles = applyOperation(p!.files, operation);
            const newProject = { ...p!, files: newFiles, updatedAt: Date.now() };
            currentProjectState = newProject;

            if (selectedFilePath) {
                const opForSelectedFile = operation.path === selectedFilePath;
                if (opForSelectedFile) {
                    if (operation.operation === 'DELETE') {
                        setSelectedFilePath(null);
                        setEditorContent('');
                    } else if (operation.content !== undefined) {
                        setEditorContent(operation.content);
                    }
                    setIsEditorDirty(false);
                }
            }

            saveProject(newProject);
            return newProject;
        });
    }

    try {
      await addMessage("Tentu, saya sedang menganalisis permintaan Anda dan menyiapkan perubahannya...");
      
      const operations = await generateFileOperations(
          initialUserPrompt,
          currentProjectState.chatHistory,
          currentProjectState.files,
          projectIdentifier
      );

      if (operations.length === 0) {
        await addMessage("Sepertinya tidak ada perubahan file yang diperlukan untuk permintaan Anda. Ada lagi yang bisa saya bantu?");
        setIsLoading(false);
        return;
      }

      const planSummary = operations.map(op => `• **${op.operation}**: \`${op.path}\` - *${op.reasoning}*`).join('\n');
      await addMessage(`Baik, saya telah merencanakan perubahan berikut:\n${planSummary}`);
      await addMessage("Sekarang saya akan menerapkan perubahan ini...");

      for (const op of operations) {
          await executeOperation(op);
          await addMessage(`Selesai: **${op.operation}** \`${op.path}\``);
          await new Promise(r => setTimeout(r, 100));
      }
      
      await addMessage("Semua perubahan telah selesai! Anda dapat meninjau file atau melihat pratinjau situs web.");

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Terjadi kesalahan yang tidak diketahui.';
      setError(`Gagal mendapatkan respons dari AI: ${errorMessage}`);
      await addMessage(`Maaf, terjadi kesalahan: ${errorMessage}`);
    } finally {
      setIsLoading(false);
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
      <div className="w-screen h-screen flex flex-col justify-center items-center bg-slate-900">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-slate-300 mb-4"></div>
          <p className="text-slate-300">Memuat proyek...</p>
      </div>
  );

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