import { SOAPNote, HeidiNote } from "@/types/scribe";

/**
 * Ageing Well MDT GP Consultation format for SystmOne
 * Follows NHS Ageing Well MDT review structure with narrative paragraphs
 */
export interface AgeingWellNote {
  reasonForReview: string;
  backgroundContext: string;
  currentIssues: string;
  frailtyFunction: string;
  medicationReview: string;
  examinationObservations: string;
  socialSafeguarding: string;
  mdtInput: string;
  plan: string;
  followUp: string;
  patientCarerCommunication: string;
}

// Patterns to filter out "not mentioned" type content
const NOT_MENTIONED_PATTERNS: RegExp[] = [
  /^nil\s+/i,
  /\b(none\s*mentioned|not\s*mentioned|none\s*discussed|not\s*discussed|none\s*given|none\s*made|none\s*required|n\/a|not\s*applicable|not\s*recorded|not\s*documented)\b/i,
];

// Always remove safety-critical negative assertions
const ALWAYS_REMOVE_PATTERNS: RegExp[] = [
  /^no\s+(?:known\s+)?allergies/i,
  /^not\s+(?:examined|assessed|tested|checked|done)/i,
  /^no\s+(?:examination|assessment|investigation)\s+(?:performed|done)/i,
];

/**
 * Filter out negative assertions and optionally "not mentioned" placeholders
 */
function filterContent(text: string, showNotMentioned: boolean = false): string {
  if (!text) return '';

  const lines = text.split('\n');
  const filteredLines = lines.filter((line) => {
    const trimmed = line.trim();
    if (!trimmed) return true;

    if (ALWAYS_REMOVE_PATTERNS.some((pattern) => pattern.test(trimmed))) return false;

    if (!showNotMentioned && NOT_MENTIONED_PATTERNS.some((pattern) => pattern.test(trimmed))) {
      return false;
    }

    return true;
  });

  return filteredLines.join('\n').trim();
}

/**
 * Clean text by removing markdown artifacts
 */
function cleanText(text: string): string {
  if (!text) return '';
  
  return text
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/#+\s*/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Extract medication-related content from text
 */
function extractMedicationContent(text: string): string {
  if (!text) return '';
  
  const lines = text.split('\n');
  const medicationLines: string[] = [];
  let inMedicationSection = false;
  
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.includes('medication') || lower.includes('drug') || lower.includes('dh:') || 
        lower.includes('prescri') || lower.includes('polypharmacy') || lower.includes('adherence')) {
      inMedicationSection = true;
      medicationLines.push(line);
    } else if (inMedicationSection && (lower.match(/^[-•]/) || lower.match(/^\s+/))) {
      medicationLines.push(line);
    } else if (inMedicationSection && line.trim() === '') {
      inMedicationSection = false;
    }
  }
  
  return medicationLines.length > 0 
    ? medicationLines.join('\n').trim() 
    : 'Medication burden reviewed in context of frailty.';
}

/**
 * Extract social/safeguarding content from text
 */
function extractSocialContent(text: string): string {
  if (!text) return '';
  
  const lines = text.split('\n');
  const socialLines: string[] = [];
  
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.includes('social') || lower.includes('carer') || lower.includes('safeguard') ||
        lower.includes('support') || lower.includes('lives') || lower.includes('home') ||
        lower.includes('family') || lower.includes('care package')) {
      socialLines.push(line);
    }
  }
  
  return socialLines.length > 0 
    ? socialLines.join('\n').trim() 
    : 'No safeguarding concerns identified during review.';
}

/**
 * Extract frailty-related content
 */
function extractFrailtyContent(text: string): string {
  if (!text) return '';
  
  const lines = text.split('\n');
  const frailtyLines: string[] = [];
  
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.includes('frailty') || lower.includes('mobility') || lower.includes('function') ||
        lower.includes('falls') || lower.includes('cogniti') || lower.includes('walking') ||
        lower.includes('activities') || lower.includes('independent') || lower.includes('decline')) {
      frailtyLines.push(line);
    }
  }
  
  return frailtyLines.length > 0 
    ? frailtyLines.join('\n').trim() 
    : '';
}

/**
 * Transform SOAP or Heidi notes into Ageing Well MDT format
 */
export function transformToAgeingWell(
  soapNote: SOAPNote | null,
  heidiNote?: HeidiNote | null,
  options: { showNotMentioned?: boolean } = {}
): AgeingWellNote {
  const showNotMentioned = options.showNotMentioned ?? false;
  
  // Prefer Heidi format if available
  const history = heidiNote?.history || soapNote?.S || '';
  const examination = heidiNote?.examination || soapNote?.O || '';
  const assessment = heidiNote?.impression || soapNote?.A || '';
  const plan = heidiNote?.plan || soapNote?.P || '';
  
  const cleanedHistory = cleanText(filterContent(history, showNotMentioned));
  const cleanedExamination = cleanText(filterContent(examination, showNotMentioned));
  const cleanedAssessment = cleanText(filterContent(assessment, showNotMentioned));
  const cleanedPlan = cleanText(filterContent(plan, showNotMentioned));
  
  // Extract specific sections for Ageing Well format
  const medicationReview = extractMedicationContent(cleanedHistory);
  const socialContent = extractSocialContent(cleanedHistory);
  const frailtyContent = extractFrailtyContent(cleanedHistory + '\n' + cleanedAssessment);
  
  return {
    reasonForReview: cleanedAssessment ? `Ageing Well MDT review for ${cleanedAssessment.split('\n')[0]?.substring(0, 100) || 'frailty assessment'}.` : 'Ageing Well MDT review.',
    backgroundContext: cleanedHistory || 'Background discussed with patient and MDT.',
    currentIssues: cleanedAssessment || 'Issues discussed during MDT review.',
    frailtyFunction: frailtyContent || 'Frailty and functional status assessed.',
    medicationReview: medicationReview,
    examinationObservations: cleanedExamination || 'No acute concerns identified on examination.',
    socialSafeguarding: socialContent,
    mdtInput: 'Case discussed with Ageing Well MDT. Agreed plan as documented below.',
    plan: cleanedPlan || 'Plan agreed following MDT discussion.',
    followUp: 'Review as needed. Ageing Well team to continue support.',
    patientCarerCommunication: 'Plan discussed and understood by patient/carer.'
  };
}

