export type ConsultationState = 'ready' | 'recording' | 'generating' | 'review';

export type ConsultationType = 'f2f' | 'telephone' | 'dictate';

export type ConsultationCategory = 'general' | 'agewell' | 'social_prescriber';

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
  impression: string;         // Problems/issues discussed (NOT diagnoses - transcription only)
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
  realtimeTranscript?: string; // AssemblyAI/Notewell real-time transcript for comparison
  summary?: string;
  actionItems?: string;
  keyPoints?: string;
  soapNote?: SOAPNote;
  heidiNote?: HeidiNote;
  noteFormat?: NoteFormat;
  quickSummary?: string; // One-liner for quick clinical identification
  duration: number;
  wordCount: number;
  createdAt: string;
  updatedAt?: string;
  status: 'recording' | 'completed' | 'archived';
  sessionType?: string;
  consultationType?: ConsultationType;
  consultationCategory?: ConsultationCategory;
  // Patient context for memory jogger (masked in list views)
  patientName?: string;
  patientNhsNumber?: string;
  patientDob?: string;
  patientContextConfidence?: number;
  // Clinical headline & workflow state
  customHeadline?: string;        // GP-edited headline override
  clinicalSignals?: string[];     // ['medication', 'mentalHealth', 'safetyNet', 'followUp', 'letter']
  reviewStatus?: 'reviewed' | 'followUpDue' | 'actionPending' | 'draft';
  followUpDate?: string;          // ISO date for follow-up
  isReviewed?: boolean;           // GP marked as reviewed
  isCopied?: boolean;             // Note has been copied to clinical system
}

export type ConsultationViewMode = 'soap' | 'narrativeClinical' | 'summary' | 'patient' | 'referral' | 'transcript';

export type NoteStyle = 'shorthand' | 'standard';

export type HistoryRetention = '1hour' | '1day' | '1week' | '1month';

export const HISTORY_RETENTION_LABELS: Record<HistoryRetention, string> = {
  '1hour': '1 Hour',
  '1day': '1 Day',
  '1week': '1 Week',
  '1month': '1 Month'
};

// Audio recording format options
export type AudioRecordingFormat = 'webm' | 'mp3';

export const AUDIO_FORMAT_LABELS: Record<AudioRecordingFormat, string> = {
  'webm': 'WebM (Opus) - Default',
  'mp3': 'MP3 - Alternative'
};

// Chunk duration configuration
export const CHUNK_DURATION_OPTIONS = {
  min: 15,
  max: 60,
  default: 25,
  step: 5
} as const;

// Patient context extracted from clinical system screenshot
export interface PatientContext {
  name: string;
  nhsNumber: string;      // Validated and formatted (XXX XXX XXXX)
  dateOfBirth: string;    // UK format (DD/MM/YYYY)
  extractedAt: string;    // ISO timestamp
  confidence?: number;    // AI confidence score (0-1)
  rawExtract?: string;    // Original text extracted for debugging
  // Optional fields for letters/referrals
  address?: string;       // Full postal address
  phoneNumbers?: {
    mobile?: string;
    home?: string;
    work?: string;
    preferred?: 'mobile' | 'home' | 'work';  // Which number is marked as preferred
  };
  gender?: 'M' | 'F';     // Male or Female
}

// Context file for consultation (blood results, screenshots, documents)
export interface ConsultationContextFile {
  id: string;
  name: string;
  type: 'image' | 'document';
  content: string;        // Extracted text content
  preview?: string;       // Base64 preview for images
  addedAt: string;
  isProcessing?: boolean;
  error?: string;
}

// "So Far" AI analysis result
export interface SoFarAnalysis {
  summary: string;
  issuesDiscussed: string[];
  outstandingQuestions: string[];
  suggestedWrapUp: string[];
  redFlagsIdentified: string[];
  lastUpdated: string;
}

export interface ScribeSettings {
  outputFormat: 'soap' | 'summary' | 'notes' | 'detailed';
  noteFormat: NoteFormat; // Which note format to use
  noteStyle: NoteStyle; // GP Shorthand vs Standard notes
  emrFormat: 'emis' | 'systmone';
  transcriptionService: 'whisper' | 'assembly' | 'dual';
  autoSave: boolean;
  showLiveTranscript: boolean;
  tickerEnabled: boolean;
  defaultConsultationType: ConsultationType;
  showConsentReminder: boolean;
  consultationViewMode: ConsultationViewMode;
  consultationDetailLevel: number;
  showNotMentioned: boolean; // Show lines containing "None mentioned", "N/A", etc.
  showPatientBannerDuringRecording: boolean; // Show patient details during recording
  historyRetention: HistoryRetention; // How long to keep consultation history
  showDevDisclaimer: boolean; // Show/hide the development disclaimer banner
  minimalRecordingView: boolean; // Show minimal timer/word count only during recording
  // Per-consultation-type microphone settings
  f2fMicrophoneId?: string | null;
  telephoneMicrophoneId?: string | null;
  dictateMicrophoneId?: string | null;
  systemAudioEnabled?: boolean; // Capture system audio for telephone software
  // Audio recording settings
  audioFormat?: AudioRecordingFormat; // Audio encoding format (webm or mp3)
  chunkDurationSeconds?: number; // Audio chunk duration for transcription (15-60s)
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

export type ScribeTab = 'consultation' | 'import' | 'history' | 'transcript' | 'settings';

export const CONSULTATION_TYPE_LABELS: Record<ConsultationType, string> = {
  f2f: 'Face to Face',
  telephone: 'Telephone',
  dictate: 'Dictate'
};

export const F2F_ACCOMPANIED_LABELS = {
  alone: '',
  accompanied: '(Accompanied)'
} as const;

export const CONSULTATION_TYPE_SHORT: Record<ConsultationType, string> = {
  f2f: 'F2F',
  telephone: 'T/C',
  dictate: 'Dictate'
};

export const CONSULTATION_CATEGORY_LABELS: Record<ConsultationCategory, string> = {
  general: 'General Consultation',
  agewell: 'Age Well',
  social_prescriber: 'Social Prescriber'
};

export const DEFAULT_SCRIBE_SETTINGS: ScribeSettings = {
  outputFormat: 'soap',
  noteFormat: 'heidi', // Default to Heidi format
  noteStyle: 'standard', // Default to standard notes
  emrFormat: 'emis',
  transcriptionService: 'whisper',
  autoSave: true,
  showLiveTranscript: true,
  tickerEnabled: false,
  defaultConsultationType: 'f2f',
  showConsentReminder: true,
  consultationViewMode: 'narrativeClinical',
  consultationDetailLevel: 3,
  showNotMentioned: false, // Default to hiding "None mentioned" lines
  showPatientBannerDuringRecording: true, // Default to showing patient banner
  historyRetention: '1week', // Default to 1 week retention
  showDevDisclaimer: true, // Default to showing development disclaimer
  minimalRecordingView: true, // Default to minimal view for patient comfort
  // Per-consultation-type microphone settings (null = use system default)
  f2fMicrophoneId: null,
  telephoneMicrophoneId: null,
  dictateMicrophoneId: null,
  // Audio recording settings
  audioFormat: 'webm', // Default to WebM (best compatibility)
  chunkDurationSeconds: 25, // Default 25 seconds per chunk
};
