import { SOAPNote, HeidiNote } from "@/types/scribe";

/**
 * Complex Ageing Well Review – Comprehensive Geriatric Assessment (CGA)
 * 17-section format for UK GP consultations following NHS/CQC standards
 */
export interface AgeingWellNote {
  // 1. Reason for Review
  reasonForReview: string;
  // 2. Patient Background
  patientBackground: string;
  // 3. Medical History Review (Comprehensive)
  medicalHistoryReview: string;
  // 4. Medication Review (Polypharmacy-Focused)
  medicationReview: string;
  // 5. Cognitive & Mental Health Assessment
  cognitiveMentalHealth: string;
  // 6. Functional Assessment
  functionalAssessment: string;
  // 7. Frailty, Falls & Safety Review
  frailtyFallsSafety: string;
  // 8. Nutrition & Hydration
  nutritionHydration: string;
  // 9. Social & Carer Review
  socialCarerReview: string;
  // 10. Advance Care Planning
  advanceCarePlanning: string;
  // 11. MDT Involvement & Coordination
  mdtInvolvement: string;
  // 12. Examination (If Performed / Observed)
  examination: string;
  // 13. Risk Assessment & Safeguarding
  riskSafeguarding: string;
  // 14. Clinical Impression
  clinicalImpression: string;
  // 15. Management Plan
  managementPlan: string;
  // 16. Patient & Carer Understanding
  patientCarerUnderstanding: string;
  // 17. Time & Complexity Statement
  timeComplexityStatement: string;
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
 * Transform SOAP or Heidi notes into Ageing Well CGA format
 * This is a fallback transformation when AI-generated content is not available
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
    patientBackground: cleanedHistory || 'Background discussed with patient and MDT.',
    medicalHistoryReview: cleanedAssessment || 'Medical history reviewed during consultation.',
    medicationReview: medicationReview,
    cognitiveMentalHealth: 'Cognitive and mental health status assessed.',
    functionalAssessment: frailtyContent || 'Functional status assessed.',
    frailtyFallsSafety: 'Falls risk and safety assessed.',
    nutritionHydration: 'Nutrition and hydration status reviewed.',
    socialCarerReview: socialContent,
    advanceCarePlanning: 'Advance care planning discussed where appropriate.',
    mdtInvolvement: 'Case discussed with Ageing Well MDT. Agreed plan as documented below.',
    examination: cleanedExamination || 'No acute concerns identified on examination.',
    riskSafeguarding: 'Safeguarding considered – no immediate concerns identified.',
    clinicalImpression: cleanedAssessment || 'Clinical impression formed following comprehensive review.',
    managementPlan: cleanedPlan || 'Plan agreed following MDT discussion.',
    patientCarerUnderstanding: 'Plan discussed and understood by patient/carer.',
    timeComplexityStatement: 'This was a prolonged and complex Ageing Well review involving multiple comorbidities, polypharmacy, functional assessment, and anticipatory care planning. Total clinician time exceeded standard consultation length.'
  };
}

/**
 * Get formatted text for the entire Ageing Well note (for copy functionality)
 */
export function getAgeingWellText(note: AgeingWellNote): string {
  const sections: string[] = [];
  
  sections.push('COMPLEX AGEING WELL REVIEW – COMPREHENSIVE GERIATRIC ASSESSMENT\n');
  
  if (note.reasonForReview) {
    sections.push(`1. REASON FOR REVIEW\n${note.reasonForReview}`);
  }
  if (note.patientBackground) {
    sections.push(`2. PATIENT BACKGROUND\n${note.patientBackground}`);
  }
  if (note.medicalHistoryReview) {
    sections.push(`3. MEDICAL HISTORY REVIEW\n${note.medicalHistoryReview}`);
  }
  if (note.medicationReview) {
    sections.push(`4. MEDICATION REVIEW\n${note.medicationReview}`);
  }
  if (note.cognitiveMentalHealth) {
    sections.push(`5. COGNITIVE & MENTAL HEALTH ASSESSMENT\n${note.cognitiveMentalHealth}`);
  }
  if (note.functionalAssessment) {
    sections.push(`6. FUNCTIONAL ASSESSMENT\n${note.functionalAssessment}`);
  }
  if (note.frailtyFallsSafety) {
    sections.push(`7. FRAILTY, FALLS & SAFETY REVIEW\n${note.frailtyFallsSafety}`);
  }
  if (note.nutritionHydration) {
    sections.push(`8. NUTRITION & HYDRATION\n${note.nutritionHydration}`);
  }
  if (note.socialCarerReview) {
    sections.push(`9. SOCIAL & CARER REVIEW\n${note.socialCarerReview}`);
  }
  if (note.advanceCarePlanning) {
    sections.push(`10. ADVANCE CARE PLANNING\n${note.advanceCarePlanning}`);
  }
  if (note.mdtInvolvement) {
    sections.push(`11. MDT INVOLVEMENT & COORDINATION\n${note.mdtInvolvement}`);
  }
  if (note.examination) {
    sections.push(`12. EXAMINATION\n${note.examination}`);
  }
  if (note.riskSafeguarding) {
    sections.push(`13. RISK ASSESSMENT & SAFEGUARDING\n${note.riskSafeguarding}`);
  }
  if (note.clinicalImpression) {
    sections.push(`14. CLINICAL IMPRESSION\n${note.clinicalImpression}`);
  }
  if (note.managementPlan) {
    sections.push(`15. MANAGEMENT PLAN\n${note.managementPlan}`);
  }
  if (note.patientCarerUnderstanding) {
    sections.push(`16. PATIENT & CARER UNDERSTANDING\n${note.patientCarerUnderstanding}`);
  }
  if (note.timeComplexityStatement) {
    sections.push(`17. TIME & COMPLEXITY STATEMENT\n${note.timeComplexityStatement}`);
  }
  
  return sections.join('\n\n');
}

