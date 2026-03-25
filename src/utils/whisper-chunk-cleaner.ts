/**
 * Whisper Chunk Cleaner
 * 
 * Post-processing utility that cleans Whisper batch transcription chunks
 * before they enter the multi-engine merge. Targets the known Whisper decoder
 * bug where low-confidence audio causes phrase repetition loops.
 * 
 * Three detection layers:
 * 1. N-gram repetition detection (4–20 word phrases repeated 3+ times)
 * 2. Single-word stutter detection (word repeated 4+ times consecutively)
 * 3. Word-rate anomaly flagging (>4.5 wps suggests hallucination padding)
 */

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ChunkCleanerConfig {
  /** Minimum n-gram length to scan (words). Default: 4 */
  minNgramLength: number;
  /** Maximum n-gram length to scan (words). Default: 20 */
  maxNgramLength: number;
  /** Consecutive repetitions before removal. Default: 3 */
  repetitionThreshold: number;
  /** Words-per-second above which chunk is flagged. Default: 4.5 */
  wordRateThreshold: number;
  /** Consecutive single-word stutters before collapsing. Default: 4 */
  stutterThreshold: number;
  /** Confidence below this uses aggressive thresholds. Default: 0.25 */
  lowConfidenceThreshold: number;
  /** Marker inserted where repetitions are removed. Default: '[inaudible]' */
  gapMarker: string;
}

export interface ChunkType {
  index: number;
  startTime: number;
  endTime: number;
  duration: number;
  words: number;
  confidence: number;
  merged: boolean;
  text: string;
}

export interface Detection {
  type: 'ngram_repetition' | 'stutter' | 'word_rate_anomaly';
  phrase: string;
  count: number;
  wordsRemoved: number;
}

export interface ChunkCleanResult {
  cleanedText: string;
  originalWordCount: number;
  cleanedWordCount: number;
  wordsRemoved: number;
  wasCleaned: boolean;
  detections: Detection[];
}

export interface TranscriptCleanResult {
  chunks: ChunkType[];
  summary: {
    totalChunks: number;
    chunksAffected: number;
    totalWordsRemoved: number;
    percentReduction: number;
    detections: Detection[];
  };
}

export interface WhisperResponseCleanResult {
  text: string;
  confidence?: number;
  chunks?: ChunkType[];
  cleaningSummary: TranscriptCleanResult['summary'];
  [key: string]: unknown;
}

// ─── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: ChunkCleanerConfig = {
  minNgramLength: 4,
  maxNgramLength: 20,
  repetitionThreshold: 3,
  wordRateThreshold: 4.5,
  stutterThreshold: 4,
  lowConfidenceThreshold: 0.25,
  gapMarker: '[inaudible]',
};

// ─── Layer 1: N-gram repetition detection ──────────────────────────────────────

/**
 * Scans for any phrase of `minN`–`maxN` words that repeats `threshold`+ times
 * consecutively. Keeps the first occurrence, replaces the rest with gapMarker.
 * Works from longest n-grams down to shortest (greedy).
 * After each removal, re-scans since positions shift.
 */
