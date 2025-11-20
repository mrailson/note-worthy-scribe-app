export interface CorrectionRule {
  id: string;
  find: string;
  replace: string;
  type: 'name' | 'place' | 'acronym' | 'details' | 'assignee' | 'other';
  caseInsensitive: boolean;
  wordBoundary: boolean;
  timestamp: string;
}

interface CoachInsight {
  realTime: {
    recentSummary: string[];
    suggestedQuestion: string;
  };
  overview: {
    mainTopics: string[];
    decisions: string[];
    actionItems: string[];
    keyPoints: string[];
  };
  wrapUp: {
    unansweredQuestions: string[];
    unresolvedIssues: string[];
    needsClarification: string[];
    suggestedFinalQuestions: string[];
    completenessScore: number;
  };
  timestamp: string;
  id: number;
}

const STORAGE_KEY_PREFIX = 'meetingCoach-corrections-';

export function applyCorrections(text: string, rules: CorrectionRule[]): string {
  if (!text || rules.length === 0) return text;
  
  let result = text;
  
  // Sort by longest find string first to avoid partial replacements
  const sortedRules = [...rules].sort((a, b) => b.find.length - a.find.length);
  
  for (const rule of sortedRules) {
    try {
      const flags = rule.caseInsensitive ? 'gi' : 'g';
      const pattern = rule.wordBoundary 
        ? `\\b${escapeRegex(rule.find)}\\b`
        : escapeRegex(rule.find);
      
      const regex = new RegExp(pattern, flags);
      result = result.replace(regex, rule.replace);
    } catch (error) {
      console.error('Error applying correction rule:', rule, error);
    }
  }
  
  return result;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function applyCorrectionsToInsight(
  insight: CoachInsight, 
  rules: CorrectionRule[]
): CoachInsight {
  if (!insight || rules.length === 0) return insight;
  
  return {
    ...insight,
    realTime: {
      recentSummary: insight.realTime.recentSummary.map(item => applyCorrections(item, rules)),
      suggestedQuestion: applyCorrections(insight.realTime.suggestedQuestion, rules)
    },
    overview: {
      mainTopics: insight.overview.mainTopics.map(item => applyCorrections(item, rules)),
      decisions: insight.overview.decisions.map(item => applyCorrections(item, rules)),
      actionItems: insight.overview.actionItems.map(item => applyCorrections(item, rules)),
      keyPoints: insight.overview.keyPoints.map(item => applyCorrections(item, rules))
    },
    wrapUp: {
      ...insight.wrapUp,
      unansweredQuestions: insight.wrapUp.unansweredQuestions.map(item => applyCorrections(item, rules)),
      unresolvedIssues: insight.wrapUp.unresolvedIssues.map(item => applyCorrections(item, rules)),
      needsClarification: insight.wrapUp.needsClarification.map(item => applyCorrections(item, rules)),
      suggestedFinalQuestions: insight.wrapUp.suggestedFinalQuestions.map(item => applyCorrections(item, rules))
    }
  };
}

export function loadCorrections(meetingId: string): CorrectionRule[] {
  if (!meetingId || meetingId === 'temp') return [];
  
  try {
    const stored = sessionStorage.getItem(`${STORAGE_KEY_PREFIX}${meetingId}`);
    if (!stored) return [];
    
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Error loading corrections:', error);
    return [];
  }
}

export function saveCorrections(meetingId: string, rules: CorrectionRule[]): void {
  if (!meetingId || meetingId === 'temp') {
    console.warn('Cannot save corrections: invalid meeting ID');
    return;
  }
  
  try {
    sessionStorage.setItem(`${STORAGE_KEY_PREFIX}${meetingId}`, JSON.stringify(rules));
  } catch (error) {
    console.error('Error saving corrections:', error);
  }
}

export function addCorrection(meetingId: string, rule: CorrectionRule): CorrectionRule[] {
  const existing = loadCorrections(meetingId);
  const updated = [...existing, rule];
  saveCorrections(meetingId, updated);
  return updated;
}

export function removeCorrection(meetingId: string, ruleId: string): CorrectionRule[] {
  const existing = loadCorrections(meetingId);
  const updated = existing.filter(rule => rule.id !== ruleId);
  saveCorrections(meetingId, updated);
  return updated;
}

export function countMatches(text: string, rule: CorrectionRule): number {
  if (!text) return 0;
  
  try {
    const flags = rule.caseInsensitive ? 'gi' : 'g';
    const pattern = rule.wordBoundary 
      ? `\\b${escapeRegex(rule.find)}\\b`
      : escapeRegex(rule.find);
    
    const regex = new RegExp(pattern, flags);
    const matches = text.match(regex);
    return matches ? matches.length : 0;
  } catch (error) {
    return 0;
  }
}
