import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { Project, ProjectFile, ChatMessage, FileOperation } from '../types';
import { getProject, saveProject } from '../services/projectService';
import { runAIAgentWorkflow, AIConversationalError } from '../services/aiService';
import { createProjectZip, createPreviewHtml } from '../utils/fileUtils';
import { BackIcon, CodeIcon, DownloadIcon, EyeIcon, SendIcon, UserIcon, BotIcon, EditIcon, RefreshIcon, CloudUploadIcon, SpinnerIcon, FilePlusIcon, FileEditIcon, FileMinusIcon, CheckCircleIcon, AlertTriangleIcon, InfoIcon, GripVerticalIcon, MenuIcon } from './Icons';
import { TypingIndicator } from './Loader';
import FileTree from './FileTree';
import CodeEditor from './CodeEditor';
import ShareModal from './ShareModal';

interface ProjectEditorProps {
  projectId: string;
  onBack: () => void;
}

type MainView = 'editor' | 'chat';
type MobileView = 'files' | 'editor' | 'chat';
type ToastType = { id: number; message: string; type: 'success' | 'error' | 'info' };

type AiModel = 'gpt-5-nano' | 'gpt-5-mini' | 'gpt-5' | 'gpt-4o' | 'gpt-4o-mini' | 'o1-mini';
const aiModels: { id: AiModel | string, name: string }[] = [
    { id: 'gpt-5-nano', name: 'GPT-5 Nano' },
    { id: 'gpt-5-mini', name: 'GPT-5 Mini' },
    { id: 'gpt-5', name: 'GPT-5' },
    { id: 'gpt-4o', name: 'GPT-4o' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
    { id: 'o1-mini', name: 'o1 Mini' },
];

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
      if (fileExists) updatedFiles = updatedFiles.map(f => f.path === path ? { ...f, content } : f);
      else updatedFiles.push({ path, content });
      break;
    case 'UPDATE':
       if (!fileExists) updatedFiles.push({ path, content });
       else updatedFiles = updatedFiles.map(f => f.path === path ? { ...f, content } : f);
      break;
    case 'DELETE':
      updatedFiles = updatedFiles.filter(f => f.path !== path);
      break;
    default:
      console.warn(`Unknown operation type: ${opType}`);
  }
  return updatedFiles;
};

const CollapsibleSection: React.FC<{ title: string; children: React.ReactNode, icon: React.ReactNode }> = ({ title, icon, children }) => (
    <details className="mt-3 border-t border-slate-600/50 pt-3 group">
        <summary className="list-none flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors">
            {icon} {title}
            <span className="ml-auto text-slate-500 group-open:rotate-90 transition-transform">&#9656;</span>
        </summary>
        <div className="mt-2 p-3 rounded-md bg-slate-900/50 border border-slate-600/50">
            {children}
        </div>
    </details>
);

const ThinkingLog: React.FC<{ thoughts: string[], isThinking: boolean }> = ({ thoughts, isThinking }) => {
    if (!thoughts || thoughts.length === 0) return null;
    const icon = isThinking ? <SpinnerIcon className="w-4 h-4" /> : <InfoIcon className="w-4 h-4" />;
    
    return (
        <CollapsibleSection title="Thought Process" icon={icon}>
            <ul className="space-y-1.5 text-sm text-slate-400 pl-4">
                {thoughts.map((thought, index) => (
                    <li key={index} className="break-words relative pl-4 before:content-['▸'] before:absolute before:left-0 before:top-0 before:text-indigo-400">
                        {thought}
                    </li>
                ))}
            </ul>
        </CollapsibleSection>
    );
};

