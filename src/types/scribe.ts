export type ConsultationState = 'ready' | 'recording' | 'generating' | 'review';

export type ConsultationType = 'f2f' | 'telephone' | 'video';

// Legacy SOAP format (maintained for backwards compatibility)
export interface SOAPNote {
  S: string; // Subjective - History
  O: string; // Objective - Examination
  A: string; // Assessment
  P: string; // Plan
}

// New Heidi-style anti-hallucination format
export interface HeidiNote {
  consultationHeader: string; // [F2F/T/C/Video] [Seen alone/with...] [Reason for visit]
  history: string;            // HPC, ICE, red flags, risk factors, PMH, DH, allergies, FH, SH
  examination: string;        // Vitals, physical/mental exam, investigations
  impression: string;         // Issues with assessments and differentials
  plan: string;               // Investigations, treatment, referrals, follow-up, safety netting
}

export type NoteFormat = 'soap' | 'heidi';

export interface ConsultationNote {
  // Legacy SOAP support
  soapNote: SOAPNote;
  // New Heidi format
  heidiNote?: HeidiNote;
  // Which format is active
  noteFormat: NoteFormat;
  // Additional data
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
  heidiNote?: HeidiNote;
  noteFormat?: NoteFormat;
  duration: number;
  wordCount: number;
  createdAt: string;
  updatedAt?: string;
  status: 'recording' | 'completed' | 'archived';
  sessionType?: string;
  consultationType?: ConsultationType;
}

export type ConsultationViewMode = 'soap' | 'narrative' | 'summary';

export interface ScribeSettings {
  outputFormat: 'soap' | 'summary' | 'notes' | 'detailed';
  noteFormat: NoteFormat; // Which note format to use
  emrFormat: 'emis' | 'systmone';
  transcriptionService: 'whisper' | 'assembly' | 'dual';
  autoSave: boolean;
  showLiveTranscript: boolean;
  tickerEnabled: boolean;
  defaultConsultationType: ConsultationType;
  showConsentReminder: boolean;
  consultationViewMode: ConsultationViewMode;
  consultationDetailLevel: number;
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

export interface HeidiEditStates {
  consultationHeader: boolean;
  history: boolean;
  examination: boolean;
  impression: boolean;
  plan: boolean;
}

export interface ScribeEditContent {
  S: string;
  O: string;
  A: string;
  P: string;
}

export interface HeidiEditContent {
  consultationHeader: string;
  history: string;
  examination: string;
  impression: string;
  plan: string;
}

export type ScribeTab = 'consultation' | 'history' | 'settings';

export const CONSULTATION_TYPE_LABELS: Record<ConsultationType, string> = {
  f2f: 'Face to Face',
  telephone: 'Telephone',
  video: 'Video'
};

export const CONSULTATION_TYPE_SHORT: Record<ConsultationType, string> = {
  f2f: 'F2F',
  telephone: 'T/C',
  video: 'Video'
};

export const DEFAULT_SCRIBE_SETTINGS: ScribeSettings = {
  outputFormat: 'soap',
  noteFormat: 'heidi', // Default to Heidi format
  emrFormat: 'emis',
  transcriptionService: 'whisper',
  autoSave: true,
  showLiveTranscript: true,
  tickerEnabled: false,
  defaultConsultationType: 'f2f',
  showConsentReminder: true,
  consultationViewMode: 'soap',
  consultationDetailLevel: 3
};