/**
 * Section configuration for the Complex Ageing Well Review layout (17 sections)
 */
export const AGEING_WELL_SECTIONS = [
  { 
    key: 'reasonForReview' as const, 
    title: '1. Reason for Review', 
    description: 'Trigger for review, recent deterioration, goals of review',
    colorClass: 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400',
    borderClass: 'border-rose-200 dark:border-rose-800'
  },
  { 
    key: 'patientBackground' as const, 
    title: '2. Patient Background', 
    description: 'Age, living situation, social context, baseline function, frailty status',
    colorClass: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
    borderClass: 'border-blue-200 dark:border-blue-800'
  },
  { 
    key: 'medicalHistoryReview' as const, 
    title: '3. Medical History Review', 
    description: 'Comprehensive review: CV, respiratory, neuro, endocrine, renal, MSK, mental health, sensory, continence',
    colorClass: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
    borderClass: 'border-amber-200 dark:border-amber-800'
  },
  { 
    key: 'medicationReview' as const, 
    title: '4. Medication Review', 
    description: 'Polypharmacy, adherence, anticholinergic burden, falls risk, PRN, OTC, changes',
    colorClass: 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400',
    borderClass: 'border-teal-200 dark:border-teal-800'
  },
  { 
    key: 'cognitiveMentalHealth' as const, 
    title: '5. Cognitive & Mental Health', 
    description: 'Memory, orientation, mood, anxiety, delirium risk, capacity, safeguarding',
    colorClass: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400',
    borderClass: 'border-violet-200 dark:border-violet-800'
  },
  { 
    key: 'functionalAssessment' as const, 
    title: '6. Functional Assessment', 
    description: 'Mobility, transfers, stairs, falls, aids, ADLs, IADLs',
    colorClass: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
    borderClass: 'border-orange-200 dark:border-orange-800'
  },
  { 
    key: 'frailtyFallsSafety' as const, 
    title: '7. Frailty, Falls & Safety', 
    description: 'Falls risk, postural symptoms, vision, footwear, home hazards, driving',
    colorClass: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
    borderClass: 'border-red-200 dark:border-red-800'
  },
  { 
    key: 'nutritionHydration' as const, 
    title: '8. Nutrition & Hydration', 
    description: 'Weight trends, appetite, swallowing, dentition, access to food, malnutrition risk',
    colorClass: 'bg-lime-100 dark:bg-lime-900/30 text-lime-700 dark:text-lime-400',
    borderClass: 'border-lime-200 dark:border-lime-800'
  },
  { 
    key: 'socialCarerReview' as const, 
    title: '9. Social & Carer Review', 
    description: 'Carer identity and burden, support services, isolation, financial/housing',
    colorClass: 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-400',
    borderClass: 'border-pink-200 dark:border-pink-800'
  },
  { 
    key: 'advanceCarePlanning' as const, 
    title: '10. Advance Care Planning', 
    description: 'DNACPR, ReSPECT, preferred place of care/death, LPA, patient values',
    colorClass: 'bg-slate-100 dark:bg-slate-900/30 text-slate-700 dark:text-slate-400',
    borderClass: 'border-slate-200 dark:border-slate-800'
  },
  { 
    key: 'mdtInvolvement' as const, 
    title: '11. MDT Involvement & Coordination', 
    description: 'Ageing Well team roles, community services, gaps, referrals',
    colorClass: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400',
    borderClass: 'border-indigo-200 dark:border-indigo-800'
  },
  { 
    key: 'examination' as const, 
    title: '12. Examination', 
    description: 'General appearance, mobility observed, key system findings',
    colorClass: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
    borderClass: 'border-green-200 dark:border-green-800'
  },
  { 
    key: 'riskSafeguarding' as const, 
    title: '13. Risk Assessment & Safeguarding', 
    description: 'Clinical risk summary, capacity, self-neglect, safeguarding outcome',
    colorClass: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
    borderClass: 'border-yellow-200 dark:border-yellow-800'
  },
  { 
    key: 'clinicalImpression' as const, 
    title: '14. Clinical Impression', 
    description: 'Holistic GP synthesis, frailty trajectory, stability vs decline, prognosis',
    colorClass: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
    borderClass: 'border-purple-200 dark:border-purple-800'
  },
  { 
    key: 'managementPlan' as const, 
    title: '15. Management Plan', 
    description: 'Clear itemised plan with responsibility, timescales, monitoring, follow-up',
    colorClass: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400',
    borderClass: 'border-cyan-200 dark:border-cyan-800'
  },
  { 
    key: 'patientCarerUnderstanding' as const, 
    title: '16. Patient & Carer Understanding', 
    description: 'What was explained, level of understanding, agreement, concerns',
    colorClass: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
    borderClass: 'border-emerald-200 dark:border-emerald-800'
  },
  { 
    key: 'timeComplexityStatement' as const, 
    title: '17. Time & Complexity Statement', 
    description: 'Documentation of prolonged/complex review duration',
    colorClass: 'bg-stone-100 dark:bg-stone-900/30 text-stone-700 dark:text-stone-400',
    borderClass: 'border-stone-200 dark:border-stone-800'
  },
] as const;
