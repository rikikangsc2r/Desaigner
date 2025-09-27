import React, { useState, useMemo } from 'react';
import type { ProjectFile } from '../types';
import { FileIcon, FolderIcon, FolderOpenIcon } from './Icons';

interface FileTreeProps {
    files: ProjectFile[];
    onSelectFile: (path: string) => void;
    selectedFile: string | null;
}

interface TreeNode {
    name: string;
    path: string;
    children?: { [key: string]: TreeNode };
    isFolder: boolean;
}

const buildTree = (files: ProjectFile[]): { [key: string]: TreeNode } => {
    const root: { [key: string]: TreeNode } = {};

    files.forEach(file => {
        let currentLevel = root;
        const pathParts = file.path.split('/');
        
        pathParts.forEach((part, index) => {
            if (!currentLevel[part]) {
                const isFolder = index < pathParts.length - 1;
                const currentPath = pathParts.slice(0, index + 1).join('/');
                currentLevel[part] = {
                    name: part,
                    path: currentPath,
                    isFolder: isFolder,
                    ...(isFolder && { children: {} })
                };
            }
            if (currentLevel[part].isFolder) {
                currentLevel = currentLevel[part].children!;
            }
        });
    });

    return root;
};

const TreeItem: React.FC<{ 
    node: TreeNode; 
    onSelectFile: (path: string) => void;
    selectedFile: string | null;
    level: number;
}> = ({ node, onSelectFile, selectedFile, level }) => {
    const [isOpen, setIsOpen] = useState(true);

    const isSelected = selectedFile === node.path;

    if (node.isFolder) {
        return (
            <div>
                <div 
                    onClick={() => setIsOpen(!isOpen)} 
                    className="flex items-center cursor-pointer p-1 rounded hover:bg-slate-700"
                    style={{ paddingLeft: `${level * 16}px` }}
                >
                    {isOpen ? <FolderOpenIcon className="w-4 h-4 mr-2 text-indigo-400" /> : <FolderIcon className="w-4 h-4 mr-2 text-indigo-400" />}
                    <span className="text-slate-300">{node.name}</span>
                </div>
                {isOpen && node.children && (
                    <div>
                        {Object.values(node.children)
                            // FIX: Explicitly type sort callback parameters to fix type inference issue.
                            .sort((a: TreeNode, b: TreeNode) => (a.isFolder === b.isFolder) ? a.name.localeCompare(b.name) : (a.isFolder ? -1 : 1))
                            // FIX: Explicitly type map callback parameter to fix type inference issue for 'child'.
                            .map((child: TreeNode) => (
                                <TreeItem key={child.path} node={child} onSelectFile={onSelectFile} selectedFile={selectedFile} level={level + 1} />
                        ))}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div 
            onClick={() => onSelectFile(node.path)} 
            className={`flex items-center cursor-pointer p-1 rounded ${isSelected ? 'bg-indigo-600 text-white' : 'hover:bg-slate-700 text-slate-300'}`}
            style={{ paddingLeft: `${level * 16}px` }}
        >
            <FileIcon className="w-4 h-4 mr-2 flex-shrink-0" />
            <span className="truncate">{node.name}</span>
        </div>
    );
};


const FileTree: React.FC<FileTreeProps> = ({ files, onSelectFile, selectedFile }) => {
    const tree = useMemo(() => buildTree(files), [files]);

    // FIX: Explicitly type sort callback parameters to fix type inference issue.
    const sortedTree = Object.values(tree).sort((a: TreeNode, b: TreeNode) => (a.isFolder === b.isFolder) ? a.name.localeCompare(b.name) : (a.isFolder ? -1 : 1));

    if (files.length === 0) {
        return <p className="text-slate-400 text-sm">No files yet. Chat with the AI to create some!</p>
    }

    return (
        <div className="space-y-1">
            {/* FIX: Explicitly type map callback parameter to fix type inference issue for 'node'. */}
            {sortedTree.map((node: TreeNode) => (
                <TreeItem key={node.path} node={node} onSelectFile={onSelectFile} selectedFile={selectedFile} level={0} />
            ))}
        </div>
    );
};

export default FileTree;