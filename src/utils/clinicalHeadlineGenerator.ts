import { ScribeSession, SOAPNote, HeidiNote } from "@/types/scribe";

export type ClinicalSignal = 'medication' | 'mentalHealth' | 'safetyNet' | 'followUp' | 'letter';
export type SessionStatus = 'reviewed' | 'followUpDue' | 'actionPending' | 'draft';

export interface ClinicalHeadlineData {
  headline: string;
  signals: ClinicalSignal[];
  status: SessionStatus;
  followUpDate?: string;
}

// Pattern detection for clinical signals (safe, non-diagnostic)
const SIGNAL_PATTERNS: Record<ClinicalSignal, RegExp[]> = {
  medication: [
    /\b(prescribed|issued|started|stopped|changed|switched|titrat|increas|decreas|dosage|medication|mg\b|mcg\b|tablet|capsule|inhaler)\b/i,
    /\b(rx|script|repeat|prescription)\b/i,
  ],
  mentalHealth: [
    /\b(anxiety|depression|mental\s*health|mood|stress|self[- ]?harm|suicid|phq|gad|wellbeing|counselling|therapy|psycholog)\b/i,
    /\b(low\s*mood|panic|worry|sleep\s*problems|insomnia)\b/i,
  ],
  safetyNet: [
    /\b(safety[- ]?net|return\s*if|red\s*flag|seek\s*help|a&e|emergency|call\s*999|call\s*111|worsening)\b/i,
    /\b(s\/n|safety\s*advice|warning\s*signs)\b/i,
  ],
  followUp: [
    /\b(follow[- ]?up|review|f\/u|check\s*in|book|appointment|come\s*back|see\s*again|weeks?|months?)\b/i,
    /\b(reassess|re-?assess|monitor|chase)\b/i,
  ],
  letter: [
    /\b(referr|letter|2ww|two\s*week|urgent\s*referral|routine\s*referral|specialist|consultant|hospital)\b/i,
    /\b(fit\s*note|sick\s*note|med3|med\s*3)\b/i,
  ],
};

/**
 * Detect clinical signals from session content
 * These are non-diagnostic, workflow indicators only
 */
export function detectClinicalSignals(session: ScribeSession): ClinicalSignal[] {
  const signals: ClinicalSignal[] = [];
  
  // Combine relevant text sources for pattern matching
  const textSources: string[] = [];
  
  if (session.soapNote) {
    textSources.push(session.soapNote.A, session.soapNote.P);
  }
  
  if (session.heidiNote) {
    textSources.push(session.heidiNote.impression, session.heidiNote.plan);
  }
  
  if (session.quickSummary) {
    textSources.push(session.quickSummary);
  }
  
  const combinedText = textSources.join(' ');
  
  // Check each signal pattern
  for (const [signal, patterns] of Object.entries(SIGNAL_PATTERNS) as [ClinicalSignal, RegExp[]][]) {
    for (const pattern of patterns) {
      if (pattern.test(combinedText)) {
        signals.push(signal);
        break; // Only add each signal once
      }
    }
  }
  
  return signals;
}

/**
 * Generate a clinical headline from session data
 * Max ~80 chars, focused on Problems + Plan intent
 * Does NOT summarise free text HPC
 */
export function generateClinicalHeadline(session: ScribeSession): string {
  // If there's a custom headline, use that
  if (session.customHeadline) {
    return session.customHeadline;
  }
  
  // Try to extract from structured sections
  let problems: string[] = [];
  let planAction = '';
  
  if (session.heidiNote) {
    // Heidi format: use impression (problems discussed)
    problems = extractProblemsFromText(session.heidiNote.impression);
    planAction = extractPlanAction(session.heidiNote.plan);
  } else if (session.soapNote) {
    // SOAP format: use Assessment
    problems = extractProblemsFromText(session.soapNote.A);
    planAction = extractPlanAction(session.soapNote.P);
  }
  
  // If we have quickSummary (already generated), extract key info
  if (problems.length === 0 && session.quickSummary) {
    // Use quickSummary directly but truncate
    const truncated = session.quickSummary.substring(0, 80);
    return truncated.length < session.quickSummary.length 
      ? truncated.replace(/\s+\S*$/, '…') 
      : truncated;
  }
  
  // Build headline from problems and plan action
  if (problems.length > 0) {
    const problemPart = problems.slice(0, 2).join(' & ');
    if (planAction) {
      const combined = `${problemPart} – ${planAction}`;
      if (combined.length <= 80) {
        return combined;
      }
      // Truncate if too long
      return combined.substring(0, 77) + '…';
    }
    return problemPart.length <= 80 ? problemPart : problemPart.substring(0, 77) + '…';
  }
  
  // Fallback to title
  return session.title || 'Consultation';
}

