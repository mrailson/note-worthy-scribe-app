export interface PronunciationRule {
  id: string;
  original: string;
  pronounceAs: string;
  category: 'name' | 'place' | 'organisation' | 'medical' | 'acronym' | 'other';
  caseInsensitive: boolean;
  createdAt: string;
  isSystem?: boolean;
}

// ── Built-in NHS primary care pronunciation rules ──
// These cannot be deleted by users but can be overridden by adding a user rule with the same original text.

export const SYSTEM_PRONUNCIATION_RULES: PronunciationRule[] = [
  // NHS Organisations & Programmes
  { id: 'sys-pcn', original: 'PCN', pronounceAs: 'P.C.N.', category: 'acronym', caseInsensitive: false, createdAt: '', isSystem: true },
  { id: 'sys-pcns', original: 'PCNs', pronounceAs: 'P.C.N.s', category: 'acronym', caseInsensitive: false, createdAt: '', isSystem: true },
  { id: 'sys-icb', original: 'ICB', pronounceAs: 'I.C.B.', category: 'acronym', caseInsensitive: false, createdAt: '', isSystem: true },
  { id: 'sys-icbs', original: 'ICBs', pronounceAs: 'I.C.B.s', category: 'acronym', caseInsensitive: false, createdAt: '', isSystem: true },
  { id: 'sys-ics', original: 'ICS', pronounceAs: 'I.C.S.', category: 'acronym', caseInsensitive: false, createdAt: '', isSystem: true },
  { id: 'sys-nhs', original: 'NHS', pronounceAs: 'N.H.S.', category: 'acronym', caseInsensitive: false, createdAt: '', isSystem: true },
  { id: 'sys-cqc', original: 'CQC', pronounceAs: 'C.Q.C.', category: 'acronym', caseInsensitive: false, createdAt: '', isSystem: true },
  { id: 'sys-nhse', original: 'NHSE', pronounceAs: 'N.H.S. England', category: 'acronym', caseInsensitive: false, createdAt: '', isSystem: true },
  { id: 'sys-nres', original: 'NRES', pronounceAs: 'N.R.E.S.', category: 'acronym', caseInsensitive: false, createdAt: '', isSystem: true },
  { id: 'sys-gpa', original: 'GPA', pronounceAs: 'G.P.A.', category: 'acronym', caseInsensitive: false, createdAt: '', isSystem: true },
  { id: 'sys-pml', original: 'PML', pronounceAs: 'P.M.L.', category: 'acronym', caseInsensitive: false, createdAt: '', isSystem: true },
  { id: 'sys-sno', original: 'SNO', pronounceAs: 'S.N.O.', category: 'acronym', caseInsensitive: false, createdAt: '', isSystem: true },
  { id: 'sys-mou', original: 'MOU', pronounceAs: 'M.O.U.', category: 'acronym', caseInsensitive: false, createdAt: '', isSystem: true },

  // Contracts & Frameworks
  { id: 'sys-pcndes', original: 'PCN DES', pronounceAs: 'P.C.N. Dess', category: 'acronym', caseInsensitive: false, createdAt: '', isSystem: true },
  { id: 'sys-des', original: 'DES', pronounceAs: 'Dess', category: 'acronym', caseInsensitive: false, createdAt: '', isSystem: true },
  { id: 'sys-gms', original: 'GMS', pronounceAs: 'G.M.S.', category: 'acronym', caseInsensitive: false, createdAt: '', isSystem: true },
  { id: 'sys-pms', original: 'PMS', pronounceAs: 'P.M.S.', category: 'acronym', caseInsensitive: false, createdAt: '', isSystem: true },
  { id: 'sys-apms', original: 'APMS', pronounceAs: 'A.P.M.S.', category: 'acronym', caseInsensitive: false, createdAt: '', isSystem: true },
  { id: 'sys-qof', original: 'QOF', pronounceAs: 'Kwoff', category: 'acronym', caseInsensitive: false, createdAt: '', isSystem: true },
  { id: 'sys-qof2', original: 'QoF', pronounceAs: 'Kwoff', category: 'acronym', caseInsensitive: false, createdAt: '', isSystem: true },
  { id: 'sys-iif', original: 'IIF', pronounceAs: 'I.I.F.', category: 'acronym', caseInsensitive: false, createdAt: '', isSystem: true },
  { id: 'sys-sda', original: 'SDA', pronounceAs: 'S.D.A.', category: 'acronym', caseInsensitive: false, createdAt: '', isSystem: true },
  { id: 'sys-snc', original: 'SNC', pronounceAs: 'S.N.C.', category: 'acronym', caseInsensitive: false, createdAt: '', isSystem: true },
  { id: 'sys-mnp', original: 'MNP', pronounceAs: 'M.N.P.', category: 'acronym', caseInsensitive: false, createdAt: '', isSystem: true },

  // Workforce & Roles
  { id: 'sys-arrs', original: 'ARRS', pronounceAs: 'Ars', category: 'acronym', caseInsensitive: false, createdAt: '', isSystem: true },
  { id: 'sys-splw', original: 'SPLW', pronounceAs: 'S.P.L.W.', category: 'acronym', caseInsensitive: false, createdAt: '', isSystem: true },
  { id: 'sys-anp', original: 'ANP', pronounceAs: 'A.N.P.', category: 'acronym', caseInsensitive: false, createdAt: '', isSystem: true },
  { id: 'sys-acp', original: 'ACP', pronounceAs: 'A.C.P.', category: 'acronym', caseInsensitive: false, createdAt: '', isSystem: true },
  { id: 'sys-hca', original: 'HCA', pronounceAs: 'H.C.A.', category: 'acronym', caseInsensitive: false, createdAt: '', isSystem: true },
  { id: 'sys-gp', original: 'GP', pronounceAs: 'G.P.', category: 'acronym', caseInsensitive: false, createdAt: '', isSystem: true },
  { id: 'sys-gps', original: 'GPs', pronounceAs: 'G.P.s', category: 'acronym', caseInsensitive: false, createdAt: '', isSystem: true },
  { id: 'sys-cd', original: 'CD', pronounceAs: 'Clinical Director', category: 'acronym', caseInsensitive: false, createdAt: '', isSystem: true },
  { id: 'sys-cpd', original: 'CPD', pronounceAs: 'C.P.D.', category: 'acronym', caseInsensitive: false, createdAt: '', isSystem: true },
  { id: 'sys-mdt', original: 'MDT', pronounceAs: 'M.D.T.', category: 'acronym', caseInsensitive: false, createdAt: '', isSystem: true },

  // Clinical & Governance
  { id: 'sys-nice', original: 'NICE', pronounceAs: 'Nice', category: 'acronym', caseInsensitive: false, createdAt: '', isSystem: true },
  { id: 'sys-bnf', original: 'BNF', pronounceAs: 'B.N.F.', category: 'acronym', caseInsensitive: false, createdAt: '', isSystem: true },
  { id: 'sys-soap', original: 'SOAP', pronounceAs: 'Soap', category: 'acronym', caseInsensitive: false, createdAt: '', isSystem: true },
  { id: 'sys-cga', original: 'CGA', pronounceAs: 'C.G.A.', category: 'acronym', caseInsensitive: false, createdAt: '', isSystem: true },
  { id: 'sys-dpia', original: 'DPIA', pronounceAs: 'D.P.I.A.', category: 'acronym', caseInsensitive: false, createdAt: '', isSystem: true },
  { id: 'sys-dspt', original: 'DSPT', pronounceAs: 'D.S.P.T.', category: 'acronym', caseInsensitive: false, createdAt: '', isSystem: true },
  { id: 'sys-dtac', original: 'DTAC', pronounceAs: 'D.Tack', category: 'acronym', caseInsensitive: false, createdAt: '', isSystem: true },
  { id: 'sys-dcb0129', original: 'DCB0129', pronounceAs: 'D.C.B. zero one two nine', category: 'acronym', caseInsensitive: false, createdAt: '', isSystem: true },
  { id: 'sys-dcb0160', original: 'DCB0160', pronounceAs: 'D.C.B. zero one six zero', category: 'acronym', caseInsensitive: false, createdAt: '', isSystem: true },
  { id: 'sys-rag', original: 'RAG', pronounceAs: 'Rag', category: 'acronym', caseInsensitive: false, createdAt: '', isSystem: true },
  { id: 'sys-kpi', original: 'KPI', pronounceAs: 'K.P.I.', category: 'acronym', caseInsensitive: false, createdAt: '', isSystem: true },
  { id: 'sys-kpis', original: 'KPIs', pronounceAs: 'K.P.I.s', category: 'acronym', caseInsensitive: false, createdAt: '', isSystem: true },
  { id: 'sys-sop', original: 'SOP', pronounceAs: 'S.O.P.', category: 'acronym', caseInsensitive: false, createdAt: '', isSystem: true },
  { id: 'sys-sops', original: 'SOPs', pronounceAs: 'S.O.P.s', category: 'acronym', caseInsensitive: false, createdAt: '', isSystem: true },

  // Clinical Terms
  { id: 'sys-copd', original: 'COPD', pronounceAs: 'C.O.P.D.', category: 'medical', caseInsensitive: false, createdAt: '', isSystem: true },
  { id: 'sys-ckd', original: 'CKD', pronounceAs: 'C.K.D.', category: 'medical', caseInsensitive: false, createdAt: '', isSystem: true },
  { id: 'sys-cvd', original: 'CVD', pronounceAs: 'C.V.D.', category: 'medical', caseInsensitive: false, createdAt: '', isSystem: true },
  { id: 'sys-af', original: 'AF', pronounceAs: 'A.F.', category: 'medical', caseInsensitive: false, createdAt: '', isSystem: true },
  { id: 'sys-hba1c', original: 'HbA1c', pronounceAs: 'H.B.A. one C', category: 'medical', caseInsensitive: true, createdAt: '', isSystem: true },
  { id: 'sys-egfr', original: 'eGFR', pronounceAs: 'E.G.F.R.', category: 'medical', caseInsensitive: true, createdAt: '', isSystem: true },
  { id: 'sys-bmi', original: 'BMI', pronounceAs: 'B.M.I.', category: 'medical', caseInsensitive: false, createdAt: '', isSystem: true },
  { id: 'sys-ecg', original: 'ECG', pronounceAs: 'E.C.G.', category: 'medical', caseInsensitive: false, createdAt: '', isSystem: true },
  { id: 'sys-bp', original: 'BP', pronounceAs: 'blood pressure', category: 'medical', caseInsensitive: false, createdAt: '', isSystem: true },
  { id: 'sys-ld', original: 'LD', pronounceAs: 'L.D.', category: 'medical', caseInsensitive: false, createdAt: '', isSystem: true },
  { id: 'sys-smi', original: 'SMI', pronounceAs: 'S.M.I.', category: 'medical', caseInsensitive: false, createdAt: '', isSystem: true },
  { id: 'sys-adhd', original: 'ADHD', pronounceAs: 'A.D.H.D.', category: 'medical', caseInsensitive: false, createdAt: '', isSystem: true },
  { id: 'sys-asd', original: 'ASD', pronounceAs: 'A.S.D.', category: 'medical', caseInsensitive: false, createdAt: '', isSystem: true },

  // IT & Digital
  { id: 'sys-emis', original: 'EMIS', pronounceAs: 'Ee-miss', category: 'organisation', caseInsensitive: false, createdAt: '', isSystem: true },
  { id: 'sys-systmone', original: 'SystmOne', pronounceAs: 'System One', category: 'organisation', caseInsensitive: true, createdAt: '', isSystem: true },
  { id: 'sys-accurx', original: 'AccuRx', pronounceAs: 'Accu R.X.', category: 'organisation', caseInsensitive: true, createdAt: '', isSystem: true },
  { id: 'sys-econsult', original: 'eConsult', pronounceAs: 'ee-Consult', category: 'organisation', caseInsensitive: true, createdAt: '', isSystem: true },
  { id: 'sys-ddat', original: 'DDaT', pronounceAs: 'D. Dat', category: 'acronym', caseInsensitive: false, createdAt: '', isSystem: true },
  { id: 'sys-ai', original: 'AI', pronounceAs: 'A.I.', category: 'acronym', caseInsensitive: false, createdAt: '', isSystem: true },
  { id: 'sys-mhra', original: 'MHRA', pronounceAs: 'M.H.R.A.', category: 'acronym', caseInsensitive: false, createdAt: '', isSystem: true },

  // Common Meeting Terms
  { id: 'sys-aob', original: 'AOB', pronounceAs: 'A.O.B.', category: 'acronym', caseInsensitive: false, createdAt: '', isSystem: true },
  { id: 'sys-tbc', original: 'TBC', pronounceAs: 'T.B.C.', category: 'acronym', caseInsensitive: false, createdAt: '', isSystem: true },
  { id: 'sys-f2f', original: 'F2F', pronounceAs: 'face to face', category: 'other', caseInsensitive: true, createdAt: '', isSystem: true },
  { id: 'sys-bau', original: 'BAU', pronounceAs: 'B.A.U.', category: 'acronym', caseInsensitive: false, createdAt: '', isSystem: true },
  { id: 'sys-fte', original: 'FTE', pronounceAs: 'F.T.E.', category: 'acronym', caseInsensitive: false, createdAt: '', isSystem: true },
  { id: 'sys-wte', original: 'WTE', pronounceAs: 'whole time equivalent', category: 'acronym', caseInsensitive: false, createdAt: '', isSystem: true },
  { id: 'sys-ytd', original: 'YTD', pronounceAs: 'year to date', category: 'acronym', caseInsensitive: false, createdAt: '', isSystem: true },
  { id: 'sys-vs', original: 'vs', pronounceAs: 'versus', category: 'other', caseInsensitive: true, createdAt: '', isSystem: true },
  { id: 'sys-approx', original: 'approx', pronounceAs: 'approximately', category: 'other', caseInsensitive: true, createdAt: '', isSystem: true },
  { id: 'sys-approxdot', original: 'approx.', pronounceAs: 'approximately', category: 'other', caseInsensitive: true, createdAt: '', isSystem: true },
  { id: 'sys-eg', original: 'e.g.', pronounceAs: 'for example', category: 'other', caseInsensitive: true, createdAt: '', isSystem: true },
  { id: 'sys-ie', original: 'i.e.', pronounceAs: 'that is', category: 'other', caseInsensitive: true, createdAt: '', isSystem: true },
  { id: 'sys-etc', original: 'etc.', pronounceAs: 'etcetera', category: 'other', caseInsensitive: true, createdAt: '', isSystem: true },
  { id: 'sys-q1', original: 'Q1', pronounceAs: 'quarter one', category: 'other', caseInsensitive: false, createdAt: '', isSystem: true },
  { id: 'sys-q2', original: 'Q2', pronounceAs: 'quarter two', category: 'other', caseInsensitive: false, createdAt: '', isSystem: true },
  { id: 'sys-q3', original: 'Q3', pronounceAs: 'quarter three', category: 'other', caseInsensitive: false, createdAt: '', isSystem: true },
  { id: 'sys-q4', original: 'Q4', pronounceAs: 'quarter four', category: 'other', caseInsensitive: false, createdAt: '', isSystem: true },

  // Local terms (Northamptonshire)
  { id: 'sys-towcester', original: 'Towcester', pronounceAs: 'Toaster', category: 'place', caseInsensitive: true, createdAt: '', isSystem: true },
  { id: 'sys-bugbrooke', original: 'Bugbrooke', pronounceAs: 'Bug-brook', category: 'place', caseInsensitive: true, createdAt: '', isSystem: true },
  { id: 'sys-guilsborough', original: 'Guilsborough', pronounceAs: 'Gilsborough', category: 'place', caseInsensitive: true, createdAt: '', isSystem: true },
];

