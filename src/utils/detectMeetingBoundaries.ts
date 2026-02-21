/**
 * Meeting Boundary Detection
 * 
 * Compares consecutive transcripts to detect when uploaded files
 * likely belong to different meetings. Uses keyword/domain overlap
 * to flag abrupt topic shifts (e.g. NZ council → UK GP practice).
 */

export interface BoundaryResult {
  /** Index of the file where the boundary occurs (between fileIndex-1 and fileIndex) */
  fileIndex: number;
  /** Similarity score between the two consecutive transcripts (0–1) */
  similarity: number;
  /** Keywords unique to the segment before the boundary */
  keywordsBefore: string[];
  /** Keywords unique to the segment after the boundary */
  keywordsAfter: string[];
}

export interface BoundaryReport {
  hasBoundaries: boolean;
  boundaries: BoundaryResult[];
  /** Human-readable warning message, if any */
  warning?: string;
}

// Common English stop words to exclude from keyword extraction
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'it', 'its', 'be', 'was', 'were',
  'are', 'been', 'has', 'have', 'had', 'do', 'does', 'did', 'will',
  'would', 'could', 'should', 'may', 'might', 'can', 'shall', 'this',
  'that', 'these', 'those', 'i', 'you', 'he', 'she', 'we', 'they',
  'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'our',
  'their', 'what', 'which', 'who', 'whom', 'how', 'when', 'where',
  'why', 'not', 'no', 'yes', 'so', 'if', 'then', 'than', 'also',
  'just', 'about', 'up', 'out', 'all', 'there', 'some', 'very',
  'as', 'into', 'over', 'after', 'before', 'between', 'each',
  'through', 'during', 'because', 'while', 'both', 'same', 'other',
  'more', 'most', 'such', 'only', 'own', 'well', 'now', 'get',
  'got', 'going', 'went', 'go', 'come', 'came', 'make', 'made',
  'take', 'took', 'give', 'gave', 'say', 'said', 'tell', 'told',
  'think', 'thought', 'know', 'knew', 'see', 'saw', 'look', 'looked',
  'want', 'need', 'like', 'use', 'used', 'work', 'way', 'back',
  'being', 'much', 'even', 'still', 'new', 'one', 'two', 'first',
  'last', 'long', 'great', 'little', 'right', 'old', 'big', 'good',
  'thing', 'things', 'time', 'people', 'really', 'actually', 'okay',
  'yeah', 'um', 'uh', 'kind', 'sort', 'lot', 'quite', 'bit',
]);

/** Minimum similarity threshold — below this we flag a boundary */
const SIMILARITY_THRESHOLD = 0.15;

/** Minimum words per transcript to attempt comparison */
const MIN_WORDS = 50;

/**
 * Extract the top N keywords from a text block.
 * Returns lowercased tokens sorted by frequency.
 */
function extractKeywords(text: string, topN = 40): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));

  const freq = new Map<string, number>();
  for (const w of words) {
    freq.set(w, (freq.get(w) || 0) + 1);
  }

  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([word]) => word);
}

/**
 * Compute Jaccard similarity between two keyword sets.
 */
function jaccardSimilarity(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const w of setA) {
    if (setB.has(w)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Detect meeting boundaries between consecutive transcripts.
 * 
 * @param transcripts Array of transcript strings in chronological order
 * @param fileNames   Corresponding file names (for display)
 * @returns BoundaryReport with detected boundaries and warning message
 */
export function detectMeetingBoundaries(
  transcripts: string[],
  fileNames: string[]
): BoundaryReport {
  if (transcripts.length < 2) {
    return { hasBoundaries: false, boundaries: [] };
  }

  const boundaries: BoundaryResult[] = [];

  for (let i = 1; i < transcripts.length; i++) {
    const prevWords = transcripts[i - 1].split(/\s+/).length;
    const currWords = transcripts[i].split(/\s+/).length;

    // Skip very short transcripts — not enough signal
    if (prevWords < MIN_WORDS || currWords < MIN_WORDS) continue;

    const keywordsPrev = extractKeywords(transcripts[i - 1]);
    const keywordsCurr = extractKeywords(transcripts[i]);
    const similarity = jaccardSimilarity(keywordsPrev, keywordsCurr);

    if (similarity < SIMILARITY_THRESHOLD) {
      // Find unique keywords to each side for the UI
      const prevSet = new Set(keywordsPrev);
      const currSet = new Set(keywordsCurr);
      const uniqueBefore = keywordsPrev.filter(w => !currSet.has(w)).slice(0, 5);
      const uniqueAfter = keywordsCurr.filter(w => !prevSet.has(w)).slice(0, 5);

      boundaries.push({
        fileIndex: i,
        similarity,
        keywordsBefore: uniqueBefore,
        keywordsAfter: uniqueAfter,
      });
    }
  }

  if (boundaries.length === 0) {
    return { hasBoundaries: false, boundaries: [] };
  }

  // Build warning message
  const parts = boundaries.map(b => {
    const before = fileNames[b.fileIndex - 1] || `File ${b.fileIndex}`;
    const after = fileNames[b.fileIndex] || `File ${b.fileIndex + 1}`;
    return `"${before}" and "${after}" appear to be from different meetings (${(b.similarity * 100).toFixed(0)}% topic overlap)`;
  });

  return {
    hasBoundaries: true,
    boundaries,
    warning: `⚠️ Possible mixed meetings detected: ${parts.join('; ')}. Consider importing them as separate meetings.`,
  };
}
