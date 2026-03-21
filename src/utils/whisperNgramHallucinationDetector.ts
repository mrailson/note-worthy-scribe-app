/**
 * Whisper Hallucination Detector for Notewell AI
 * ================================================
 * N-gram based repetition-loop detection with severity scoring
 * and automatic substitution from alternative STT engines.
 *
 * Complements the existing whisperHallucinationPatterns.ts (phrase matching)
 * with chunk-level n-gram analysis and pipeline-aware substitution logic.
 *
 * Usage:
 *   const result = detectHallucination(chunkText, chunkConfidence);
 *   if (result.isHallucinated) {
 *     // Substitute AssemblyAI or Deepgram for this time window
 *   }
 */

import { isLikelyHallucination } from './whisperHallucinationPatterns';

// --- Configuration -----------------------------------------------------------

interface HallucinationConfig {
  /** Minimum n-gram size to check for repetition (words). Default: 6 */
  ngramSize: number;
  /** Max times an n-gram can repeat before flagging. Default: 2 */
  maxRepetitions: number;
  /** Whisper confidence threshold (0-1). Below this, flag for review. Default: 0.20 */
  confidenceFloor: number;
  /** Ratio of repeated content to total content that triggers a flag. Default: 0.30 */
  repetitionRatioThreshold: number;
  /** Max expected words per 90s chunk. Above this suggests hallucination padding. Default: 350 */
  maxWordsPerChunk: number;
}

const DEFAULT_CONFIG: HallucinationConfig = {
  ngramSize: 6,
  maxRepetitions: 2,
  confidenceFloor: 0.20,
  repetitionRatioThreshold: 0.30,
  maxWordsPerChunk: 350,
};

// --- Types -------------------------------------------------------------------

export interface NgramHallucinationResult {
  /** Whether the chunk is flagged as hallucinated */
  isHallucinated: boolean;
  /** Confidence level of the hallucination detection: high, medium, low */
  severity: 'high' | 'medium' | 'low' | 'none';
  /** Human-readable reason for the flag */
  reasons: string[];
  /** The repeated phrases found, with their count */
  repeatedPhrases: { phrase: string; count: number }[];
  /** Suggested action */
  action: 'substitute' | 'review' | 'keep';
  /** Cleaned text with hallucinated loops removed (best-effort) */
  cleanedText: string;
  /** Percentage of chunk that was repetitive content */
  repetitionRatio: number;
}

// --- Core Detection ----------------------------------------------------------

/**
 * Detects repetition-loop hallucinations in a Whisper transcription chunk.
 *
 * @param chunkText - The raw transcribed text from a single Whisper chunk
 * @param chunkConfidence - Whisper's reported confidence (0-1) for this chunk
 * @param config - Optional config overrides
 * @returns Detection result with severity, reasons, and cleaned text
 */
export function detectHallucination(
  chunkText: string,
  chunkConfidence: number,
  config: Partial<HallucinationConfig> = {}
): NgramHallucinationResult {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const reasons: string[] = [];
  const repeatedPhrases: { phrase: string; count: number }[] = [];
  let severity: NgramHallucinationResult['severity'] = 'none';

  const words = chunkText.trim().split(/\s+/);
  const wordCount = words.length;

  // --- Check 1: N-gram repetition detection ---
  const ngramCounts = countNgrams(words, cfg.ngramSize);
  let repeatedWordCount = 0;

  for (const [phrase, count] of ngramCounts.entries()) {
    if (count > cfg.maxRepetitions) {
      repeatedPhrases.push({ phrase, count });
      repeatedWordCount += (count - 1) * cfg.ngramSize;
    }
  }

  const repetitionRatio = wordCount > 0 ? repeatedWordCount / wordCount : 0;

  if (repetitionRatio > cfg.repetitionRatioThreshold) {
    reasons.push(
      `Repetition ratio ${(repetitionRatio * 100).toFixed(0)}% exceeds ` +
      `threshold of ${(cfg.repetitionRatioThreshold * 100).toFixed(0)}%`
    );
    severity = 'high';
  }

  // --- Check 2: Confidence floor ---
  if (chunkConfidence < cfg.confidenceFloor) {
    reasons.push(
      `Chunk confidence ${(chunkConfidence * 100).toFixed(0)}% is below ` +
      `floor of ${(cfg.confidenceFloor * 100).toFixed(0)}%`
    );
    if (severity === 'none') severity = 'medium';
  }

  // --- Check 3: Abnormal word count ---
  if (wordCount > cfg.maxWordsPerChunk) {
    reasons.push(
      `Word count ${wordCount} exceeds expected max of ${cfg.maxWordsPerChunk} ` +
      `(hallucination padding likely)`
    );
    if (severity === 'none') severity = 'medium';
    else if (severity === 'medium') severity = 'high';
  }

  // --- Check 4: Known Whisper hallucination phrases (delegates to existing utility) ---
  const existingCheck = isLikelyHallucination(chunkText, chunkConfidence);
  if (existingCheck.isHallucination) {
    reasons.push(existingCheck.reason || 'Known hallucination pattern detected');
    if (severity === 'none') severity = 'low';
  }

  // --- Determine action ---
  const isHallucinated = severity === 'high' || severity === 'medium';
  let action: NgramHallucinationResult['action'] = 'keep';
  if (severity === 'high') action = 'substitute';
  else if (severity === 'medium') action = 'review';

  // --- Clean the text (remove repeated loops) ---
  const cleanedText = removeRepetitionLoops(chunkText, cfg.ngramSize, cfg.maxRepetitions);

  return {
    isHallucinated,
    severity,
    reasons,
    repeatedPhrases,
    action,
    cleanedText,
    repetitionRatio,
  };
}

