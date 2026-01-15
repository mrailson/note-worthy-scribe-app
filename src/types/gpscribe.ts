export interface TranscriptData {
  text: string;
  speaker: string;
  confidence: number;
  timestamp: string;
  isFinal: boolean;
  isCompleteSession?: boolean;
}

export interface ConsultationGuidance {
  suggestedQuestions: string[];
  potentialRedFlags: string[];
  missedOpportunities: string[];
  safetyNetting: string[];
  consultationQuality: {
    score: number;
    feedback: string;
  };
}

export interface LanguageOption {
  code: string;
  name: string;
  flag: string;
  voice?: string;
}

export interface OutputLevel {
  value: number;
  label: string;
  description: string;
}

export interface EditStates {
  gpSummary: boolean;
  fullNote: boolean;
  patientCopy: boolean;
  traineeFeedback: boolean;
  referralLetter: boolean;
}

export interface EditContent {
  gpSummary: string;
  fullNote: string;
  patientCopy: string;
  traineeFeedback: string;
  referralLetter: string;
}

export interface ExpandDialog {
  isOpen: boolean;
  title: string;
  content: string;
}

export interface AudioQueueItem {
  text: string;
  languageCode: string;
  id: string;
}

export type ConsultationType = "face-to-face" | "telephone";
export type ActiveTab = "consultation" | "summary" | "examples" | "history" | "chat" | "ai4gp" | "settings";
export type AudioCaptureMode = "mic-only" | "mic-browser";