const STORAGE_KEY = 'audio-pronunciation-library';

export function loadPronunciationLibrary(): PronunciationRule[] {
  // Start with system rules
  const allRules = [...SYSTEM_PRONUNCIATION_RULES];

  // Load user rules from localStorage
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const userRules: PronunciationRule[] = stored ? JSON.parse(stored) : [];

    // User rules override system rules if the same 'original' key exists
    for (const userRule of userRules) {
      const existingIdx = allRules.findIndex(r => r.original.toLowerCase() === userRule.original.toLowerCase());
      if (existingIdx >= 0) {
        allRules[existingIdx] = { ...userRule, isSystem: false }; // User override
      } else {
        allRules.push({ ...userRule, isSystem: false });
      }
    }
  } catch (error) {
    console.error('Failed to load pronunciation library:', error);
  }

  return allRules;
}

export function savePronunciationLibrary(rules: PronunciationRule[]): void {
  try {
    // Only persist user (non-system) rules to localStorage
    const userRules = rules.filter(r => !r.isSystem);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userRules));
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
    isSystem: false,
  };

  const rules = loadPronunciationLibrary();

  // Check if this overrides a system rule
  const existingIdx = rules.findIndex(r => r.original.toLowerCase() === newRule.original.toLowerCase());
  if (existingIdx >= 0) {
    rules[existingIdx] = newRule;
  } else {
    rules.push(newRule);
  }

  savePronunciationLibrary(rules);
  return rules;
}

export function removePronunciationRule(id: string): PronunciationRule[] {
  const rules = loadPronunciationLibrary();
  // Only allow removing non-system rules; if removing a user override, the system rule will reappear on next load
  const updatedRules = rules.filter(rule => rule.id !== id || rule.isSystem);
  savePronunciationLibrary(updatedRules);
  return loadPronunciationLibrary(); // Reload to restore any system rules that were overridden
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
