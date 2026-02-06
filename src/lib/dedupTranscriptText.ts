/**
 * Shared Transcript De-duplication Utility
 *
 * A single, pure function that performs block-level overlap trimming and
 * paragraph-hash de-duplication on any transcript text. Used consistently
 * across Whisper output, Best-of-Three merger output, and diagnostics /
 * merge_decision_log so that all transcript views show the same cleaned text.
 *
 * Steps:
 *   A — Block-level overlap trim (~350 chars at boundaries)
 *   B — Paragraph-hash dedup (FNV-1a 32-bit, sliding window of 50)
 *
 * No external dependencies. No network calls. Deterministic.
 */

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface DedupResult {
  text: string;
  paragraphsDropped: number;
  overlapsTrimmed: number;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Normalise text for comparison only. */
function normaliseForComparison(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/([.!?,;:])\1+/g, '$1')
    .trim();
}

/**
 * FNV-1a 32-bit hash — fast, deterministic, no crypto dependency.
 */
function fnv1a32(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Split text into sentence-ish units.
 */
function splitIntoSentences(text: string): string[] {
  if (!text?.trim()) return [];
  return text
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

/**
 * Split text into blocks: double newlines first, then sentence groups of 2–3.
 */
function splitIntoBlocks(text: string): string[] {
  const doubleNewlineSplit = text.split(/\n\n+/).map(b => b.trim()).filter(Boolean);
  if (doubleNewlineSplit.length >= 2) return doubleNewlineSplit;

  const sentences = splitIntoSentences(text);
  if (sentences.length <= 3) return sentences.length > 0 ? [sentences.join(' ')] : [];

  const blocks: string[] = [];
  for (let i = 0; i < sentences.length; i += 3) {
    blocks.push(sentences.slice(i, i + 3).join(' '));
  }
  return blocks;
}

/* ------------------------------------------------------------------ */
/*  Step A — Block-level overlap trim                                  */
/* ------------------------------------------------------------------ */

/**
 * Given a raw string, strip approximately `normLen` characters worth of
 * content from the front (accounting for whitespace/punctuation differences
 * between raw and normalised forms).
 */
function trimRawByNormLen(raw: string, normLen: number): string {
  let normCount = 0;
  let rawIdx = 0;
  const lower = raw.toLowerCase();

  while (rawIdx < raw.length && normCount < normLen) {
    const ch = lower[rawIdx];
    if (ch !== ' ' || (rawIdx > 0 && lower[rawIdx - 1] !== ' ')) {
      normCount++;
    }
    rawIdx++;
  }

  while (rawIdx < raw.length && raw[rawIdx] === ' ') rawIdx++;

  return raw.substring(rawIdx);
}

function overlapTrimBlocks(blocks: string[]): { blocks: string[]; trimmed: number } {
  if (blocks.length < 2) return { blocks: [...blocks], trimmed: 0 };

  const WINDOW = 350;
  const MIN_WINDOW = 50;
  const RATIO_THRESHOLD = 0.60;
  let trimmed = 0;

  const result = [blocks[0]];

  for (let i = 1; i < blocks.length; i++) {
    const prevRaw = result[result.length - 1];
    const currRaw = blocks[i];

    const tailNorm = normaliseForComparison(prevRaw.slice(-WINDOW));
    const headNorm = normaliseForComparison(currRaw.slice(0, WINDOW));

    if (tailNorm.length < MIN_WINDOW || headNorm.length < MIN_WINDOW) {
      result.push(currRaw);
      continue;
    }

    let bestOverlapLen = 0;
    const maxScan = Math.min(headNorm.length, tailNorm.length, WINDOW);

    for (let len = maxScan; len >= MIN_WINDOW; len--) {
      const prefix = headNorm.substring(0, len);
      if (tailNorm.endsWith(prefix)) {
        bestOverlapLen = len;
        break;
      }
    }

    if (bestOverlapLen > 0) {
      const ratio = bestOverlapLen / headNorm.length;
      if (ratio >= RATIO_THRESHOLD) {
        const trimmedCurr = trimRawByNormLen(currRaw, bestOverlapLen);
        if (trimmedCurr.trim().length > 0) {
          result.push(trimmedCurr);
          trimmed++;
          continue;
        }
        trimmed++;
        continue;
      }
    }

    result.push(currRaw);
  }

  return { blocks: result, trimmed };
}

/* ------------------------------------------------------------------ */
/*  Step B — Paragraph-hash dedup (FNV-1a, sliding window of 50)       */
/* ------------------------------------------------------------------ */

function paragraphHashDedup(blocks: string[]): { blocks: string[]; dropped: number } {
  if (blocks.length < 2) return { blocks: [...blocks], dropped: 0 };

  const WINDOW_SIZE = 50;
  const recentHashes: number[] = [];
  const result: string[] = [];
  let dropped = 0;

  for (const block of blocks) {
    const norm = normaliseForComparison(block);
    if (norm.length < 10) {
      result.push(block);
      continue;
    }

    const hash = fnv1a32(norm);

    if (recentHashes.includes(hash)) {
      dropped++;
      continue;
    }

    result.push(block);
    recentHashes.push(hash);
    if (recentHashes.length > WINDOW_SIZE) {
      recentHashes.shift();
    }
  }

  return { blocks: result, dropped };
}

/* ------------------------------------------------------------------ */
/*  Main export                                                        */
/* ------------------------------------------------------------------ */

/**
 * Shared transcript de-duplication function.
 *
 * Performs:
 *   A. Block-level overlap trim (~350 char boundary window, ratio ≥ 0.60)
 *   B. Paragraph-hash dedup (FNV-1a 32-bit, sliding window of 50)
 *
 * Use this on ANY transcript text to remove repeated paragraphs and
 * boundary overlaps. Same normalisation, hashing, and thresholds everywhere.
 *
 * @param text  The transcript text to de-duplicate.
 * @returns     De-duplicated text plus stats for diagnostics.
 */
export function dedupTranscriptText(text: string): DedupResult {
  if (!text?.trim()) {
    return { text: '', paragraphsDropped: 0, overlapsTrimmed: 0 };
  }

  // Step A — Block-level overlap trim
  const blocks = splitIntoBlocks(text);
  const overlapResult = overlapTrimBlocks(blocks);

  // Step B — Paragraph-hash dedup
  const hashResult = paragraphHashDedup(overlapResult.blocks);

  // Rebuild text
  const rebuiltText = hashResult.blocks.join('\n\n');

  return {
    text: rebuiltText,
    paragraphsDropped: hashResult.dropped,
    overlapsTrimmed: overlapResult.trimmed,
  };
}
