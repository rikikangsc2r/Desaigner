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
  role: 'user' | 'assistant';
  content: string;
  agent?: 'Perencana' | 'Pelaksana' | 'Peninjau';
}

export type FileOperationType = 'CREATE' | 'UPDATE' | 'DELETE';

export interface FileOperation {
  type: FileOperationType;
  path: string;
  content?: string; // content is optional for DELETE
}

export interface AIResponse {
  thought: string;
  operations: FileOperation[];
  status: 'CONTINUING' | 'COMPLETED';
  summary?: string;
}
