/**
 * Sanitises source content before it is sent to image generation prompts.
 * Strips hex colour codes, CSS property names, formatting directives,
 * raw HTML tags, and flags garbled/nonsense words so they don't bleed
 * through into the rendered image text.
 *
 * Returns the cleaned string and an array of human-readable warnings.
 */

// Common CSS properties that should never appear as visible text
const CSS_PROPERTY_PATTERN = /\b(font-size|font-weight|font-family|margin|padding|border|background-color|text-align|line-height|letter-spacing|text-decoration|text-transform|box-shadow|border-radius|overflow|display|position|z-index|opacity|rgba|hsla?)\b[:\s]?/gi;

// Formatting directives / prompt bleed-through
const DIRECTIVE_PATTERNS = [
  /\b(accent\s+on|use\s+colou?r|style\s*:|format\s*:|bold\s+this|make\s+bold|italicise|capitalize)\b/gi,
  /\b(font\s*:\s*\S+)/gi,
];

// Raw HTML tags appearing as text (not rendered)
const RAW_HTML_TAG_PATTERN = /<\/?(?:div|span|p|br|h[1-6]|ul|ol|li|img|a|table|tr|td|th|strong|em|b|i|section|article|header|footer|nav|main)\b[^>]*>/gi;

// Hex colour codes: #ABC, #AABBCC, #AABBCCDD
// This pattern is used for non-context-aware stripping (plain text input).
const HEX_COLOUR_PATTERN = /#(?:[0-9A-Fa-f]{3,4}){1,2}\b/g;

// Context-aware hex stripping for HTML: matches hex codes that are NOT inside
// style="..." or fill="..." attributes. We use a two-pass approach in the
// HTML-aware sanitiser below.

// Simple heuristic for garbled words: consonant clusters that rarely
// appear in English (≥4 consonants in a row with no vowel)
const GARBLED_WORD_PATTERN = /\b[A-Za-z]*[BCDFGHJKLMNPQRSTVWXYZbcdfghjklmnpqrstvwxyz]{5,}[A-Za-z]*\b/g;

// Known misspelling examples from the user's report
const KNOWN_GARBLED = [
  'tbeli', 'commundcated', 'teh', 'Proffesional', 'Collobrative',
  'Developement', 'Neighlorhood', 'Organiztion', 'Fragenttned',
];

export interface SanitiseResult {
  html: string;
  warnings: string[];
}

/**
 * Context-aware hex code stripping for HTML content.
 * Removes hex codes from visible text but preserves them inside
 * style="...", fill="...", stroke="...", stop-color="...", etc.
 */
function stripHexFromVisibleText(html: string): { result: string; count: number; samples: string[] } {
  const samples: string[] = [];
  let count = 0;

  // Split content into "inside attribute" vs "outside attribute" segments.
  // We tokenise by HTML attributes that legitimately contain colour values.
  const ATTR_PATTERN = /(?:style|fill|stroke|stop-color|color|bgcolor)\s*=\s*"[^"]*"/gi;

  // Build a map of protected ranges
  const protectedRanges: [number, number][] = [];
  let attrMatch: RegExpExecArray | null;
  const attrRegex = new RegExp(ATTR_PATTERN.source, 'gi');
  while ((attrMatch = attrRegex.exec(html)) !== null) {
    protectedRanges.push([attrMatch.index, attrMatch.index + attrMatch[0].length]);
  }

  // Also protect CSS blocks: <style>...</style>
  const styleBlockRegex = /<style[^>]*>[\s\S]*?<\/style>/gi;
  let styleMatch: RegExpExecArray | null;
  while ((styleMatch = styleBlockRegex.exec(html)) !== null) {
    protectedRanges.push([styleMatch.index, styleMatch.index + styleMatch[0].length]);
  }

  const isProtected = (pos: number) => protectedRanges.some(([s, e]) => pos >= s && pos < e);

  const hexRegex = /#(?:[0-9A-Fa-f]{3,4}){1,2}\b/g;
  let hexMatch: RegExpExecArray | null;
  const replacements: { start: number; end: number; text: string }[] = [];
  while ((hexMatch = hexRegex.exec(html)) !== null) {
    if (!isProtected(hexMatch.index)) {
      replacements.push({ start: hexMatch.index, end: hexMatch.index + hexMatch[0].length, text: hexMatch[0] });
      if (samples.length < 5) samples.push(hexMatch[0]);
      count++;
    }
  }

  // Apply replacements in reverse order to preserve indices
  let result = html;
  for (let i = replacements.length - 1; i >= 0; i--) {
    const r = replacements[i];
    result = result.slice(0, r.start) + result.slice(r.end);
  }

  return { result, count, samples };
}

