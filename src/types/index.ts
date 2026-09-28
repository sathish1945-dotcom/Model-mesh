export type TaskCategory = 'general' | 'coding' | 'reasoning' | 'finance';

export type AiMode = 'auto' | TaskCategory;

export interface User {
  id: string;
  email: string;
  name: string;
  auth_provider: 'email' | 'google';
  created_at: string;
}

export interface ProviderConnection {
  id: string;
  user_id: string;
  provider: 'openrouter';
  connection_status: 'connected' | 'disconnected' | 'error';
  created_at: string;
  updated_at: string;
}

export interface Chat {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at?: string;
}

export interface ChatMessage {
  id: string;
  chat_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model_category?: TaskCategory;
  model_id?: string;
  created_at: string;
}

export interface ClassificationResult {
  category: TaskCategory;
  confidence: number;
  reason: string;
}

export interface RouteResolution {
  category: TaskCategory;
  selectedModel: string;
  fallbackModels: string[];
  displayName: string;
}
