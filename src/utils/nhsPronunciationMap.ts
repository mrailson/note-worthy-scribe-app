/**
 * NHS Primary Care Pronunciation Map
 * 
 * Deterministic text replacements for ElevenLabs TTS so that
 * common UK NHS acronyms are spoken naturally.
 * 
 * ⚠️  Speech-only — never mutate displayed text or stored transcripts.
 *     Apply once per message immediately before sending to TTS.
 * 
 * To add a new term:
 *   1. Add an entry to NHS_PRONUNCIATION_RULES below.
 *   2. Use word-boundary anchors (\b) to avoid partial matches.
 *   3. Keep `say` as a phonetic hint ElevenLabs can pronounce clearly.
 */

export interface PronunciationRule {
  /** RegExp source string with word boundaries (applied with 'gi' flags). */
  match: string;
  /** Phonetic replacement ElevenLabs will speak instead. */
  say: string;
}

/**
 * Master list of UK NHS primary care pronunciation rules.
 * Sorted alphabetically by the acronym for easy maintenance.
 */
export const NHS_PRONUNCIATION_RULES: PronunciationRule[] = [
  // ── Organisations & Structures ──────────────────────────
  { match: '\\bAPMS\\b',      say: 'ay pee em ess' },
  { match: '\\bCQC\\b',       say: 'see cue see' },
  { match: '\\bGMS\\b',       say: 'jee em ess' },
  { match: '\\bICB\\b',       say: 'I C B' },
  { match: '\\bICS\\b',       say: 'I C S' },
  { match: '\\bNHSE\\b',      say: 'N H S E' },
  { match: '\\bPCN\\b',       say: 'P C N' },
  { match: '\\bPMS\\b',       say: 'pee em ess' },

  // ── Workforce & Contracts ──────────────────────────────
  { match: '\\bARRS\\b',      say: 'ah-riss' },
  { match: '\\bDES\\b',       say: 'D E S' },
  { match: '\\bLES\\b',       say: 'L E S' },
  { match: '\\bQOF\\b',       say: 'kwoff' },
  { match: '\\bTUPE\\b',      say: 'too-pee' },

  // ── Clinical Systems ───────────────────────────────────
  { match: '\\bEMIS\\b',      say: 'ee-miss' },
  { match: '\\bSNOMED\\b',    say: 'snow-med' },
  { match: '\\bSystmOne\\b',  say: 'system one' },
  { match: '\\bTPP\\b',       say: 'T P P' },

  // ── Clinical Acronyms ─────────────────────────────────
  { match: '\\bBNF\\b',       say: 'B N F' },
  { match: '\\bDMARD\\b',     say: 'dee-mard' },
  { match: '\\bDMARDs\\b',    say: 'dee-mards' },
  { match: '\\bDNACPR\\b',    say: 'dee en ay see pee are' },
  { match: '\\bDSE\\b',       say: 'D S E' },
  { match: '\\bEHCP\\b',      say: 'E H C P' },
  { match: '\\bFIT\\b',       say: 'fit' },
  { match: '\\bGDPR\\b',      say: 'G D P R' },
  { match: '\\bHCA\\b',       say: 'H C A' },
  { match: '\\bIIF\\b',       say: 'I I F' },
  { match: '\\bMDT\\b',       say: 'M D T' },
  { match: '\\bNICE\\b',      say: 'nice' },
  { match: '\\bSMCR\\b',      say: 'S M C R' },
  { match: '\\bSSP\\b',       say: 'S S P' },
];

/**
 * Apply NHS pronunciation normalisation to text destined for TTS.
 * 
 * @param text  The raw message text (will NOT be mutated)
 * @returns     A new string with acronyms replaced by phonetic hints
 */
export function applyNHSPronunciation(text: string): string {
  if (!text) return text;

  let result = text;
  for (const rule of NHS_PRONUNCIATION_RULES) {
    const regex = new RegExp(rule.match, 'g'); // case-sensitive to respect boundaries
    result = result.replace(regex, rule.say);
  }
  return result;
}