/**
 * Get formatted text for the entire Ageing Well note (for copy functionality)
 */
export function getAgeingWellText(note: AgeingWellNote): string {
  const sections: string[] = [];
  
  sections.push('AGEING WELL – MDT REVIEW (GP)\n');
  
  if (note.reasonForReview) {
    sections.push(`REASON FOR REVIEW\n${note.reasonForReview}`);
  }
  if (note.backgroundContext) {
    sections.push(`BACKGROUND & CONTEXT\n${note.backgroundContext}`);
  }
  if (note.currentIssues) {
    sections.push(`CURRENT ISSUES DISCUSSED\n${note.currentIssues}`);
  }
  if (note.frailtyFunction) {
    sections.push(`FRAILTY & FUNCTION\n${note.frailtyFunction}`);
  }
  if (note.medicationReview) {
    sections.push(`MEDICATION REVIEW\n${note.medicationReview}`);
  }
  if (note.examinationObservations) {
    sections.push(`EXAMINATION / OBSERVATIONS\n${note.examinationObservations}`);
  }
  if (note.socialSafeguarding) {
    sections.push(`SOCIAL & SAFEGUARDING CONSIDERATIONS\n${note.socialSafeguarding}`);
  }
  if (note.mdtInput) {
    sections.push(`MDT INPUT\n${note.mdtInput}`);
  }
  if (note.plan) {
    sections.push(`PLAN\n${note.plan}`);
  }
  if (note.followUp) {
    sections.push(`FOLLOW-UP\n${note.followUp}`);
  }
  if (note.patientCarerCommunication) {
    sections.push(`PATIENT / CARER COMMUNICATION\n${note.patientCarerCommunication}`);
  }
  
  return sections.join('\n\n');
}

/**
 * Section configuration for the Ageing Well layout
 */
export const AGEING_WELL_SECTIONS = [
  { 
    key: 'reasonForReview' as const, 
    title: 'Reason for Review', 
    description: 'Brief reason for Ageing Well review',
    colorClass: 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400',
    borderClass: 'border-rose-200 dark:border-rose-800'
  },
  { 
    key: 'backgroundContext' as const, 
    title: 'Background & Context', 
    description: 'Living situation, support, known frailty issues',
    colorClass: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
    borderClass: 'border-blue-200 dark:border-blue-800'
  },
  { 
    key: 'currentIssues' as const, 
    title: 'Current Issues Discussed', 
    description: 'Key problems affecting function, safety, independence',
    colorClass: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
    borderClass: 'border-amber-200 dark:border-amber-800'
  },
  { 
    key: 'frailtyFunction' as const, 
    title: 'Frailty & Function', 
    description: 'Functional ability, mobility, falls risk, cognition',
    colorClass: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
    borderClass: 'border-orange-200 dark:border-orange-800'
  },
  { 
    key: 'medicationReview' as const, 
    title: 'Medication Review', 
    description: 'Medication burden, polypharmacy, adherence',
    colorClass: 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400',
    borderClass: 'border-teal-200 dark:border-teal-800'
  },
  { 
    key: 'examinationObservations' as const, 
    title: 'Examination / Observations', 
    description: 'Clinical findings if relevant',
    colorClass: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
    borderClass: 'border-green-200 dark:border-green-800'
  },
  { 
    key: 'socialSafeguarding' as const, 
    title: 'Social & Safeguarding Considerations', 
    description: 'Carer support, carer strain, social risks',
    colorClass: 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-400',
    borderClass: 'border-pink-200 dark:border-pink-800'
  },
  { 
    key: 'mdtInput' as const, 
    title: 'MDT Input', 
    description: 'Ageing Well MDT discussion summary',
    colorClass: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400',
    borderClass: 'border-indigo-200 dark:border-indigo-800'
  },
  { 
    key: 'plan' as const, 
    title: 'Plan', 
    description: 'Clear, proportionate plan with GP role',
    colorClass: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
    borderClass: 'border-purple-200 dark:border-purple-800'
  },
  { 
    key: 'followUp' as const, 
    title: 'Follow-up', 
    description: 'Who will review and when',
    colorClass: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400',
    borderClass: 'border-cyan-200 dark:border-cyan-800'
  },
  { 
    key: 'patientCarerCommunication' as const, 
    title: 'Patient / Carer Communication', 
    description: 'Plan discussed and understood',
    colorClass: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
    borderClass: 'border-emerald-200 dark:border-emerald-800'
  },
] as const;
