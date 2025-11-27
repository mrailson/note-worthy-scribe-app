export interface PronunciationRule {
  id: string;
  original: string;
  pronounceAs: string;
  category: 'name' | 'place' | 'organisation' | 'medical' | 'acronym' | 'other';
  caseInsensitive: boolean;
  createdAt: string;
}

const STORAGE_KEY = 'audio-pronunciation-library';

export function loadPronunciationLibrary(): PronunciationRule[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Failed to load pronunciation library:', error);
    return [];
  }
}

export function savePronunciationLibrary(rules: PronunciationRule[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
  } catch (error) {
    console.error('Failed to save pronunciation library:', error);
  }
}

export function addPronunciationRule(
  rule: Omit<PronunciationRule, 'id' | 'createdAt'>
): PronunciationRule[] {
  const newRule: PronunciationRule = {
    ...rule,
    id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    createdAt: new Date().toISOString(),
  };
  
  const rules = loadPronunciationLibrary();
  const updatedRules = [...rules, newRule];
  savePronunciationLibrary(updatedRules);
  return updatedRules;
}

export function removePronunciationRule(id: string): PronunciationRule[] {
  const rules = loadPronunciationLibrary();
  const updatedRules = rules.filter(rule => rule.id !== id);
  savePronunciationLibrary(updatedRules);
  return updatedRules;
}

export function applyPronunciations(text: string, rules: PronunciationRule[]): string {
  let result = text;
  
  for (const rule of rules) {
    const flags = rule.caseInsensitive ? 'gi' : 'g';
    const regex = new RegExp(escapeRegex(rule.original), flags);
    result = result.replace(regex, rule.pronounceAs);
  }
  
  return result;
}

export function countPronunciationMatches(text: string, rule: PronunciationRule): number {
  const flags = rule.caseInsensitive ? 'gi' : 'g';
  const regex = new RegExp(escapeRegex(rule.original), flags);
  const matches = text.match(regex);
  return matches ? matches.length : 0;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
