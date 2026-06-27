export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
}

export interface HFModel {
  id: string;
  name: string;
  icon: string;
}

export interface Settings {
  hfToken: string;
  theme: 'dark' | 'light';
  defaultModel: string;
}

export interface FileItem {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
}