/**
 * Extract problem keywords from assessment/impression text
 */
function extractProblemsFromText(text: string): string[] {
  if (!text) return [];
  
  const problems: string[] = [];
  
  // Look for numbered items (1. Problem, 2. Problem)
  const numberedMatches = text.match(/\d+\.\s*([^.\n]+)/g);
  if (numberedMatches) {
    for (const match of numberedMatches.slice(0, 2)) {
      const problem = match.replace(/^\d+\.\s*/, '').trim();
      if (problem.length > 3 && problem.length < 40) {
        problems.push(problem);
      }
    }
  }
  
  // Look for bullet points
  if (problems.length === 0) {
    const bulletMatches = text.match(/[-•]\s*([^.\n]+)/g);
    if (bulletMatches) {
      for (const match of bulletMatches.slice(0, 2)) {
        const problem = match.replace(/^[-•]\s*/, '').trim();
        if (problem.length > 3 && problem.length < 40) {
          problems.push(problem);
        }
      }
    }
  }
  
  return problems;
}

/**
 * Extract key plan action (medication change, referral, etc.)
 */
function extractPlanAction(planText: string): string {
  if (!planText) return '';
  
  // Look for medication changes
  const medChange = planText.match(/(?:start|switch|change|increase|decrease|stop)\w*\s+(?:to\s+)?(\w+(?:\s+\d+\s*(?:mg|mcg))?)/i);
  if (medChange) {
    return medChange[0].trim();
  }
  
  // Look for referrals
  const referral = planText.match(/refer(?:ral|red)?\s+(?:to\s+)?([^.,\n]+)/i);
  if (referral) {
    const ref = referral[1].trim();
    if (ref.length < 25) return `→ ${ref}`;
  }
  
  // Look for follow-up
  const followUp = planText.match(/(?:review|follow[- ]?up|f\/u)\s+(?:in\s+)?(\d+\s*(?:week|month|day)s?)/i);
  if (followUp) {
    return `review ${followUp[1]}`;
  }
  
  return '';
}

/**
 * Determine session status based on workflow state
 */
export function determineSessionStatus(session: ScribeSession): SessionStatus {
  // Draft if still recording or incomplete
  if (session.status === 'recording') {
    return 'draft';
  }
  
  // If explicitly marked as reviewed
  if (session.isReviewed) {
    return 'reviewed';
  }
  
  // Check for follow-up date approaching
  if (session.followUpDate) {
    const followUpDate = new Date(session.followUpDate);
    const now = new Date();
    if (followUpDate <= now) {
      return 'followUpDue';
    }
  }
  
  // Check if signals suggest action needed
  const signals = detectClinicalSignals(session);
  if (signals.includes('followUp')) {
    return 'followUpDue';
  }
  
  // If completed but not marked as reviewed
  if (session.status === 'completed' && !session.isCopied) {
    return 'actionPending';
  }
  
  return 'reviewed';
}

/**
 * Extract follow-up date from plan text if present
 */
export function extractFollowUpDate(session: ScribeSession): string | undefined {
  const planText = session.heidiNote?.plan || session.soapNote?.P || '';
  
  // Look for specific date patterns
  const dateMatch = planText.match(/(?:review|follow[- ]?up|f\/u|appointment)\s*(?:on|:)?\s*(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})/i);
  if (dateMatch) {
    return dateMatch[1];
  }
  
  // Look for relative dates (e.g., "review in 2 weeks")
  const relativeMatch = planText.match(/(?:review|follow[- ]?up|f\/u)\s+(?:in\s+)?(\d+)\s*(week|month|day)s?/i);
  if (relativeMatch) {
    const amount = parseInt(relativeMatch[1], 10);
    const unit = relativeMatch[2].toLowerCase();
    const date = new Date(session.createdAt);
    
    if (unit.startsWith('day')) {
      date.setDate(date.getDate() + amount);
    } else if (unit.startsWith('week')) {
      date.setDate(date.getDate() + amount * 7);
    } else if (unit.startsWith('month')) {
      date.setMonth(date.getMonth() + amount);
    }
    
    return date.toISOString().split('T')[0];
  }
  
  return undefined;
}

/**
 * Get word count category for display
 */
export function getWordCountCategory(wordCount: number): 'brief' | 'standard' | 'detailed' {
  if (wordCount < 300) return 'brief';
  if (wordCount <= 800) return 'standard';
  return 'detailed';
}

/**
 * Generate all clinical headline data for a session
 */
export function getClinicalHeadlineData(session: ScribeSession): ClinicalHeadlineData {
  return {
    headline: generateClinicalHeadline(session),
    signals: detectClinicalSignals(session),
    status: determineSessionStatus(session),
    followUpDate: session.followUpDate || extractFollowUpDate(session),
  };
}
