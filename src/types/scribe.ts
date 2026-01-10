export interface ScribeSession {
  id: string;
  title: string;
  transcript: string;
  summary?: string;
  actionItems?: string;
  keyPoints?: string;
  duration: number;
  wordCount: number;
  createdAt: string;
  updatedAt?: string;
  status: 'recording' | 'completed' | 'archived';
  sessionType?: string;
}

export interface ScribeSettings {
  outputFormat: 'summary' | 'notes' | 'action-items' | 'detailed';
  transcriptionService: 'whisper' | 'assembly' | 'dual';
  autoSave: boolean;
  showTimestamps: boolean;
  tickerEnabled: boolean;
}

export interface ScribeTranscriptData {
  text: string;
  speaker?: string;
  confidence: number;
  timestamp: string;
  isFinal: boolean;
}

export interface ScribeEditStates {
  summary: boolean;
  actionItems: boolean;
  keyPoints: boolean;
}

export interface ScribeEditContent {
  summary: string;
  actionItems: string;
  keyPoints: string;
}

export type ScribeTab = 'recording' | 'summary' | 'history' | 'settings';
