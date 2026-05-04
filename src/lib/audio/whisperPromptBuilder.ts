/**
 * Builds context-aware prompts for Whisper transcription.
 *
 * Whisper only considers the final ~224 tokens (~170 words) of the prompt
 * and discards anything earlier. Order matters: the LAST content in the
 * prompt is what the model actually conditions on.
 *
 * Composition order (front → back, lowest → highest priority):
 *   1. previousChunkText (capped) — continuity, dropped first if budget overflows
 *   2. NHS_DEFAULT_PROMPT — domain + UK English priming (always present)
 *   3. Meeting-specific context (title, attendees, agenda) — highest priority,
 *      last in the prompt so Whisper conditions on these names directly.
 */

export const NHS_DEFAULT_PROMPT =
  'British English NHS primary care meeting transcript. ' +
  'Use UK spellings: judgement, organisation, recognise, programme, behaviour, neighbourhood, centre. ' +
  'Common terms: PCN, ICB, CQC, EMIS, SystmOne, TPP, GP, ANP, ACP, ARRS, GMS, DES, LES, ' +
  'MoU, DPIA, DTAC, NRES, neighbourhood, workstream, safeguarding, dispensing, ' +
  'enhanced access, social prescribing, clinical pharmacist, controlled drugs, ' +
  'primary care network, integrated care board.';

const MAX_PROMPT_WORDS = 170;        // ~224-token Whisper window
const PREV_CHUNK_TAIL_WORDS = 60;    // Cap continuity to leave room for priming

export function buildWhisperPrompt(options?: {
  meetingTitle?: string;
  attendees?: string[];
  agendaTerms?: string[];
  previousChunkText?: string;
}): string {
  const { meetingTitle, attendees, agendaTerms, previousChunkText } = options || {};

  const parts: string[] = [];

  // 1. Previous chunk tail — placed FIRST so it is truncated first
  //    if the assembled prompt exceeds the token budget.
  if (previousChunkText) {
    const words = previousChunkText.trim().split(/\s+/);
    const tail = words.slice(-PREV_CHUNK_TAIL_WORDS).join(' ');
    if (tail) parts.push(tail);
  }

  // 2. Domain priming — always present.
  parts.push(NHS_DEFAULT_PROMPT);

  // 3. Meeting-specific context — placed LAST (highest priority position
  //    in Whisper's effective window).
  if (meetingTitle) {
    parts.push(`Meeting: ${meetingTitle}.`);
  }
  if (attendees && attendees.length > 0) {
    parts.push(`Attendees: ${attendees.join(', ')}.`);
  }
  if (agendaTerms && agendaTerms.length > 0) {
    parts.push(`Key terms: ${agendaTerms.join(', ')}.`);
  }

  // Defensive trim — keep last MAX_PROMPT_WORDS only.
  const joined = parts.join(' ');
  const wordList = joined.split(/\s+/);
  if (wordList.length > MAX_PROMPT_WORDS) {
    return wordList.slice(-MAX_PROMPT_WORDS).join(' ');
  }
  return joined;
}
