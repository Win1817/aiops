export type ModelProfile = string;

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface ChatState {
  messages: Message[];
  isStreaming: boolean;
  isLoading: boolean;
  theme: 'light' | 'dark';
  profile: ModelProfile;
}
