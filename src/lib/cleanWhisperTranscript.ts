/**
 * Clean Whisper Transcript Pipeline
 *
 * A pure, deterministic post-stitching function that runs on the full
 * Whisper transcript BEFORE any multi-engine merging. It removes
 * repeated paragraphs and boundary overlaps that survive per-chunk
 * deduplication.
 *
 * Three steps:
 *   A — Block-level overlap trim (~350 chars at boundaries)
 *   B — Paragraph-hash dedup (FNV-1a, sliding window of 50)
 *   C — Sentence dedup (existing deduplicateFullText)
 */

import { deduplicateFullText } from './whisperDeduplication';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface CleanResult {
  text: string;
  paragraphsDropped: number;
  sentencesDropped: number;
  overlapsTrimmed: number;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Normalise text for comparison only (lowercase, collapse whitespace, strip repeated punctuation). */
function normaliseForComparison(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/([.!?,;:])\1+/g, '$1') // strip repeated punctuation
    .trim();
}

/**
 * FNV-1a 32-bit hash — fast, deterministic, no crypto dependency.
 * Returns a 32-bit unsigned integer.
 */
function fnv1a32(input: string): number {
  let hash = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193); // FNV prime
  }
  return hash >>> 0; // ensure unsigned
}

/**
 * Split text into sentence-ish units (used when no double newlines exist
 * and we need to group sentences into blocks of 2–3).
 */
function splitIntoSentences(text: string): string[] {
  if (!text?.trim()) return [];
  return text
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

/**
 * Split text into blocks: first try double newlines, then fall back to
 * grouping sentences 2–3 at a time.
 */
function splitIntoBlocks(text: string): string[] {
  const doubleNewlineSplit = text.split(/\n\n+/).map(b => b.trim()).filter(Boolean);
  if (doubleNewlineSplit.length >= 2) return doubleNewlineSplit;

  // No meaningful paragraph breaks — group sentences
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
 * Bounded prefix overlap trim.
 *
 * For each adjacent block pair, compare the normalised tail of block N
 * (last 350 chars) with the normalised head of block N+1 (first 350 chars).
 *
 * Scan from 350 chars down to 50 chars for the longest prefix of headNorm
 * that appears at the end of tailNorm. If overlap ratio >= 0.60, trim.
 *
 * O(n) per pair with bounded window.
 */
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

    // Scan from longest to shortest prefix of headNorm that ends tailNorm
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
        // Trim the overlapping prefix from the raw current block.
        // The overlap length in normalised space ≈ the number of leading chars
        // to remove from the raw current block. We find the raw-char count that
        // corresponds to the normalised overlap.
        const trimmedCurr = trimRawByNormLen(currRaw, bestOverlapLen);
        if (trimmedCurr.trim().length > 0) {
          result.push(trimmedCurr);
          trimmed++;
          continue;
        }
        // If trimming would empty the block, drop it entirely
        trimmed++;
        continue;
      }
    }

    result.push(currRaw);
  }

  return { blocks: result, trimmed };
}

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
    // In normalisation we collapse whitespace and strip repeated punctuation,
    // so every "meaningful" char advances normCount.
    if (ch !== ' ' || (rawIdx > 0 && lower[rawIdx - 1] !== ' ')) {
      normCount++;
    }
    rawIdx++;
  }

  // Skip any trailing whitespace at the trim boundary
  while (rawIdx < raw.length && raw[rawIdx] === ' ') rawIdx++;

  return raw.substring(rawIdx);
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
      // Very short blocks pass through (avoid false positives)
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
 * Clean a stitched Whisper transcript before multi-engine merging.
 *
 * @param rawText  The concatenated raw Whisper chunk output.
 * @returns        Cleaned text plus stats for diagnostics.
 */
export function cleanWhisperTranscript(rawText: string): CleanResult {
  if (!rawText?.trim()) {
    return { text: '', paragraphsDropped: 0, sentencesDropped: 0, overlapsTrimmed: 0 };
  }

  // Step A — Block-level overlap trim
  const blocks = splitIntoBlocks(rawText);
  const overlapResult = overlapTrimBlocks(blocks);

  // Step B — Paragraph-hash dedup
  const hashResult = paragraphHashDedup(overlapResult.blocks);

  // Rebuild text
  const rebuiltText = hashResult.blocks.join('\n\n');

  // Step C — Sentence dedup (existing)
  const sentenceResult = deduplicateFullText(rebuiltText);

  return {
    text: sentenceResult.text,
    paragraphsDropped: hashResult.dropped,
    sentencesDropped: sentenceResult.duplicatesRemoved,
    overlapsTrimmed: overlapResult.trimmed,
  };
}
