export type TranscriptionService = 
  | 'assemblyai'
  | 'deepgram'
  | 'amazon-transcribe'
  | 'google-cloud'
  | 'whisper-batch';

export interface TranscriptionServiceInfo {
  id: TranscriptionService;
  name: string;
  description: string;
  type: 'realtime' | 'batch';
  available: boolean;
  icon?: string;
}

export const TRANSCRIPTION_SERVICES: TranscriptionServiceInfo[] = [
  { 
    id: 'assemblyai', 
    name: 'AssemblyAI', 
    description: 'High accuracy, real-time streaming', 
    type: 'realtime', 
    available: true 
  },
  { 
    id: 'deepgram', 
    name: 'Deepgram Nova-3', 
    description: 'Fast, low latency, medical vocab', 
    type: 'realtime', 
    available: true 
  },
  { 
    id: 'amazon-transcribe', 
    name: 'Amazon Transcribe', 
    description: 'AWS Medical vocabulary support', 
    type: 'realtime', 
    available: true 
  },
  { 
    id: 'google-cloud', 
    name: 'Google Cloud Speech', 
    description: 'Multi-language, high accuracy', 
    type: 'realtime', 
    available: true 
  },
  { 
    id: 'whisper-batch', 
    name: 'Whisper (Batch)', 
    description: 'Highest accuracy, end of session', 
    type: 'batch', 
    available: true 
  },
];

export interface TranscriptData {
  text: string;
  is_final: boolean;
  confidence: number;
  start?: number;
  end?: number;
  speaker?: string;
}

export interface TranscriptionCallbacks {
  onTranscription: (data: TranscriptData) => void;
  onError: (error: string) => void;
  onStatusChange: (status: string) => void;
  onSummary?: (summary: string) => void;
}

export interface BaseTranscriber {
  startTranscription(): Promise<void>;
  stopTranscription(): void;
  isActive?(): boolean;
  isRecording?(): boolean;
  clearSummary?(): Promise<void>;
}
