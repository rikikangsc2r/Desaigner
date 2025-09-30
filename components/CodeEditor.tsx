import React, { useEffect, useRef } from 'react';
import { SaveIcon, MaximizeIcon, MinimizeIcon } from './Icons';

interface CodeEditorProps {
    filePath: string;
    content: string;
    onChange: (newContent: string) => void;
    onSave: () => void;
    isDirty: boolean;
    isFullScreen: boolean;
    onToggleFullScreen: () => void;
}

const CodeEditor: React.FC<CodeEditorProps> = ({ filePath, content, onChange, onSave, isDirty, isFullScreen, onToggleFullScreen }) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const lineNumbersRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        updateLineNumbers();
    }, [content]);
    
    const updateLineNumbers = () => {
        if (lineNumbersRef.current) {
            const lineCount = content.split('\n').length;
            lineNumbersRef.current.innerHTML = Array.from({ length: lineCount }, (_, i) => `<span>${i + 1}</span>`).join('');
        }
    };
    
    const syncScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
        if (lineNumbersRef.current) {
            const el = e.currentTarget;
            lineNumbersRef.current.scrollTop = el.scrollTop;
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        // Handle Tab key
        if (e.key === 'Tab') {
            e.preventDefault();
            const start = e.currentTarget.selectionStart;
            const end = e.currentTarget.selectionEnd;
            const newContent = content.substring(0, start) + '  ' + content.substring(end);
            onChange(newContent);
            
            // Move cursor after inserted tab
            setTimeout(() => {
                if(textareaRef.current) {
                    textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 2;
                }
            }, 0);
        }

        // Handle Ctrl+S for saving
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            if (isDirty) {
                onSave();
            }
        }
    };

    return (
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl h-full flex flex-col overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500 transition-shadow">
            <div className="flex justify-between items-center p-3 border-b border-slate-700 flex-shrink-0 bg-slate-800/80">
                <h4 className="font-mono text-sm text-slate-300 truncate">
                    {filePath} {isDirty && <span className="text-amber-400 ml-2" title="Unsaved changes">*</span>}
                </h4>
                <div className="flex items-center gap-2">
                    <button
                        onClick={onSave}
                        disabled={!isDirty}
                        className="flex items-center gap-2 px-3 py-1 bg-indigo-600 text-white text-sm font-semibold rounded-md disabled:bg-slate-600 disabled:cursor-not-allowed hover:bg-indigo-500 transition-colors"
                        title="Save changes (Ctrl+S)"
                    >
                        <SaveIcon className="w-4 h-4" />
                        Save
                    </button>
                    <button
                        onClick={onToggleFullScreen}
                        className="p-2 bg-slate-700 hover:bg-indigo-600 rounded-lg text-slate-300 hover:text-white transition-colors"
                        title={isFullScreen ? "Exit Fullscreen" : "Enter Fullscreen"}
                    >
                        {isFullScreen ? <MinimizeIcon className="w-4 h-4" /> : <MaximizeIcon className="w-4 h-4" />}
                    </button>
                </div>
            </div>
            <div className="flex-1 relative bg-[#282c34] flex">
                <div 
                    ref={lineNumbersRef}
                    className="h-full bg-[#21252b] text-right text-slate-500 p-4 font-mono text-sm select-none flex flex-col overflow-hidden"
                    aria-hidden="true"
                >
                </div>
                <div className="relative w-full h-full overflow-hidden">
                    <textarea
                        ref={textareaRef}
                        value={content}
                        onChange={(e) => onChange(e.target.value)}
                        onScroll={syncScroll}
                        onKeyDown={handleKeyDown}
                        className="absolute inset-0 w-full h-full bg-transparent text-slate-200 caret-white font-mono text-sm p-4 border-none focus:outline-none focus:ring-0 resize-none leading-relaxed tracking-wide whitespace-pre"
                        spellCheck="false"
                        autoCapitalize="off"
                        autoComplete="off"
                        autoCorrect="off"
                    />
                </div>
            </div>
        </div>
    );
};

export default CodeEditor;