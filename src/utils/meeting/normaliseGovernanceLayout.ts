/**
 * Shared pre-processor that fixes "clumped" layout in long meetings:
 * - Splits run-on AGREED/RESOLVED/NOTED governance entries onto their own lines
 * - Splits run-on Open Items & Risks paragraphs into bullet lines
 * - Detaches section headings (DECISIONS REGISTER, OPEN ITEMS & RISKS, etc.)
 *   that the AI sometimes welds onto the end of the previous paragraph
 *
 * Used by both the email HTML renderer (meetingEmailBuilder) and the Word
 * document renderer (generateProfessionalMeetingDocx) so both outputs stay
 * in lock-step.
 */

const SECTION_HEADINGS = [
  'DECISIONS REGISTER',
  'OPEN ITEMS & RISKS',
  'OPEN ITEMS AND RISKS',
  'OPEN ITEMS',
  'ACTION ITEMS',
  'NEXT STEPS',
  'RISKS',
];

export function normaliseGovernanceLayout(input: string): string {
  if (!input) return input;
  let text = input;

  // 1. Detach welded section headings — force a blank line before any of
  //    the known headings if they appear after non-newline text.
  for (const heading of SECTION_HEADINGS) {
    const re = new RegExp(`(\\S)[ \\t]*(${heading.replace(/&/g, '&')})\\b`, 'g');
    text = text.replace(re, (_m, prev, hd) => `${prev}\n\n${hd}`);
  }

  // 2. Split governance entries onto their own lines. Match RESOLVED|AGREED|NOTED
  //    when they appear mid-line preceded by other text. Accepts em-dash, en-dash
  //    or hyphen as the separator. Also handle trailing colon variant.
  text = text.replace(
    /([^\n])[ \t]+(RESOLVED|AGREED|NOTED)\s*[:\-—–][ \t]*/g,
    (_m, prev, label) => `${prev}\n${label} — `,
  );

  // Strip stray bold markers / colons the AI sometimes attaches to the label
  // (e.g. "**AGREED:**" at start of line) so they render as plain "AGREED — ".
  text = text.replace(
    /^\s*\*{0,2}(RESOLVED|AGREED|NOTED)\*{0,2}\s*[:\-—–]\s*/gim,
    (_m, label) => `${label} — `,
  );

  // 3. Split run-on Open Items & Risks paragraphs. Walk paragraph by paragraph
  //    and, for any paragraph that immediately follows the OPEN ITEMS heading,
  //    convert " - " separators (>=2 occurrences) into bullet lines.
  const paragraphs = text.split(/\n{2,}/);
  let inOpenItems = false;
  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i];
    const headingLine = para.split('\n')[0]?.trim().toUpperCase() ?? '';
    if (
      headingLine === 'OPEN ITEMS & RISKS' ||
      headingLine === 'OPEN ITEMS AND RISKS' ||
      headingLine === 'OPEN ITEMS' ||
      headingLine === 'RISKS'
    ) {
      inOpenItems = true;
      continue;
    }
    // Stop when we hit a different ALL-CAPS heading
    if (/^[A-Z][A-Z0-9 &/-]{3,}$/.test(headingLine)) {
      inOpenItems = false;
    }
    if (inOpenItems) {
      const dashCount = (para.match(/\s-\s/g) || []).length;
      if (dashCount >= 2) {
        // Split each " - " segment onto its own bullet line. Keep the first
        // segment as-is, prefix the rest with "- ".
        const segments = para.split(/\s-\s/).map(s => s.trim()).filter(Boolean);
        if (segments.length >= 3) {
          paragraphs[i] = segments.map((s, idx) => (idx === 0 ? `- ${s}` : `- ${s}`)).join('\n');
        }
      }
      // Once we've processed one body paragraph after the heading, stop —
      // subsequent paragraphs may belong to a different (untitled) sub-block.
      inOpenItems = false;
    }
  }
  text = paragraphs.join('\n\n');

  // Collapse 3+ blank lines back to a single blank line.
  text = text.replace(/\n{3,}/g, '\n\n');

  return text;
}