const FileOperationsSummary: React.FC<{ operations: FileOperation[] }> = ({ operations }) => {
    if (!operations || operations.length === 0) return null;
    const getIcon = (op: FileOperation['operation']) => {
        switch (op) {
            case 'CREATE': return <FilePlusIcon className="w-5 h-5 text-green-400" />;
            case 'UPDATE': return <FileEditIcon className="w-5 h-5 text-blue-400" />;
            case 'DELETE': return <FileMinusIcon className="w-5 h-5 text-red-400" />;
            default: return null;
        }
    };
    return (
        <CollapsibleSection title="File Actions" icon={<CodeIcon className="w-4 h-4" />}>
            <ul className="space-y-1.5">
                {operations.map((op, index) => (
                    <li key={index} className="flex items-center gap-3 text-sm">
                        {getIcon(op.operation)}
                        <span className="font-mono text-slate-400 break-all">{op.path}</span>
                    </li>
                ))}
            </ul>
        </CollapsibleSection>
    );
};

const ChatWindow: React.FC<{ chatHistory: ChatMessage[], isLoading: boolean }> = ({ chatHistory, isLoading }) => {
    const chatEndRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatHistory]);

    const filteredHistory = chatHistory.filter(msg => msg.role !== 'system' && msg.role !== 'tool');

    return (
        <div className="flex-1 space-y-6 overflow-y-auto p-4 sm:p-6">
            {filteredHistory.map((msg, index) => {
                const isLastMessage = index === filteredHistory.length - 1;
                const isThinking = isLastMessage && isLoading && msg.role === 'assistant';

                return (
                    <div key={index} className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                        {msg.role === 'assistant' && (
                           <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center flex-shrink-0 mt-1 ring-1 ring-indigo-500/30">
                             <BotIcon className="w-5 h-5 text-indigo-100" />
                           </div>
                        )}
                        <div className={`max-w-[85%] md:max-w-[80%] p-3 ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-t-xl rounded-bl-xl' : 'bg-slate-700 text-slate-200 rounded-t-xl rounded-br-xl'}`}>
                            {msg.content ? (
                              <p className="whitespace-pre-wrap break-words" dangerouslySetInnerHTML={{ __html: msg.content.replace(/\n/g, '<br />').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code class="bg-slate-800 rounded-sm px-1 py-0.5 font-mono text-sm">$1</code>') }}></p>
                            ) : <TypingIndicator />}
                            <ThinkingLog thoughts={msg.thoughts || []} isThinking={isThinking} />
                            <FileOperationsSummary operations={msg.operations || []} />
                        </div>
                        {msg.role === 'user' && (
                          <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center flex-shrink-0 mt-1">
                            <UserIcon className="w-5 h-5 text-slate-300" />
                          </div>
                        )}
                    </div>
                )
            })}
            <div ref={chatEndRef} />
        </div>
    );
}

interface ChatInputProps {
  isMobile?: boolean;
  selectedModel: AiModel | string;
  setSelectedModel: (model: AiModel | string) => void;
  isLoading: boolean;
  userInput: string;
  setUserInput: (input: string) => void;
  handleSendMessage: () => void;
  handleNewChat: () => void;
}

const ChatInput: React.FC<ChatInputProps> = ({
  isMobile,
  selectedModel,
  setSelectedModel,
  isLoading,
  userInput,
  setUserInput,
  handleSendMessage,
  handleNewChat,
}) => (
   <div className={`flex flex-col gap-2 p-2 bg-slate-800/50 border border-slate-700 rounded-xl ${isMobile ? 'bg-slate-800/95 backdrop-blur-sm !rounded-none !border-none !border-t !border-slate-700' : ''}`}>
      <div className="flex items-center gap-2 px-1">
          <label htmlFor={`ai-model-selector-${isMobile ? 'mobile' : 'desktop'}`} className="text-xs font-medium text-slate-400">Model:</label>
          <select id={`ai-model-selector-${isMobile ? 'mobile' : 'desktop'}`} value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)} disabled={isLoading} className="flex-1 bg-slate-700 border border-slate-600 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60">
              {aiModels.map(model => <option key={model.id} value={model.id}>{model.name}</option>)}
          </select>
      </div>
      <div className="flex gap-2">
          <textarea value={userInput} onChange={(e) => setUserInput(e.target.value)} placeholder="Describe your changes..." className="flex-1 bg-slate-700/50 border border-slate-600 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" rows={isMobile ? 1 : 2} disabled={isLoading} />
          <div className={`flex gap-2 ${isMobile ? 'flex-col-reverse' : 'flex-col'}`}>
              <button onClick={handleSendMessage} disabled={isLoading || !userInput.trim()} className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-lg disabled:from-slate-600 disabled:to-slate-600 disabled:cursor-not-allowed hover:from-indigo-600 hover:to-purple-700 transition-all flex-1 flex justify-center items-center" aria-label="Send message"><SendIcon className="w-5 h-5" /></button>
              {!isMobile && <button onClick={handleNewChat} disabled={isLoading} className="p-3 bg-slate-600 text-white rounded-lg disabled:bg-slate-700 disabled:cursor-not-allowed hover:bg-slate-500 transition-all flex-1 flex justify-center items-center" aria-label="Start new chat" title="New Chat"><RefreshIcon className="w-5 h-5" /></button>}
          </div>
      </div>
    </div>
);