// --- Helper Functions --------------------------------------------------------

/**
 * Counts occurrences of each n-gram in the word array.
 */
function countNgrams(words: string[], n: number): Map<string, number> {
  const counts = new Map<string, number>();
  const normalised = words.map((w) => w.toLowerCase().replace(/[^a-z0-9']/g, ''));

  for (let i = 0; i <= normalised.length - n; i++) {
    const gram = normalised.slice(i, i + n).join(' ');
    counts.set(gram, (counts.get(gram) || 0) + 1);
  }

  return counts;
}

/**
 * Removes repetition loops from text. Keeps the first occurrence of any
 * repeated n-gram sequence and strips subsequent duplicates.
 */
function removeRepetitionLoops(
  text: string,
  ngramSize: number,
  maxAllowed: number
): string {
  const words = text.trim().split(/\s+/);
  const seen = new Map<string, number>();
  const keep: boolean[] = new Array(words.length).fill(true);
  const normalised = words.map((w) => w.toLowerCase().replace(/[^a-z0-9']/g, ''));

  for (let i = 0; i <= normalised.length - ngramSize; i++) {
    const gram = normalised.slice(i, i + ngramSize).join(' ');
    const count = (seen.get(gram) || 0) + 1;
    seen.set(gram, count);

    if (count > maxAllowed) {
      for (let j = i; j < i + ngramSize && j < words.length; j++) {
        keep[j] = false;
      }
    }
  }

  return words.filter((_, i) => keep[i]).join(' ');
}

// --- Pipeline Integration ----------------------------------------------------

export interface TranscriptionChunk {
  index: number;
  startTime: string;
  endTime: string;
  text: string;
  confidence: number;
  wordCount: number;
}

export interface AlternativeSource {
  engine: 'assemblyai' | 'deepgram';
  text: string;
  confidence?: number;
}

export interface ProcessedChunksSummary {
  totalChunks: number;
  substituted: number;
  flaggedForReview: number;
  kept: number;
}

/**
 * Processes all Whisper chunks through hallucination detection and returns
 * a cleaned array with substitutions from alternative engines where needed.
 *
 * This is the main entry point for the Notewell merge pipeline.
 */
export function processWhisperChunks(
  whisperChunks: TranscriptionChunk[],
  getAlternative: (startTime: string, endTime: string) => AlternativeSource | null,
  config: Partial<HallucinationConfig> = {}
): {
  chunks: (TranscriptionChunk & { source: string; hallucinationResult?: NgramHallucinationResult })[];
  summary: ProcessedChunksSummary;
} {
  let substituted = 0;
  let flaggedForReview = 0;
  let kept = 0;

  const processed = whisperChunks.map((chunk) => {
    const result = detectHallucination(chunk.text, chunk.confidence, config);

    if (result.action === 'substitute') {
      const alt = getAlternative(chunk.startTime, chunk.endTime);
      substituted++;

      if (alt) {
        return {
          ...chunk,
          text: alt.text,
          source: `${alt.engine} (substituted — ${result.reasons[0]})`,
          hallucinationResult: result,
        };
      } else {
        // No alternative available — use cleaned text as fallback
        return {
          ...chunk,
          text: result.cleanedText,
          source: `whisper-cleaned (${result.reasons[0]})`,
          hallucinationResult: result,
        };
      }
    }

    if (result.action === 'review') {
      flaggedForReview++;
      return {
        ...chunk,
        source: `whisper (flagged: ${result.reasons[0]})`,
        hallucinationResult: result,
      };
    }

    kept++;
    return { ...chunk, source: 'whisper' };
  });

  return {
    chunks: processed,
    summary: {
      totalChunks: whisperChunks.length,
      substituted,
      flaggedForReview,
      kept,
    },
  };
}
