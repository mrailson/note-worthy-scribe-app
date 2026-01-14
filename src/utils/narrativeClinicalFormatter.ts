import { SOAPNote, HeidiNote } from "@/types/scribe";

/**
 * Narrative Clinical Layout structure
 * Follows the H/E/A/I/P format: History, Examination, Assessment, Intervention, Plan
 */
export interface NarrativeClinicalNote {
  history: string;        // Derived from S (Subjective) or HeidiNote.history
  examination: string;    // Derived from O (Objective) or HeidiNote.examination
  assessment: string;     // Problem-based, derived from A or HeidiNote.impression
  intervention: string;   // Immediate actions from P/plan
  plan: string;           // Follow-up, safety-netting, ongoing management from P/plan
}

// Patterns that indicate immediate interventions (done during consultation)
const INTERVENTION_PATTERNS = [
  /prescribed|issued|started|administered|given|commenced/i,
  /referred\s+(?:today|now|immediately|urgently)/i,
  /performed|done|completed|carried out/i,
  /advised|counselled|explained|discussed|agreed/i,
  /blood\s+(?:test|sample)\s+(?:taken|done)/i,
  /examination\s+(?:performed|done)/i,
  /swab\s+taken/i,
  /injection\s+given/i,
  /dressing\s+(?:applied|changed)/i,
  /leaflet\s+(?:given|provided)/i,
  /fit\s+note\s+(?:issued|provided)/i,
  /sick\s+note/i,
  /prescription\s+(?:issued|given)/i,
];

// Patterns that indicate follow-up/ongoing plan items
const PLAN_PATTERNS = [
  /follow[- ]?up|review|f\/u/i,
  /return\s+if|come\s+back\s+if|seek\s+(?:medical\s+)?(?:help|advice)\s+if/i,
  /safety[- ]?net|red\s+flag/i,
  /ongoing|continue|maintain/i,
  /await|waiting\s+for|pending/i,
  /recheck|repeat|monitor/i,
  /consider|may\s+need|might\s+require/i,
  /if\s+(?:symptoms?\s+)?(?:persist|worsen|not\s+improv)/i,
  /phone\s+for\s+results/i,
  /book\s+(?:appointment|review)/i,
  /routine\s+referral/i,
  /watchful\s+waiting/i,
];

/**
 * Safety rules:
 * 1. Do not assert negatives (e.g., "no allergies", "not examined")
 * 2. Do not introduce diagnoses not explicitly made
 * 3. Do not over-specify medication regimens beyond verbal agreement
 * 4. Assessment should be problem-based unless diagnosis was explicitly stated
 * 5. Intervention includes only immediate actions taken/agreed
 * 6. Plan includes follow-up, safety-netting, and ongoing management
 */

/**
 * Filter out negative assertions and "not mentioned" patterns
 * This helps maintain clinical safety by not asserting things that weren't examined
 */
function filterNegativeAssertions(text: string): string {
  if (!text) return '';
  
  const lines = text.split('\n');
  const filteredLines = lines.filter(line => {
    const trimmedLine = line.trim().toLowerCase();
    
    // Skip lines that assert negatives
    const negativePatterns = [
      /^no\s+(?:known\s+)?allergies/i,
      /^nil\s+/i,
      /^none\s+(?:known|mentioned|documented|recorded|identified)/i,
      /^not\s+(?:examined|assessed|tested|checked|done)/i,
      /^no\s+(?:examination|assessment|investigation)\s+(?:performed|done)/i,
      /n\/a/i,
      /not\s+applicable/i,
      /not\s+recorded/i,
      /not\s+documented/i,
    ];
    
    return !negativePatterns.some(pattern => pattern.test(trimmedLine));
  });
  
  return filteredLines.join('\n').trim();
}

/**
 * Clean up text by removing markdown artifacts and extra whitespace
 */
