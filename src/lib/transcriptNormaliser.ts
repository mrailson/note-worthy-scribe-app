import { Segment, mergeByTimestamps, segmentsToPlainText } from "@/lib/segmentMerge";

/**
 * Extract segments from mixed JSON input (single or multiple concatenated arrays)
 */
export function extractSegmentsFromMixed(input: string): Segment[] {
  if (!input) return [];
  
  const segments: Segment[] = [];
  
  // More robust regex to find all JSON arrays, including those separated by spaces
  const arrayPattern = /\[\s*\{[^\]]*"start"[^\]]*\}\s*\]/g;
  const matches = input.match(arrayPattern);
  
  if (matches) {
    for (const match of matches) {
      try {
        const parsed = JSON.parse(match);
        if (Array.isArray(parsed)) {
          for (const s of parsed) {
            if (s && typeof s.start === 'number' && typeof s.end === 'number' && typeof s.text === 'string') {
              segments.push({ start: s.start, end: s.end, text: s.text });
            }
          }
        }
      } catch (e) {
        console.warn('Failed to parse JSON array segment:', match.substring(0, 100));
      }
    }
  }
  
  console.log(`📊 Extracted ${segments.length} segments from input`);
  return segments;
}

/**
 * Convert segments to readable paragraphs based on timing gaps
 */
export function segmentsToParagraphText(segs: Segment[], gapS = 2.5): string {
  if (!segs?.length) return "";
  
  const sorted = [...segs].sort((a, b) => a.start - b.start);
  const paras: Segment[][] = [];
  let current: Segment[] = [];
  let lastEnd = sorted[0].start;

  for (const s of sorted) {
    if (current.length === 0) {
      current.push(s);
      lastEnd = s.end;
      continue;
    }
    
    // If there's a pause > gapS seconds, start a new paragraph
    if (s.start - lastEnd > gapS) {
      paras.push(current);
      current = [s];
    } else {
      current.push(s);
    }
    lastEnd = Math.max(lastEnd, s.end);
  }
  
  if (current.length) paras.push(current);

  // Convert each paragraph group to plain text
  const paragraphTexts = paras.map(p => {
    const merged = mergeByTimestamps([], p);
    return segmentsToPlainText(merged).trim();
  }).filter(Boolean);

  return paragraphTexts.join("\n\n");
}

/**
 * Escape HTML entities
 */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Convert plain text with paragraph breaks to HTML
 */
export function toHtmlParagraphs(text: string): string {
  const parts = text.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  if (!parts.length) return "";
  
  return "<p>" + parts.map(escapeHtml).join("</p><p>") + "</p>";
}

/**
 * Main normaliser: detects JSON segments or plain text and returns both plain and HTML versions
 */
export function normaliseTranscript(input: string): { 
  plain: string; 
  html: string; 
  used: 'segments' | 'text' 
} {
  if (!input) {
    return { plain: '', html: '', used: 'text' };
  }

  // Try to extract segments first
  const segs = extractSegmentsFromMixed(input);
  if (segs.length) {
    const plain = segmentsToParagraphText(segs);
    return { plain, html: toHtmlParagraphs(plain), used: 'segments' };
  }
  
  // If the input already looks like HTML, preserve but also produce a plain version
  if (/<(p|br|ul|ol|li|strong|em)[\s>]/i.test(input)) {
    const plain = input
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<[^>]+>/g, "")
      .replace(/[ \t]+/g, " ")
      .trim();
    return { plain, html: input, used: 'text' };
  }
  
  // Fallback: treat as plain text and add intelligent paragraphing
  const sentences = input
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?])\s+/);
  
  const paras: string[] = [];
  let acc: string[] = [];
  let charCount = 0;
  
  for (const s of sentences) {
    const sentenceLength = s.length;
    acc.push(s);
    charCount += sentenceLength;
    
    // Create paragraph breaks based on:
    // - After 4-6 sentences (natural conversation flow)
    // - Or when we've accumulated 350-450 characters (readable chunks)
    // - But always wait for at least 3 sentences to avoid tiny paragraphs
    const shouldBreak = 
      (acc.length >= 4 && charCount > 300) ||
      (acc.length >= 6) ||
      (charCount > 450 && acc.length >= 3);
    
    if (shouldBreak) {
      paras.push(acc.join(" "));
      acc = [];
      charCount = 0;
    }
  }
  
  if (acc.length) paras.push(acc.join(" "));
  
  const plain = paras.join("\n\n");
  return { plain, html: toHtmlParagraphs(plain), used: 'text' };
}