function removeNgramRepetitions(
  text: string,
  minN: number,
  maxN: number,
  threshold: number,
  gapMarker: string
): { text: string; detections: Detection[] } {
  const detections: Detection[] = [];
  let current = text;

  // Work from longest to shortest for greedy matching
  for (let n = maxN; n >= minN; n--) {
    let changed = true;
    while (changed) {
      changed = false;
      const words = current.split(/\s+/);
      if (words.length < n * threshold) break;

      // Build normalised n-grams with positions
      for (let i = 0; i <= words.length - n; i++) {
        const gram = words.slice(i, i + n).map(w => w.toLowerCase().replace(/[^a-z0-9']/g, '')).join(' ');
        
        // Count consecutive repetitions starting at position i
        let consecutiveCount = 1;
        let j = i + n;
        while (j + n <= words.length) {
          const nextGram = words.slice(j, j + n).map(w => w.toLowerCase().replace(/[^a-z0-9']/g, '')).join(' ');
          if (nextGram === gram) {
            consecutiveCount++;
            j += n;
          } else {
            break;
          }
        }

        if (consecutiveCount >= threshold) {
          // Keep the first occurrence, replace the rest with gap marker
          const originalPhrase = words.slice(i, i + n).join(' ');
          const wordsToRemove = (consecutiveCount - 1) * n;
          
          // Build replacement: keep first n words, replace rest with marker
          const before = words.slice(0, i + n);
          const after = words.slice(i + n * consecutiveCount);
          current = [...before, gapMarker, ...after].join(' ');

          detections.push({
            type: 'ngram_repetition',
            phrase: originalPhrase,
            count: consecutiveCount,
            wordsRemoved: wordsToRemove,
          });

          changed = true;
          break; // Re-scan from scratch after modification
        }
      }
    }
  }

  return { text: current, detections };
}

// ─── Layer 2: Single-word stutter detection ────────────────────────────────────

/**
 * Detects any single word (with optional punctuation) repeated `threshold`+
 * consecutive times. Collapses to one instance.
 * Catches patterns like "Yeah. Yeah. Yeah. Yeah." runs.
 */
function removeStutters(
  text: string,
  threshold: number
): { text: string; detections: Detection[] } {
  const detections: Detection[] = [];
  
  // Match word (with optional trailing punctuation) repeated threshold+ times
  // Pattern: captures (word + optional punct + space) repeated
  const regex = new RegExp(
    `(\\b(\\w+[.!?,;:]?)\\s+)\\2{${threshold - 1},}`,
    'gi'
  );

  const result = text.replace(regex, (match, _group1, word) => {
    const parts = match.trim().split(/\s+/);
    const count = parts.length;
    if (count >= threshold) {
      detections.push({
        type: 'stutter',
        phrase: word,
        count,
        wordsRemoved: count - 1,
      });
      return word + ' ';
    }
    return match;
  });

  return { text: result.trim(), detections };
}

// ─── Layer 3: Word-rate anomaly flagging ───────────────────────────────────────

/**
 * If a chunk exceeds `wordRateThreshold` words per second, flag as suspicious.
 * Informational only — the other two detectors do the actual removal.
 */
function checkWordRate(
  text: string,
  durationSeconds: number,
  wordRateThreshold: number
): Detection | null {
  if (durationSeconds <= 0) return null;
  
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const wps = wordCount / durationSeconds;
  
  if (wps > wordRateThreshold) {
    return {
      type: 'word_rate_anomaly',
      phrase: `${wps.toFixed(1)} words/sec (threshold: ${wordRateThreshold})`,
      count: 1,
      wordsRemoved: 0, // Informational only
    };
  }
  return null;
}

// ─── Exported Functions ────────────────────────────────────────────────────────

/**
 * Clean a single Whisper chunk, removing repetition loops and stutters.
 */
export function cleanWhisperChunk(
  chunk: ChunkType,
  config?: Partial<ChunkCleanerConfig>
): ChunkCleanResult {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const allDetections: Detection[] = [];
  const originalWordCount = chunk.text.split(/\s+/).filter(Boolean).length;

  // Adjust thresholds for low-confidence chunks
  const isLowConfidence = chunk.confidence < cfg.lowConfidenceThreshold;
  const effectiveRepThreshold = isLowConfidence ? Math.max(2, cfg.repetitionThreshold - 1) : cfg.repetitionThreshold;
  const effectiveStutterThreshold = isLowConfidence ? Math.max(3, cfg.stutterThreshold - 1) : cfg.stutterThreshold;

  if (isLowConfidence) {
    console.log(`🧹 Chunk ${chunk.index}: Low confidence (${(chunk.confidence * 100).toFixed(0)}%) — using aggressive thresholds`);
  }

  // Layer 1: N-gram repetition removal
  const ngramResult = removeNgramRepetitions(
    chunk.text,
    cfg.minNgramLength,
    cfg.maxNgramLength,
    effectiveRepThreshold,
    cfg.gapMarker
  );
  allDetections.push(...ngramResult.detections);

  // Layer 2: Single-word stutter removal
  const stutterResult = removeStutters(ngramResult.text, effectiveStutterThreshold);
  allDetections.push(...stutterResult.detections);

  // Layer 3: Word-rate anomaly flagging (informational)
  const durationSeconds = chunk.duration || (chunk.endTime - chunk.startTime) || 0;
  const rateDetection = checkWordRate(chunk.text, durationSeconds, cfg.wordRateThreshold);
  if (rateDetection) {
    allDetections.push(rateDetection);
  }

  // Clean up multiple consecutive gap markers and whitespace
  let cleanedText = stutterResult.text
    .replace(/(\[inaudible\]\s*){2,}/g, '[inaudible] ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  const cleanedWordCount = cleanedText.split(/\s+/).filter(w => w !== cfg.gapMarker && Boolean(w)).length;
  const wordsRemoved = originalWordCount - cleanedWordCount;

  return {
    cleanedText,
    originalWordCount,
    cleanedWordCount,
    wordsRemoved: Math.max(0, wordsRemoved),
    wasCleaned: allDetections.length > 0 && wordsRemoved > 0,
    detections: allDetections,
  };
}

/**
 * Clean all Whisper chunks in an array.
 */
export function cleanWhisperTranscript(
  chunks: ChunkType[],
  config?: Partial<ChunkCleanerConfig>
): TranscriptCleanResult {
  const allDetections: Detection[] = [];
  let totalWordsRemoved = 0;
  let totalOriginalWords = 0;
  let chunksAffected = 0;

  const cleanedChunks = chunks.map(chunk => {
    const result = cleanWhisperChunk(chunk, config);
    totalOriginalWords += result.originalWordCount;
    totalWordsRemoved += result.wordsRemoved;
    allDetections.push(...result.detections);
    if (result.wasCleaned) chunksAffected++;

    return {
      ...chunk,
      text: result.cleanedText,
      words: result.cleanedWordCount,
    };
  });

  return {
    chunks: cleanedChunks,
    summary: {
      totalChunks: chunks.length,
      chunksAffected,
      totalWordsRemoved,
      percentReduction: totalOriginalWords > 0
        ? Math.round((totalWordsRemoved / totalOriginalWords) * 100)
        : 0,
      detections: allDetections,
    },
  };
}

/**
 * Wrapper that accepts the full Whisper response object and returns it
 * with cleaned chunks plus a cleaningSummary property.
 * 
 * Works with both chunked responses (response.chunks) and single-text
 * responses (response.text).
 */
export function cleanWhisperResponse(
  response: Record<string, any>,
  config?: Partial<ChunkCleanerConfig>
): WhisperResponseCleanResult {
  // If response has chunks array, clean each
  if (response.chunks && Array.isArray(response.chunks) && response.chunks.length > 0) {
    const result = cleanWhisperTranscript(response.chunks, config);
    
    if (result.summary.totalWordsRemoved > 0) {
      console.log(
        `🧹 Whisper Chunk Cleaner: ${result.summary.chunksAffected}/${result.summary.totalChunks} chunks cleaned, ` +
        `${result.summary.totalWordsRemoved} words removed (${result.summary.percentReduction}% reduction)`
      );
      result.summary.detections.forEach(d => {
        if (d.type !== 'word_rate_anomaly') {
          console.log(`  └─ ${d.type}: "${d.phrase}" ×${d.count} (−${d.wordsRemoved} words)`);
        }
      });
    }

    // Reconstruct full text from cleaned chunks
    const cleanedFullText = result.chunks.map(c => c.text).join(' ').trim();

    return {
      ...response,
      text: cleanedFullText,
      chunks: result.chunks,
      cleaningSummary: result.summary,
    };
  }

  // Single-text response — wrap as a single chunk and clean
  if (response.text && typeof response.text === 'string') {
    const syntheticChunk: ChunkType = {
      index: 0,
      startTime: 0,
      endTime: response.duration || 0,
      duration: response.duration || 0,
      words: response.text.split(/\s+/).filter(Boolean).length,
      confidence: response.confidence ?? 0.5,
      merged: false,
      text: response.text,
    };

    const result = cleanWhisperChunk(syntheticChunk, config);

    if (result.wasCleaned) {
      console.log(
        `🧹 Whisper Chunk Cleaner (single): ${result.wordsRemoved} words removed ` +
        `(${result.originalWordCount} → ${result.cleanedWordCount})`
      );
    }

    return {
      ...response,
      text: result.cleanedText,
      cleaningSummary: {
        totalChunks: 1,
        chunksAffected: result.wasCleaned ? 1 : 0,
        totalWordsRemoved: result.wordsRemoved,
        percentReduction: result.originalWordCount > 0
          ? Math.round((result.wordsRemoved / result.originalWordCount) * 100)
          : 0,
        detections: result.detections,
      },
    };
  }

  // Nothing to clean
  return {
    ...response,
    text: response.text || '',
    cleaningSummary: {
      totalChunks: 0,
      chunksAffected: 0,
      totalWordsRemoved: 0,
      percentReduction: 0,
      detections: [],
    },
  };
}
