// Parse AI audio review summaries into quick-glance badge data

export interface AudioReviewBadge {
  label: string;
  sentiment: 'positive' | 'neutral' | 'negative' | 'warning';
}

const POSITIVE_TERMS = [
  'calm', 'polite', 'professional', 'empathetic', 'helpful', 'reasonable',
  'courteous', 'respectful', 'patient', 'supportive', 'compassionate',
  'understanding', 'cooperative', 'appropriate', 'good', 'excellent',
  'well-handled', 'effective', 'thorough', 'constructive',
];

const NEGATIVE_TERMS = [
  'aggressive', 'hostile', 'rude', 'abusive', 'threatening', 'dismissive',
  'unprofessional', 'defensive', 'confrontational', 'inappropriate',
  'angry', 'vulgar', 'offensive', 'intimidating', 'shouting', 'swearing',
  'belligerent', 'combative', 'uncooperative', 'disrespectful',
  'frustrated', 'distressed', 'upset',
];

const WARNING_TERMS = [
  'anxious', 'concerned', 'disappointed', 'emotional', 'tearful',
  'impatient', 'dissatisfied',
];

function classifySentiment(text: string): 'positive' | 'neutral' | 'negative' | 'warning' {
  const lower = text.toLowerCase();
  const negCount = NEGATIVE_TERMS.filter(t => lower.includes(t)).length;
  const posCount = POSITIVE_TERMS.filter(t => lower.includes(t)).length;
  const warnCount = WARNING_TERMS.filter(t => lower.includes(t)).length;

  if (negCount > 0 && negCount >= posCount) return 'negative';
  if (warnCount > 0 && warnCount > posCount) return 'warning';
  if (posCount > 0) return 'positive';
  return 'neutral';
}

function extractToneWord(text: string): string | null {
  const lower = text.toLowerCase();
  
  // Check negative first (priority)
  for (const term of NEGATIVE_TERMS) {
    if (lower.includes(term)) return term.charAt(0).toUpperCase() + term.slice(1);
  }
  for (const term of WARNING_TERMS) {
    if (lower.includes(term)) return term.charAt(0).toUpperCase() + term.slice(1);
  }
  for (const term of POSITIVE_TERMS) {
    if (lower.includes(term)) return term.charAt(0).toUpperCase() + term.slice(1);
  }
  return null;
}

/**
 * Parse an AI audio review and extract quick-glance badge data
 */
export function parseAudioReviewBadges(aiSummary: string): AudioReviewBadge[] {
  if (!aiSummary || aiSummary.length < 50) return [];

  const badges: AudioReviewBadge[] = [];
  const sections = aiSummary.split(/(?=\d+\.\s|\*\*\d+\.)/);

  let patientToneSection = '';
  let staffToneSection = '';
  let patientBehaviourSection = '';
  let staffBehaviourSection = '';
  let handlingSection = '';

  for (const section of sections) {
    const lower = section.toLowerCase();
    if (lower.includes('tone assessment') || lower.includes('caller') || lower.includes('patient tone')) {
      patientToneSection += ' ' + section;
      staffToneSection += ' ' + section;
    }
    if (lower.includes('patient behaviour') || lower.includes('patient behavior')) {
      patientBehaviourSection += ' ' + section;
    }
    if (lower.includes('staff behaviour') || lower.includes('staff behavior')) {
      staffBehaviourSection += ' ' + section;
    }
    if (lower.includes('complaint handling') || lower.includes('how was the complaint')) {
      handlingSection += ' ' + section;
    }
  }

  // Try to extract patient/caller tone from the tone section
  // Look for lines mentioning caller/patient
  const patientLines = patientToneSection
    .split(/\n|(?<=\.)/)
    .filter(l => {
      const ll = l.toLowerCase();
      return ll.includes('caller') || ll.includes('patient') || ll.includes('complainant');
    })
    .join(' ');

  const patientTone = extractToneWord(patientLines || patientBehaviourSection);
  if (patientTone) {
    badges.push({
      label: `Patient: ${patientTone}`,
      sentiment: classifySentiment(patientLines || patientBehaviourSection),
    });
  }

  // Staff tone
  const staffLines = staffToneSection
    .split(/\n|(?<=\.)/)
    .filter(l => {
      const ll = l.toLowerCase();
      return ll.includes('staff') || ll.includes('receptionist') || ll.includes('gp') || ll.includes('clinician') || ll.includes('doctor') || ll.includes('nurse');
    })
    .join(' ');

  const staffTone = extractToneWord(staffLines || staffBehaviourSection);
  if (staffTone) {
    badges.push({
      label: `Staff: ${staffTone}`,
      sentiment: classifySentiment(staffLines || staffBehaviourSection),
    });
  }

  // Handling assessment
  if (handlingSection) {
    const handlingSentiment = classifySentiment(handlingSection);
    if (handlingSentiment === 'negative') {
      badges.push({ label: 'Handling: Poor', sentiment: 'negative' });
    } else if (handlingSentiment === 'warning') {
      badges.push({ label: 'Handling: Concerns', sentiment: 'warning' });
    } else if (handlingSentiment === 'positive') {
      badges.push({ label: 'Handling: Good', sentiment: 'positive' });
    }
  }

  // If we couldn't parse structured sections, try a simpler approach
  if (badges.length === 0) {
    const overall = classifySentiment(aiSummary);
    if (overall !== 'neutral') {
      const tone = extractToneWord(aiSummary);
      if (tone) {
        badges.push({ label: tone, sentiment: overall });
      }
    }
  }

  return badges;
}

/** Get Tailwind classes for a badge sentiment */
export function getBadgeSentimentClasses(sentiment: AudioReviewBadge['sentiment']): string {
  switch (sentiment) {
    case 'positive':
      return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-800';
    case 'negative':
      return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800';
    case 'warning':
      return 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
}