export function sanitizeGeneratedContent(content: string): SanitiseResult {
  const warnings: string[] = [];
  let cleaned = content;

  // 1. Strip hex colour codes from visible text only (preserve in style attributes)
  const isHtml = /<[a-z][\s\S]*>/i.test(cleaned);
  if (isHtml) {
    const { result, count, samples } = stripHexFromVisibleText(cleaned);
    if (count > 0) {
      cleaned = result;
      warnings.push(`Stripped ${count} hex colour code(s) from visible text: ${samples.join(', ')}`);
    }
  } else {
    // Plain text: strip all hex codes
    const hexMatches = cleaned.match(HEX_COLOUR_PATTERN);
    if (hexMatches && hexMatches.length > 0) {
      cleaned = cleaned.replace(HEX_COLOUR_PATTERN, '');
      warnings.push(`Stripped ${hexMatches.length} hex colour code(s) from content: ${hexMatches.slice(0, 5).join(', ')}`);
    }
  }

  // 2. Strip CSS property names / values
  const cssMatches = cleaned.match(CSS_PROPERTY_PATTERN);
  if (cssMatches && cssMatches.length > 0) {
    cleaned = cleaned.replace(CSS_PROPERTY_PATTERN, '');
    warnings.push(`Stripped ${cssMatches.length} CSS property reference(s)`);
  }

  // 3. Strip formatting directives / prompt instructions
  for (const pattern of DIRECTIVE_PATTERNS) {
    const matches = cleaned.match(pattern);
    if (matches && matches.length > 0) {
      cleaned = cleaned.replace(pattern, '');
      warnings.push(`Stripped formatting directive(s): ${matches.slice(0, 3).join(', ')}`);
    }
  }

  // 4. Remove raw HTML tags appearing as visible text
  const htmlTagMatches = cleaned.match(RAW_HTML_TAG_PATTERN);
  if (htmlTagMatches && htmlTagMatches.length > 0) {
    cleaned = cleaned.replace(RAW_HTML_TAG_PATTERN, '');
    warnings.push(`Stripped ${htmlTagMatches.length} raw HTML tag(s)`);
  }

  // 5. Check for garbled / nonsense words (warn only, don't remove)
  const garbledMatches = cleaned.match(GARBLED_WORD_PATTERN);
  if (garbledMatches) {
    // Filter out common legitimate words with long consonant clusters
    const legitimateWords = new Set([
      'strengths', 'lengths', 'rhythms', 'lymph', 'synths', 'glyphs',
      'twelfths', 'schnapps', 'scripts', 'encrypts', 'extracts',
      'HTTPS', 'https',
    ]);
    const suspicious = garbledMatches.filter(
      w => !legitimateWords.has(w.toLowerCase()) && w.length > 3
    );
    if (suspicious.length > 0) {
      console.warn(
        `⚠️ Possible garbled words detected in source content: ${suspicious.slice(0, 10).join(', ')}`
      );
      warnings.push(`Possible garbled/misspelled words: ${suspicious.slice(0, 5).join(', ')}`);
    }
  }

  // Also check for known garbled patterns
  for (const garbled of KNOWN_GARBLED) {
    const regex = new RegExp(`\\b${garbled}\\b`, 'gi');
    if (regex.test(cleaned)) {
      warnings.push(`Known misspelling detected: "${garbled}"`);
    }
  }

  // 6. Clean up whitespace artefacts from stripping
  cleaned = cleaned
    .replace(/\s{3,}/g, '  ')       // Collapse excessive spaces
    .replace(/^\s+$/gm, '')          // Remove blank-only lines
    .replace(/\n{3,}/g, '\n\n')      // Collapse excessive newlines
    .trim();

  if (warnings.length > 0) {
    console.log(`🧹 sanitizeGeneratedContent: ${warnings.length} issue(s) found and cleaned`);
  }

  return { html: cleaned, warnings };
}
