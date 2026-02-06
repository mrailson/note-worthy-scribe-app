/**
 * Clean Whisper Transcript Pipeline
 *
 * A pure, deterministic post-stitching function that runs on the full
 * Whisper transcript BEFORE any multi-engine merging. It removes
 * repeated paragraphs and boundary overlaps that survive per-chunk
 * deduplication, then applies sentence-level dedup.
 *
 * Delegates Steps A+B to the shared `dedupTranscriptText` utility,
 * then adds Step C (sentence dedup via `deduplicateFullText`).
 */

import { deduplicateFullText } from './whisperDeduplication';
import { dedupTranscriptText } from './dedupTranscriptText';

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
/*  Main export                                                        */
/* ------------------------------------------------------------------ */

/**
 * Clean a stitched Whisper transcript before multi-engine merging.
 *
 * Steps A+B (overlap trim + paragraph hash dedup) are delegated to the
 * shared `dedupTranscriptText` utility so that the same normalisation,
 * hashing, and thresholds are used everywhere.
 *
 * Step C adds sentence-level dedup on top.
 *
 * @param rawText  The concatenated raw Whisper chunk output.
 * @returns        Cleaned text plus stats for diagnostics.
 */
export function cleanWhisperTranscript(rawText: string): CleanResult {
  if (!rawText?.trim()) {
    return { text: '', paragraphsDropped: 0, sentencesDropped: 0, overlapsTrimmed: 0 };
  }

  // Steps A+B — Block overlap trim + paragraph hash dedup (shared utility)
  const dedupResult = dedupTranscriptText(rawText);

  // Step C — Sentence dedup (existing)
  const sentenceResult = deduplicateFullText(dedupResult.text);

  return {
    text: sentenceResult.text,
    paragraphsDropped: dedupResult.paragraphsDropped,
    sentencesDropped: sentenceResult.duplicatesRemoved,
    overlapsTrimmed: dedupResult.overlapsTrimmed,
  };
}
