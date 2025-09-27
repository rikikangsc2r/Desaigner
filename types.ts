
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
}

export type FileOperationType = 'CREATE' | 'UPDATE' | 'DELETE';

export interface FileOperation {
  // FIX: Renamed 'type' to 'operation' for consistency with the AI service response.
  operation: FileOperationType;
  path: string;
  content?: string; // content is optional for DELETE
  reasoning: string;
}