function cleanText(text: string): string {
  if (!text) return '';
  
  return text
    .replace(/\*\*/g, '')  // Remove bold markers
    .replace(/\*/g, '')    // Remove italic markers
    .replace(/#+\s*/g, '') // Remove heading markers
    .replace(/\n{3,}/g, '\n\n') // Normalize multiple newlines
    .trim();
}

/**
 * Split plan content into intervention (immediate) and plan (future) items
 */
function splitPlanContent(planText: string): { intervention: string; plan: string } {
  if (!planText) return { intervention: '', plan: '' };
  
  const lines = planText.split('\n').map(l => l.trim()).filter(l => l);
  const interventionItems: string[] = [];
  const planItems: string[] = [];
  
  for (const line of lines) {
    const isIntervention = INTERVENTION_PATTERNS.some(pattern => pattern.test(line));
    const isPlanItem = PLAN_PATTERNS.some(pattern => pattern.test(line));
    
    if (isIntervention && !isPlanItem) {
      interventionItems.push(line);
    } else if (isPlanItem) {
      planItems.push(line);
    } else {
      // Default: if it sounds past tense or completed, it's intervention
      // Otherwise, it's plan
      const pastTenseIndicators = /\b(was|were|has been|have been|did|took|gave|made|sent)\b/i;
      if (pastTenseIndicators.test(line)) {
        interventionItems.push(line);
      } else {
        planItems.push(line);
      }
    }
  }
  
  return {
    intervention: interventionItems.join('\n'),
    plan: planItems.join('\n')
  };
}

/**
 * Transform SOAP or Heidi notes into Narrative Clinical layout
 * This is a PRESENTATIONAL transformation only - no AI calls, no clinical inference changes
 */
export function transformToNarrativeClinical(
  soapNote: SOAPNote | null,
  heidiNote?: HeidiNote | null
): NarrativeClinicalNote {
  // If we have Heidi format, prefer it as it has more structured sections
  if (heidiNote) {
    const planContent = cleanText(filterNegativeAssertions(heidiNote.plan || ''));
    const { intervention, plan } = splitPlanContent(planContent);
    
    return {
      history: cleanText(filterNegativeAssertions(heidiNote.history || '')),
      examination: cleanText(filterNegativeAssertions(heidiNote.examination || '')),
      assessment: cleanText(filterNegativeAssertions(heidiNote.impression || '')),
      intervention: intervention,
      plan: plan || planContent, // Fallback to full plan if no split occurred
    };
  }
  
  // Transform from SOAP format
  if (soapNote) {
    const planContent = cleanText(filterNegativeAssertions(soapNote.P || ''));
    const { intervention, plan } = splitPlanContent(planContent);
    
    return {
      history: cleanText(filterNegativeAssertions(soapNote.S || '')),
      examination: cleanText(filterNegativeAssertions(soapNote.O || '')),
      assessment: cleanText(filterNegativeAssertions(soapNote.A || '')),
      intervention: intervention,
      plan: plan || planContent, // Fallback to full plan if no split occurred
    };
  }
  
  // Return empty structure if no notes provided
  return {
    history: '',
    examination: '',
    assessment: '',
    intervention: '',
    plan: ''
  };
}

/**
 * Get formatted text for the entire Narrative Clinical note (for copy functionality)
 */
export function getNarrativeClinicalText(note: NarrativeClinicalNote): string {
  const sections: string[] = [];
  
  if (note.history) {
    sections.push(`HISTORY\n${note.history}`);
  }
  if (note.examination) {
    sections.push(`EXAMINATION\n${note.examination}`);
  }
  if (note.assessment) {
    sections.push(`ASSESSMENT\n${note.assessment}`);
  }
  if (note.intervention) {
    sections.push(`INTERVENTION\n${note.intervention}`);
  }
  if (note.plan) {
    sections.push(`PLAN\n${note.plan}`);
  }
  
  return sections.join('\n\n');
}

/**
 * Section configuration for the Narrative Clinical layout
 */
export const NARRATIVE_CLINICAL_SECTIONS = [
  { 
    key: 'history' as const, 
    title: 'History', 
    description: 'Patient history and presenting complaint',
    colorClass: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
    borderClass: 'border-blue-200 dark:border-blue-800'
  },
  { 
    key: 'examination' as const, 
    title: 'Examination', 
    description: 'Clinical examination findings',
    colorClass: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
    borderClass: 'border-green-200 dark:border-green-800'
  },
  { 
    key: 'assessment' as const, 
    title: 'Assessment', 
    description: 'Problems discussed (not diagnoses unless explicit)',
    colorClass: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
    borderClass: 'border-amber-200 dark:border-amber-800'
  },
  { 
    key: 'intervention' as const, 
    title: 'Intervention', 
    description: 'Immediate actions taken or agreed',
    colorClass: 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400',
    borderClass: 'border-rose-200 dark:border-rose-800'
  },
  { 
    key: 'plan' as const, 
    title: 'Plan', 
    description: 'Follow-up, safety-netting, ongoing management',
    colorClass: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
    borderClass: 'border-purple-200 dark:border-purple-800'
  },
] as const;