interface BottomNavProps {
  mobileView: MobileView;
  setMobileView: (view: MobileView) => void;
  selectedFilePath: string | null;
}

const BottomNav: React.FC<BottomNavProps> = ({ mobileView, setMobileView, selectedFilePath }) => (
  <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-slate-800/80 backdrop-blur-sm border-t border-slate-700 flex justify-around p-1 z-40">
      {(['files', 'editor', 'chat'] as MobileView[]).map(view => {
          const isDisabled = view === 'editor' && !selectedFilePath;
          const Icon = { files: CodeIcon, editor: EditIcon, chat: BotIcon }[view];
          return (
              <button key={view} disabled={isDisabled} onClick={() => setMobileView(view)} className={`flex flex-col items-center gap-1 p-2 rounded-md w-20 transition-colors ${mobileView === view ? 'text-indigo-400' : 'text-slate-400 hover:text-white'} disabled:opacity-50`}>
                  <Icon className="w-6 h-6" />
                  <span className="text-xs capitalize">{view}</span>
              </button>
          )
      })}
  </div>
);


const ProjectEditor: React.FC<ProjectEditorProps> = ({ projectId, onBack }) => {
  const [project, setProject] = useState<Project | null>(null);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastType[]>([]);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [editorContent, setEditorContent] = useState<string>('');
  const [isEditorDirty, setIsEditorDirty] = useState(false);
  
  const [mainView, setMainView] = useState<MainView>('chat');
  const [mobileView, setMobileView] = useState<MobileView>('chat');
  const [sidebarWidth, setSidebarWidth] = useState(280);
  
  const [isEditorFullscreen, setIsEditorFullscreen] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState('');
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<AiModel | string>('gpt-5-nano');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const projectRef = useRef<Project | null>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => { projectRef.current = project; }, [project]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node)) {
        setIsMobileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const showToast = useCallback((message: string, type: ToastType['type'] = 'info') => {
    const newToast: ToastType = { id: Date.now(), message, type };
    setToasts(prev => [...prev, newToast]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== newToast.id)), 4000);
  }, []);

  useEffect(() => {
    const setAppHeight = () => document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
    window.addEventListener('resize', setAppHeight);
    setAppHeight();
    return () => window.removeEventListener('resize', setAppHeight);
  }, []);

  useEffect(() => {
    getProject(projectId).then(p => {
        if (p) {
            const projectWithDefaults: Project = { ...p, template: p.template || 'blank', styleLibrary: p.styleLibrary || 'none', currentSessionId: p.currentSessionId || Math.random().toString(36).substring(2, 9) };
            setProject(projectWithDefaults);
            if (!p.template || !p.styleLibrary || !p.currentSessionId) saveProject(projectWithDefaults);
        } else setError(`Project tidak ditemukan.`);
    }).catch(err => setError(`Gagal memuat proyek: ${err instanceof Error ? err.message : 'Terjadi kesalahan.'}`));
  }, [projectId]);

  const handleSelectFile = useCallback((path: string) => {
    if (isEditorDirty && !confirm('Anda memiliki perubahan yang belum disimpan. Beralih dan buang perubahan?')) return;
    
    const file = project?.files.find(f => f.path === path);
    if (file) {
      setSelectedFilePath(path);
      setEditorContent(file.content);
      setIsEditorDirty(false);
      setMainView('editor');
      if (window.innerWidth < 1024) setMobileView('editor');
    }
  }, [project, isEditorDirty]);

  const handleEditorChange = (newContent: string) => { setEditorContent(newContent); setIsEditorDirty(true); };
  
  const handleSaveFile = useCallback(async (options: { signal?: boolean } = {}) => {
    const { signal = true } = options;
    if (!project || !selectedFilePath || !isEditorDirty) return;
    const updatedFiles = project.files.map(f => f.path === selectedFilePath ? { ...f, content: editorContent } : f);
    const updatedProject = { ...project, files: updatedFiles, updatedAt: Date.now() };
    setProject(updatedProject);
    await saveProject(updatedProject);
    setIsEditorDirty(false);
    showToast(`${selectedFilePath} saved successfully!`, 'success');
    if (signal) signalPreviewUpdate(project.id);
  }, [project, selectedFilePath, editorContent, isEditorDirty, showToast]);

  const handleSendMessage = useCallback(async () => {
    if (!userInput.trim() || !project) return;
    if (isEditorDirty && confirm('Anda punya perubahan belum disimpan. Simpan sebelum mengirim pesan?')) await handleSaveFile({ signal: false });

    const userGoal = userInput;
    setIsLoading(true);
    setError(null);
    setUserInput('');
    const userMessage: ChatMessage = { role: 'user', content: userGoal };
    const assistantPlaceholder: ChatMessage = { role: 'assistant', content: null, thoughts: [], operations: [] };
    const projectForUserMsg = { ...projectRef.current!, chatHistory: [...projectRef.current!.chatHistory, userMessage, assistantPlaceholder] };
    setProject(projectForUserMsg);
    projectRef.current = projectForUserMsg;

    const onThought = (thought: string) => setProject(p => {
        if (!p) return null;
        const history = [...p.chatHistory];
        const lastMsg = history[history.length - 1];
        if (lastMsg?.role === 'assistant') lastMsg.thoughts = [...(lastMsg.thoughts || []), thought];
        const newProj = { ...p, chatHistory: history };
        projectRef.current = newProj;
        return newProj;
      });

    try {
      const projectForAI = projectRef.current!;
      const result = await runAIAgentWorkflow(userGoal, projectForAI.files, projectForAI.template, projectForAI.styleLibrary, selectedModel, onThought);

      let updatedFiles = projectForAI.files;
      for (const op of result.operations) updatedFiles = applyOperation(updatedFiles, op);

      const fileChanged = result.operations.find(op => op.path === selectedFilePath);
      if (fileChanged) {
        if (fileChanged.operation === 'DELETE') { setSelectedFilePath(null); setEditorContent(''); } 
        else { setEditorContent(fileChanged.content ?? ''); }
        setIsEditorDirty(false);
      }
      
      const finalHistory = [...projectForAI.chatHistory.slice(0, -1), { role: 'assistant' as const, content: result.explanation, operations: result.operations, thoughts: projectRef.current!.chatHistory[projectRef.current!.chatHistory.length - 1].thoughts || [] }];
      const updatedProject = { ...projectForAI, files: updatedFiles, chatHistory: finalHistory, updatedAt: Date.now() };
      setProject(updatedProject);
      projectRef.current = updatedProject;
      await saveProject(updatedProject);
      signalPreviewUpdate(updatedProject.id);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown AI error occurred.';
      showToast(`AI task failed: ${errorMessage}`, 'error');
      setProject(p => {
        if (!p) return null;
        const history = [...p.chatHistory];
        const lastMsg = history[history.length - 1];
        if (lastMsg?.role === 'assistant') lastMsg.content = `Sorry, an error occurred: ${errorMessage}`;
        const newProj = { ...p, chatHistory: history };
        projectRef.current = newProj;
        return newProj;
      });
    } finally {
      setIsLoading(false);
    }
  }, [project, userInput, isEditorDirty, selectedFilePath, selectedModel, handleSaveFile, showToast]);

  const handleNewChat = useCallback(async () => {
    if (!project || isLoading || !confirm('Mulai obrolan baru? Riwayat saat ini akan dihapus.')) return;
    const updatedProject = { ...project, chatHistory: [], currentSessionId: Math.random().toString(36).substring(2, 9) };
    setProject(updatedProject);
    await saveProject(updatedProject);
  }, [project, isLoading]);

  const handlePreview = () => window.open(`/#/preview/${project.id}`, '_blank');
  
  const handlePublish = useCallback(async () => {
    if (!project || isPublishing) return;
    setIsPublishing(true);
    try {
        const previewHtml = createPreviewHtml(project.files);
        const payload = { files: project.files, previewHtml: previewHtml, template: project.template, styleLibrary: project.styleLibrary, name: project.name };
        const res = await fetch('https://jsonblob.com/api/jsonBlob', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify(payload) });
        if (!res.ok) throw new Error(`JSONBlob API error (${res.status})`);
        const blobUrl = res.headers.get('Location');
        if (!blobUrl) throw new Error('Could not get blob URL from response.');
        const blobId = blobUrl.split('/').pop();
        if (!blobId) throw new Error('Could not parse blob ID.');
        setPublishedUrl(`${window.location.origin}${window.location.pathname}#/view/jsonblob/${blobId}`);
        setIsShareModalOpen(true);
    } catch (e) { showToast(`Failed to publish: ${e instanceof Error ? e.message : 'Unknown error.'}`, 'error');
    } finally { setIsPublishing(false); }
  }, [project, isPublishing, showToast]);

  const handleDownload = async () => {
    if (!project || project.files.length === 0) { showToast('No files to download.', 'error'); return; }
    try {
      const zipBlob = await createProjectZip(project.files);
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.name.replace(/\s+/g, '_')}.zip`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) { showToast(`Failed to create ZIP file: ${e}`, 'error'); }
  };
  
  const sidebarRef = useRef<HTMLDivElement>(null);
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sidebarRef.current?.offsetWidth || sidebarWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
        const newWidth = startWidth + moveEvent.clientX - startX;
        if (newWidth > 200 && newWidth < 600) setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [sidebarWidth]);

  if (error) return ( <div className="w-screen h-screen flex flex-col justify-center items-center bg-slate-900 p-4"> <h2 className="text-2xl font-bold text-red-400 mb-4">Gagal Memuat Proyek</h2> <p className="text-slate-300 text-center mb-6">{error}</p> <button onClick={onBack} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2 px-4 rounded-lg"> <BackIcon /> Kembali </button> </div> );
  if (!project) return ( <div className="w-screen h-screen flex flex-col justify-center items-center bg-slate-950"> <SpinnerIcon className="h-16 w-16 text-indigo-500" /> <p className="mt-4 text-slate-300">Loading Project...</p> </div> );

  return (
    <div className="h-dynamic-screen w-screen flex flex-col bg-slate-900 overflow-hidden">
        <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-3">
            {toasts.map(toast => <div key={toast.id} className="toast-enter bg-slate-700 border border-slate-600 text-white py-3 px-5 rounded-lg shadow-2xl flex items-center gap-3"> {toast.type === 'success' && <CheckCircleIcon className="w-5 h-5 text-green-400"/>} {toast.type === 'error' && <AlertTriangleIcon className="w-5 h-5 text-red-400"/>} <p>{toast.message}</p> </div>)}
        </div>

      <header className={`bg-slate-800 p-3 flex justify-between items-center border-b border-slate-700 flex-shrink-0 z-20 ${isEditorFullscreen ? 'hidden' : ''}`}>
        <button onClick={onBack} className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors p-2 rounded-lg hover:bg-slate-700"> <BackIcon /> <span className="font-medium hidden sm:inline">Projects</span> </button>
        <h2 className="text-xl font-bold text-slate-100 truncate mx-2 text-center">{project.name}</h2>
        <div className="flex items-center gap-2">
            <button onClick={handlePublish} disabled={isPublishing} title="Publish Website" className="hidden lg:flex p-2 bg-slate-700 hover:bg-indigo-600 rounded-lg text-slate-300 hover:text-white transition-colors disabled:bg-slate-600 disabled:cursor-wait">{isPublishing ? <SpinnerIcon /> : <CloudUploadIcon />}</button>
            <button onClick={handlePreview} title="Preview Website" className="hidden lg:flex p-2 bg-slate-700 hover:bg-indigo-600 rounded-lg text-slate-300 hover:text-white transition-colors"><EyeIcon /></button>
            <button onClick={handleDownload} title="Download Project" className="hidden lg:flex p-2 bg-slate-700 hover:bg-indigo-600 rounded-lg text-slate-300 hover:text-white transition-colors"><DownloadIcon /></button>
            
            <div className="lg:hidden relative" ref={mobileMenuRef}>
                <button onClick={() => setIsMobileMenuOpen(p => !p)} className="p-2 rounded-lg hover:bg-slate-700 text-slate-300 hover:text-white">
                    <MenuIcon />
                </button>
                {isMobileMenuOpen && (
                    <div className="absolute top-full right-0 mt-2 w-56 bg-slate-800 border border-slate-700 rounded-md shadow-lg z-50 py-1 transition-opacity duration-200">
                        <button onClick={() => { handlePublish(); setIsMobileMenuOpen(false); }} disabled={isPublishing} className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 disabled:opacity-50">
                            {isPublishing ? <SpinnerIcon /> : <CloudUploadIcon />} Publish Website
                        </button>
                        <button onClick={() => { handlePreview(); setIsMobileMenuOpen(false); }} className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700">
                            <EyeIcon /> Preview Website
                        </button>
                        <button onClick={() => { handleDownload(); setIsMobileMenuOpen(false); }} className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700">
                            <DownloadIcon /> Download Project
                        </button>
                        <div className="my-1 h-px bg-slate-700" />
                        <button onClick={() => { handleNewChat(); setIsMobileMenuOpen(false); }} disabled={isLoading} className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 disabled:opacity-50">
                            <RefreshIcon /> Start New Chat
                        </button>
                    </div>
                )}
            </div>
        </div>
      </header>
      
      {/* Desktop Layout */}
      <main className={`flex-1 hidden lg:flex overflow-hidden p-4 gap-4 ${isEditorFullscreen ? 'fixed inset-0 z-50 bg-slate-900 p-2' : ''}`}>
        <aside ref={sidebarRef} style={{width: `${sidebarWidth}px`}} className={`${isEditorFullscreen ? 'hidden' : ''} flex flex-col bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl min-w-[200px]`}>
          <h3 className="text-lg font-semibold p-4 border-b border-slate-700 flex items-center gap-2 text-slate-200 flex-shrink-0"><CodeIcon /> Project Files</h3>
          <div className="flex-grow overflow-y-auto p-2"><FileTree files={project.files} onSelectFile={handleSelectFile} selectedFile={selectedFilePath} /></div>
        </aside>
        <div onMouseDown={handleMouseDown} className={`${isEditorFullscreen ? 'hidden' : ''} flex-shrink-0 w-2 cursor-col-resize flex items-center justify-center group`}><div className="w-1 h-10 bg-slate-700 group-hover:bg-indigo-500 rounded-full transition-colors" /></div>
        <div className="flex-1 flex flex-col min-w-0 gap-4">
            <div className="flex-1 flex flex-col min-h-0 bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl overflow-hidden">
                <div className="flex-shrink-0 border-b border-slate-700 flex items-center px-2">
                    <button onClick={() => setMainView('editor')} disabled={!selectedFilePath} className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${mainView === 'editor' ? 'border-indigo-500 text-white' : 'border-transparent text-slate-400 hover:text-white'} disabled:text-slate-600 disabled:cursor-not-allowed`}>Editor</button>
                    <button onClick={() => setMainView('chat')} className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${mainView === 'chat' ? 'border-indigo-500 text-white' : 'border-transparent text-slate-400 hover:text-white'}`}>Chat</button>
                </div>
                <div className="flex-1 min-h-0">
                    {mainView === 'editor' ? (
                        selectedFilePath ? <CodeEditor filePath={selectedFilePath} content={editorContent} onChange={handleEditorChange} onSave={handleSaveFile} isDirty={isEditorDirty} isFullScreen={isEditorFullscreen} onToggleFullScreen={() => setIsEditorFullscreen(p => !p)} /> 
                        : <div className="flex h-full justify-center items-center"><p className="text-slate-400">Pilih file untuk dilihat atau diedit</p></div>
                    ) : ( <ChatWindow chatHistory={project.chatHistory} isLoading={isLoading} /> )}
                </div>
            </div>
            <div className="flex-shrink-0">
               <ChatInput
                 isLoading={isLoading}
                 userInput={userInput}
                 setUserInput={setUserInput}
                 handleSendMessage={handleSendMessage}
                 handleNewChat={handleNewChat}
                 selectedModel={selectedModel}
                 setSelectedModel={setSelectedModel}
               />
            </div>
        </div>
      </main>

      {/* Mobile Layout */}
      <main className={`lg:hidden flex-1 flex flex-col overflow-hidden pb-16 ${isEditorFullscreen ? 'fixed inset-0 z-50 bg-slate-900 p-0 pb-0' : ''}`}>
        {mobileView === 'files' && (
            <aside className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl flex flex-col h-full m-4">
                <h3 className="text-lg font-semibold p-4 border-b border-slate-700 flex items-center gap-2"><CodeIcon /> Project Files</h3>
                <div className="flex-grow overflow-y-auto p-2"><FileTree files={project.files} onSelectFile={handleSelectFile} selectedFile={selectedFilePath} /></div>
            </aside>
        )}
        {mobileView === 'editor' && (
            <div className="flex-1 flex flex-col min-h-0 p-4">
                {selectedFilePath 
                    ? <CodeEditor filePath={selectedFilePath} content={editorContent} onChange={handleEditorChange} onSave={handleSaveFile} isDirty={isEditorDirty} isFullScreen={isEditorFullscreen} onToggleFullScreen={() => setIsEditorFullscreen(p => !p)} /> 
                    : <div className="flex h-full justify-center items-center bg-slate-800/50 border border-slate-700 rounded-xl"><p className="text-slate-400">Pilih file untuk diedit</p></div>
                }
            </div>
        )}
        {mobileView === 'chat' && (
            <div className="flex flex-col h-full min-h-0">
                <ChatWindow chatHistory={project.chatHistory} isLoading={isLoading} />
                <ChatInput
                  isMobile={true}
                  isLoading={isLoading}
                  userInput={userInput}
                  setUserInput={setUserInput}
                  handleSendMessage={handleSendMessage}
                  handleNewChat={handleNewChat}
                  selectedModel={selectedModel}
                  setSelectedModel={setSelectedModel}
                />
            </div>
        )}
      </main>
      {!isEditorFullscreen && <BottomNav mobileView={mobileView} setMobileView={setMobileView} selectedFilePath={selectedFilePath} />}

      <ShareModal isOpen={isShareModalOpen} onClose={() => setIsShareModalOpen(false)} title="Project Published!" url={publishedUrl} />
    </div>
  );
};

export default ProjectEditor;
