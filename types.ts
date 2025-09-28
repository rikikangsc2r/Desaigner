
export interface ProjectFile {
  path: string;
  content: string;
}

export interface Project {
  id: string;
  name: string;
  files: ProjectFile[];
  updatedAt: number;
  chatHistory: ChatMessage[];
  currentSessionId: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export type FileOperationType = 'CREATE' | 'UPDATE' | 'DELETE';

export interface FileOperation {
  operation: FileOperationType;
  path: string;
  content?: string; // content is optional for DELETE
  reasoning?: string;
}

export interface BlueprintFile {
  path: string;
  operation: FileOperationType;
  description: string;
}
