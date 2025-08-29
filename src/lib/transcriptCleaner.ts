export type CleanRule = {
  id: string;
  find: string;
  replace: string;
  isRegex?: boolean;          // default false
  caseInsensitive?: boolean;  // default true
  wordBoundary?: boolean;     // default true
  enabled?: boolean;          // default true
};

export type CleanResult = {
  original: string;
  cleaned: string;
  appliedRuleIds: string[];
};

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function buildReg(rule: CleanRule): RegExp {
  const flags = rule.caseInsensitive === false ? "g" : "gi";
  if (rule.isRegex) return new RegExp(rule.find, flags);
  const base = escapeRegex(rule.find);
  const pattern = rule.wordBoundary === false ? base : `\\b${base}\\b`;
  return new RegExp(pattern, flags);
}

function sortRules(rules: CleanRule[]): CleanRule[] {
  return [...rules].sort((a, b) => b.find.length - a.find.length);
}

export function cleanTranscript(text: string, rules: CleanRule[]): CleanResult {
  let cleaned = text ?? "";
  const applied: string[] = [];
  for (const r of sortRules(rules.filter(rr => rr.enabled !== false))) {
    const before = cleaned;
    cleaned = cleaned.replace(buildReg(r), r.replace);
    if (cleaned !== before) applied.push(r.id);
  }
  return { original: text ?? "", cleaned, appliedRuleIds: applied };
}

export function cleanTranscripts(transcripts: string[], rules: CleanRule[]): CleanResult[] {
  return transcripts.map(t => cleanTranscript(t ?? "", rules));
}

const KEY = "nhs-cleaner-rules-v1";
export function loadRules(): CleanRule[] {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}
export function saveRules(rules: CleanRule[]) {
  localStorage.setItem(KEY, JSON.stringify(rules));
}