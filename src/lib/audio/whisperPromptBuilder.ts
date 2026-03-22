/**
 * Builds context-aware prompts for Whisper transcription.
 * 
 * Whisper only considers the final ~224 tokens (~170 words) of the prompt,
 * so meeting-specific terms go first, previous chunk text goes last.
 */

export const NHS_DEFAULT_PROMPT =
  'NHS primary care meeting transcript. ' +
  'Common terms: PCN, ICB, CQC, EMIS, SystmOne, TPP, GP, ANP, ACP, ' +
  'clinical commissioning, safeguarding, dispensing, enhanced access, ' +
  'professional indemnity, reinsurance, deductible, consenting.';

export function buildWhisperPrompt(options?: {
  meetingTitle?: string;
  attendees?: string[];
  agendaTerms?: string[];
  previousChunkText?: string;
}): string {
  const { meetingTitle, attendees, agendaTerms, previousChunkText } = options || {};
  const parts: string[] = [];

  // Domain context base
  parts.push(NHS_DEFAULT_PROMPT);

  // Meeting-specific context
  if (meetingTitle) {
    parts.push(`Meeting: ${meetingTitle}.`);
  }

  if (attendees && attendees.length > 0) {
    parts.push(`Attendees: ${attendees.join(', ')}.`);
  }

  if (agendaTerms && agendaTerms.length > 0) {
    parts.push(`Key terms: ${agendaTerms.join(', ')}.`);
  }

  // For chunked transcription: feed previous chunk's ending as context.
  // Whisper only considers the final ~224 tokens, so last ~150 words.
  if (previousChunkText) {
    const words = previousChunkText.trim().split(/\s+/);
    const tail = words.slice(-150).join(' ');
    parts.push(tail);
  }

  return parts.join(' ');
}
