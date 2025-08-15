export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  files?: UploadedFile[];
  responseTime?: number;
  timeToFirstWords?: number;
  apiResponseTime?: number;
  model?: string;
  isStreaming?: boolean;
}

export interface UploadedFile {
  name: string;
  type: string;
  content: string;
  size: number;
  isLoading?: boolean;
}

export interface SearchHistory {
  id: string;
  title: string;
  brief_overview?: string;
  messages: Message[];
  created_at: string;
  updated_at: string;
}

export interface PracticeContext {
  practiceName?: string;
  practiceManagerName?: string;
  pcnName?: string;
  neighbourhoodName?: string;
  otherPracticesInPCN?: string[];
  logoUrl?: string;
}

export const SUPPORTED_VOICES = ["alloy","ash","ballad","coral","echo","sage","shimmer","verse"] as const;

export type SupportedVoice = typeof SUPPORTED_VOICES[number];