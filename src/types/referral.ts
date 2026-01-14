// Referral system types - scribe-safe referral drafting

export type ReferralPriority = 'routine' | 'urgent' | '2ww' | 'same-day';
export type ReferralConfidence = 'high' | 'medium' | 'low';
export type ToneVersion = 'neutral' | 'friendly' | 'concise';
export type TriggerEvidenceType = 'symptom' | 'plan' | 'examination' | 'risk_factor' | 'negative';

export interface TriggerEvidence {
  type: TriggerEvidenceType;
  text: string;
  source: string;
}

export interface ReferralSuggestion {
  id: string;
  type: string;
  displayName: string;
  specialty: string;
  pathway?: string;
  priority: ReferralPriority;
  confidence: ReferralConfidence;
  triggerEvidence: TriggerEvidence[];
  contraFlags?: string[];
}

export interface ClinicalDetails {
  symptoms: string;
  riskFactors: string;
  negatives: string;
  medications: string;
  investigations: string;
}

export interface ExtractedFacts {
  symptoms: string[];
  riskFactors: string[];
  negatives: string[];
  medications: string[];
  investigations: string[];
  planStatements: string[];
}

export interface ReferralDraft {
  id: string;
  suggestionId: string;
  recipientService: string;
  specialty: string;
  urgency: ReferralPriority;
  reasonForReferral: string;
  clinicalDetails: ClinicalDetails;
  requestedAction: string;
  safetyNettingGiven: boolean;
  toneVersion: ToneVersion;
  letterContent: string;
  clinicianConfirmed: boolean;
  confirmedAt?: string;
  confirmedBy?: string;
}

export interface ReferralAnalysisResponse {
  suggestions: ReferralSuggestion[];
  extractedFacts: ExtractedFacts;
}

export interface ReferralDraftResponse {
  draft: ReferralDraft;
  letterContent: string;
}

export interface ToneRewriteResponse {
  rewrittenContent: string;
  changesApplied: string[];
  clinicalFactsPreserved: boolean;
  warning?: string;
}

// Referral destination for practice-level hospital/department contacts
export interface ReferralDestination {
  id: string;
  practice_id?: string | null;
  created_by?: string | null;
  hospital_name: string;
  department: string;
  contact_name?: string | null;
  email?: string | null;
  phone?: string | null;
  fax?: string | null;
  address?: string | null;
  notes?: string | null;
  specialty_keywords?: string[] | null;
  is_active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

// Referral type mappings for UK NHS pathways
export const REFERRAL_SPECIALTIES: Record<string, string[]> = {
  'Cardiology': ['RACPC', 'Heart Failure Clinic', 'Arrhythmia Clinic', 'General Cardiology'],
  'Respiratory': ['Chest Clinic', 'Sleep Clinic', 'Lung Cancer Pathway'],
  'Gastroenterology': ['Endoscopy', 'IBD Clinic', 'Liver Clinic', 'Lower GI 2WW'],
  'Neurology': ['Headache Clinic', 'First Seizure Clinic', 'General Neurology'],
  'Rheumatology': ['Early Arthritis Clinic', 'Connective Tissue Clinic'],
  'Dermatology': ['Skin Cancer 2WW', 'General Dermatology'],
  'Orthopaedics': ['MSK Clinic', 'Spinal Pathway', 'Joint Replacement'],
  'Urology': ['Haematuria 2WW', 'LUTS Clinic', 'Prostate Pathway'],
  'Gynaecology': ['PMB 2WW', 'Pelvic Pain Clinic', 'General Gynaecology'],
  'ENT': ['Head & Neck 2WW', 'Hearing Clinic', 'General ENT'],
  'Ophthalmology': ['Cataract Pathway', 'Glaucoma Clinic', 'Medical Retina'],
  'Mental Health': ['IAPT', 'CMHT', 'Crisis Team', 'Perinatal Mental Health'],
  'Physiotherapy': ['MSK Physio', 'Respiratory Physio', 'Pelvic Health'],
};

export const PRIORITY_LABELS: Record<ReferralPriority, string> = {
  'routine': 'Routine',
  'urgent': 'Urgent',
  '2ww': '2 Week Wait',
  'same-day': 'Same Day',
};

export const CONFIDENCE_COLOURS: Record<ReferralConfidence, string> = {
  'high': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  'medium': 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  'low': 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

export const PRIORITY_COLOURS: Record<ReferralPriority, string> = {
  'routine': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  'urgent': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  '2ww': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  'same-day': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
};
