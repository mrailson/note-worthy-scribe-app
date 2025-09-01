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
  isClinical?: boolean;
  clinicalVerification?: ClinicalVerificationData;
  isQuickPick?: boolean; // Flag to identify messages from quick pick actions
}

export interface ClinicalVerificationData {
  confidenceScore: number; // 0-100
  verificationSources: VerificationSource[];
  llmConsensus: LLMConsensusData[];
  verificationTimestamp: Date;
  verificationStatus: 'pending' | 'verified' | 'flagged';
  riskLevel: 'low' | 'medium' | 'high';
  evidenceSummary?: string;
}

export interface VerificationSource {
  name: string;
  url: string;
  lastUpdated?: string;
  relevantContent: string;
  trustLevel: 'high' | 'medium' | 'low';
}

export interface LLMConsensusData {
  model: string;
  service?: string;
  assessment: string;
  agreementLevel: number; // 0-100
  concerns?: string[];
}

export interface UploadedFile {
  name: string;
  type: string;
  content: string;
  size: number;
  isLoading?: boolean;
  metadata?: {
    hasNumericalData?: boolean;
    wordCount?: number;
    issues?: string[];
  };
}

export interface SearchHistory {
  id: string;
  title: string;
  brief_overview?: string;
  messages: Message[];
  created_at: string;
  updated_at: string;
  is_protected?: boolean;
  is_flagged?: boolean;
}

export interface PracticeContext {
  practiceName?: string;
  practiceManagerName?: string;
  pcnName?: string;
  neighbourhoodName?: string;
  otherPracticesInPCN?: string[];
  logoUrl?: string;
  // Enhanced practice details
  practiceAddress?: string;
  practicePhone?: string;
  practiceEmail?: string;
  practiceWebsite?: string;
  // User details
  userFullName?: string;
  userEmail?: string;
  userRole?: string;
  userRoles?: string[];
  emailSignature?: string;
  letterSignature?: string;
}

export const SUPPORTED_VOICES = ["alloy","ash","ballad","coral","echo","sage","shimmer","verse"] as const;

export type SupportedVoice = typeof SUPPORTED_VOICES[number];