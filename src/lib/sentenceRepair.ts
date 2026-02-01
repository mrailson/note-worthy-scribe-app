/**
 * Sentence Repair / Hygiene Pass
 * 
 * Lightweight punctuation and sentence boundary normaliser.
 * This is NOT summarisation - it's hygiene to fix:
 * - Fragment merging into complete sentences
 * - Repeated filler phrase removal
 * - Punctuation normalisation
 * 
 * Rules:
 * - Do not add new content
 * - Do not remove content (except fillers)
 * - Merge fragments into complete sentences
 * - Remove repeated filler phrases
 * - Preserve numbers exactly
 */

// Common filler phrases to remove (case-insensitive patterns)
const FILLER_PATTERNS = [
  /\b(um|uh|er|ah|like|you know|I mean|basically|actually|literally|sort of|kind of)\b,?\s*/gi,
  /\b(so\s+so|very\s+very|really\s+really)\b/gi, // Repeated intensifiers
];

// Repeated word patterns (e.g., "the the", "and and")
const REPEATED_WORD_PATTERN = /\b(\w+)\s+\1\b/gi;

// Sentence fragment indicators (fragments that should be joined to previous)
const FRAGMENT_STARTERS = [
  /^(and|but|or|so|because|which|that|who|where|when)\s/i,
];

// Missing capitalisation after sentence-ending punctuation
const SENTENCE_BOUNDARY_FIX = /([.!?])\s+([a-z])/g;

// Multiple spaces
const MULTIPLE_SPACES = /\s{2,}/g;

// Orphan punctuation (punctuation with weird spacing)
const ORPHAN_PUNCTUATION = /\s+([,.:;!?])/g;

// Missing space after punctuation (but not for numbers like 3.5)
const MISSING_SPACE_AFTER_PUNCT = /([.!?,;:])([A-Za-z])/g;

/**
 * Remove common filler phrases
 */
export function removeFillers(text: string): string {
  let result = text;
  
  for (const pattern of FILLER_PATTERNS) {
    result = result.replace(pattern, ' ');
  }
  
  // Remove repeated words (the the -> the)
  result = result.replace(REPEATED_WORD_PATTERN, '$1');
  
  return result;
}

/**
 * Fix sentence boundaries and capitalisation
 */
export function fixSentenceBoundaries(text: string): string {
  let result = text;
  
  // Fix capitalisation after sentence-ending punctuation
  result = result.replace(SENTENCE_BOUNDARY_FIX, (_, punct, letter) => 
    `${punct} ${letter.toUpperCase()}`
  );
  
  // Fix orphan punctuation (space before comma, etc.)
  result = result.replace(ORPHAN_PUNCTUATION, '$1');
  
  // Add space after punctuation if missing (but preserve decimals)
  result = result.replace(MISSING_SPACE_AFTER_PUNCT, '$1 $2');
  
  // Collapse multiple spaces
  result = result.replace(MULTIPLE_SPACES, ' ');
  
  return result;
}

/**
 * Merge sentence fragments with their preceding sentences
 * E.g., "I went to the store. And bought milk." -> "I went to the store and bought milk."
 */
export function mergeFragments(text: string): string {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const merged: string[] = [];
  
  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i].trim();
    if (!sentence) continue;
    
    // Check if this looks like a fragment
    let isFragment = false;
    for (const pattern of FRAGMENT_STARTERS) {
      if (pattern.test(sentence)) {
        isFragment = true;
        break;
      }
    }
    
    if (isFragment && merged.length > 0) {
      // Get the last sentence and remove its ending punctuation
      const lastSentence = merged.pop()!;
      const lastWithoutPunct = lastSentence.replace(/[.!?]+$/, '');
      
      // Lowercase the fragment starter and join
      const fragmentWithLowerStart = sentence.charAt(0).toLowerCase() + sentence.slice(1);
      merged.push(`${lastWithoutPunct} ${fragmentWithLowerStart}`);
    } else {
      merged.push(sentence);
    }
  }
  
  return merged.join(' ');
}

/**
 * Ensure first letter is capitalised
 */
export function capitaliseFirst(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Ensure text ends with proper punctuation
 */
export function ensureEndingPunctuation(text: string): string {
  if (!text) return text;
  const trimmed = text.trim();
  if (!trimmed) return trimmed;
  
  const lastChar = trimmed.charAt(trimmed.length - 1);
  if (!/[.!?]/.test(lastChar)) {
    return trimmed + '.';
  }
  return trimmed;
}

/**
 * Main sentence repair function - applies all hygiene passes
 * 
 * @param text Raw transcript text
 * @returns Cleaned text with proper sentence structure
 */
export function repairSentences(text: string): string {
  if (!text?.trim()) return '';
  
  let result = text;
  
  // Step 1: Remove filler phrases and repeated words
  result = removeFillers(result);
  
  // Step 2: Fix sentence boundaries and capitalisation
  result = fixSentenceBoundaries(result);
  
  // Step 3: Merge fragments (optional - can be aggressive)
  // result = mergeFragments(result);
  
  // Step 4: Ensure proper start and end
  result = capitaliseFirst(result.trim());
  result = ensureEndingPunctuation(result);
  
  // Final cleanup: collapse multiple spaces
  result = result.replace(MULTIPLE_SPACES, ' ').trim();
  
  return result;
}

/**
 * Lightweight repair that preserves more of the original structure
 * Use this for real-time display where minimal changes are preferred
 */
export function lightRepair(text: string): string {
  if (!text?.trim()) return '';
  
  let result = text;
  
  // Only fix obvious issues
  result = result.replace(REPEATED_WORD_PATTERN, '$1'); // Remove word stutters
  result = result.replace(ORPHAN_PUNCTUATION, '$1'); // Fix punctuation spacing
  result = result.replace(MULTIPLE_SPACES, ' '); // Collapse spaces
  
  return result.trim();
}
