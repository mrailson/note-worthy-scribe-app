export type ConsultationState = 'ready' | 'recording' | 'generating' | 'review';

export type ConsultationType = 'f2f' | 'telephone' | 'video';

export interface SOAPNote {
  S: string; // Subjective - History
  O: string; // Objective - Examination
  A: string; // Assessment
  P: string; // Plan
}

export interface ConsultationNote {
  soapNote: SOAPNote;
  patientLetter?: string;
  referralLetter?: string;
  snomedCodes?: string[];
}

export interface ScribeConsultation {
  id: string;
  state: ConsultationState;
  type: ConsultationType;
  patientConsent: boolean;
  consentTimestamp?: string;
  transcript: string;
  cleanedTranscript?: string;
  note: ConsultationNote | null;
  duration: number;
  wordCount: number;
  createdAt: string;
  updatedAt?: string;
}

export interface ScribeSession {
  id: string;
  title: string;
  transcript: string;
  summary?: string;
  actionItems?: string;
  keyPoints?: string;
  soapNote?: SOAPNote;
  duration: number;
  wordCount: number;
  createdAt: string;
  updatedAt?: string;
  status: 'recording' | 'completed' | 'archived';
  sessionType?: string;
  consultationType?: ConsultationType;
}

export interface ScribeSettings {
  outputFormat: 'soap' | 'summary' | 'notes' | 'detailed';
  emrFormat: 'emis' | 'systmone';
  transcriptionService: 'whisper' | 'assembly' | 'dual';
  autoSave: boolean;
  showLiveTranscript: boolean;
  tickerEnabled: boolean;
  defaultConsultationType: ConsultationType;
  showConsentReminder: boolean;
}

export interface ScribeTranscriptData {
  text: string;
  speaker?: string;
  confidence: number;
  timestamp: string;
  isFinal: boolean;
}

export interface ScribeEditStates {
  S: boolean;
  O: boolean;
  A: boolean;
  P: boolean;
}

export interface ScribeEditContent {
  S: string;
  O: string;
  A: string;
  P: string;
}

export type ScribeTab = 'consultation' | 'history' | 'settings';

export const CONSULTATION_TYPE_LABELS: Record<ConsultationType, string> = {
  f2f: 'Face to Face',
  telephone: 'Telephone',
  video: 'Video'
};

export const DEFAULT_SCRIBE_SETTINGS: ScribeSettings = {
  outputFormat: 'soap',
  emrFormat: 'emis',
  transcriptionService: 'whisper',
  autoSave: true,
  showLiveTranscript: true,
  tickerEnabled: false,
  defaultConsultationType: 'f2f',
  showConsentReminder: true
};
