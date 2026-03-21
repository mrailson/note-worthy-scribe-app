/**
 * Whisper Hallucination Detector v2 for Notewell AI
 * ===================================================
 * Adaptive post-processing utility that self-calibrates to session
 * audio quality rather than using fixed thresholds.
 *
 * Changes from v1:
 * - Confidence floor is now a session percentile, not a fixed value
 * - Word count cap scales to session median speaking rate
 * - Domain vocabulary skip-list exempts expected meeting repetition
 * - N-gram detection requires consecutive repetition (loop pattern)
 *   rather than just frequency across the chunk
 *
 * Drop into your transcription merge pipeline after Whisper chunks
 * are returned but before the three-way merge runs.
 */

// --- Configuration -----------------------------------------------------------

export interface HallucinationConfig {
  /**
   * Minimum n-gram size to check for repetition loops (words).
   * Default: 6
   */
  ngramSize: number;

  /**
   * Max times a non-domain n-gram can appear before flagging.
   * Default: 3 (raised from 2 — allows natural re-statement)
   */
  maxRepetitions: number;

  /**
   * Confidence percentile within the session. Chunks below this
   * percentile are flagged for review (not auto-substituted).
   * E.g. 0.15 = bottom 15% of the session's own confidence scores.
   * Default: 0.15
   */
  confidencePercentile: number;

  /**
   * Hard confidence floor. Only used when session stats can't be
   * computed (e.g. single-chunk edge case). Default: 0.08 (8%)
   */
  confidenceHardFloor: number;

  /**
   * Ratio of repeated content to total that triggers a flag.
   * Default: 0.40 (raised from 0.30 — less aggressive)
   */
  repetitionRatioThreshold: number;

  /**
   * Word count multiplier over session median. Chunks exceeding
   * median × this value are flagged. Default: 1.8
   */
  wordCountMultiplier: number;

  /**
   * Minimum consecutive occurrences of the same n-gram to count as
   * a loop pattern (vs scattered natural repetition). Default: 2
   */
  minConsecutiveRepeats: number;

  /**
   * Meeting title / topic keywords. Auto-populated from session
   * metadata. These are excluded from n-gram counting.
   */
  domainKeywords: string[];
}

const DEFAULT_CONFIG: HallucinationConfig = {
  ngramSize: 6,
  maxRepetitions: 3,
  confidencePercentile: 0.15,
  confidenceHardFloor: 0.08,
  repetitionRatioThreshold: 0.40,
  wordCountMultiplier: 1.8,
  minConsecutiveRepeats: 2,
  domainKeywords: [],
};

/**
 * Common business / meeting phrases that naturally repeat.
 * Merged with user-supplied domainKeywords at runtime.
 */
const BUILT_IN_SKIP_PHRASES: string[] = [
  "insurance program",
  "insurance programme",
  "insurance market",
  "insurance strategy",
  "insurance premiums",
  "balance sheet",
  "risk management",
  "risk transfer",
  "building consenting",
  "material damage",
  "business interruption",
  "professional indemnity",
  "loss limit",
  "cost benefit",
  "local authorities",
  "local authority",
  "deductible",
  "premium",
  "renewal",
  "council",
  "exposure",
  "capacity",
  "reinsurance",
  "claims history",
  "asset selection",
  "enterprise risk",
  "natural disaster",
  "weather events",
  "catastrophe losses",
];

// --- Types -------------------------------------------------------------------

export interface TranscriptionChunk {
  index: number;
  startTime: string;
  endTime: string;
  text: string;
  confidence: number;
  wordCount: number;
}

export interface SessionStats {
  medianConfidence: number;
  confidenceFloor: number;
  medianWordCount: number;
  wordCountCap: number;
  totalChunks: number;
  avgConfidence: number;
}

export interface HallucinationResult {
  isHallucinated: boolean;
  severity: "high" | "medium" | "low" | "none";
  reasons: string[];
  repeatedPhrases: { phrase: string; count: number; isLoop: boolean }[];
  action: "substitute" | "review" | "keep";
  cleanedText: string;
  repetitionRatio: number;
}

interface AlternativeSource {
  engine: "assemblyai" | "deepgram";
  text: string;
  confidence?: number;
}

// --- Session Statistics ------------------------------------------------------

/**
 * Computes adaptive thresholds from the full set of chunks in a session.
 * Call once per session, then pass the result to detectHallucination().
 */
export function computeSessionStats(
  chunks: TranscriptionChunk[],
  config: Partial<HallucinationConfig> = {}
): SessionStats {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  const confidences = chunks.map((c) => c.confidence).sort((a, b) => a - b);
  const wordCounts = chunks.map((c) => c.wordCount).sort((a, b) => a - b);

  const medianConfidence = percentile(confidences, 0.5);
  const confidenceFloor = Math.max(
    percentile(confidences, cfg.confidencePercentile),
    cfg.confidenceHardFloor
  );

  const medianWordCount = percentile(wordCounts, 0.5);
  const wordCountCap = Math.round(medianWordCount * cfg.wordCountMultiplier);

  const avgConfidence =
    confidences.reduce((a, b) => a + b, 0) / confidences.length;

  return {
    medianConfidence,
    confidenceFloor,
    medianWordCount,
    wordCountCap,
    totalChunks: chunks.length,
    avgConfidence,
  };
}

// --- Core Detection ----------------------------------------------------------

/**
 * Detects repetition-loop hallucinations in a single Whisper chunk,
 * using session-adaptive thresholds.
 *
 * @param chunkText       - Raw transcribed text from a single Whisper chunk
 * @param chunkConfidence - Whisper's reported confidence (0-1)
 * @param chunkWordCount  - Word count for this chunk
 * @param sessionStats    - Pre-computed session statistics from computeSessionStats()
 * @param config          - Optional config overrides
 */
export function detectHallucination(
  chunkText: string,
  chunkConfidence: number,
  chunkWordCount: number,
  sessionStats: SessionStats,
  config: Partial<HallucinationConfig> = {}
): HallucinationResult {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const reasons: string[] = [];
  const repeatedPhrases: HallucinationResult["repeatedPhrases"] = [];
  let severity: HallucinationResult["severity"] = "none";

  const words = chunkText.trim().split(/\s+/);
  const wordCount = words.length;

  // Build the combined skip-list (domain + built-in)
  const skipPhrases = new Set(
    [...BUILT_IN_SKIP_PHRASES, ...cfg.domainKeywords].map((p) =>
      p.toLowerCase()
    )
  );

  // --- Check 1: Consecutive n-gram loop detection ---
  const { loops, scatteredRepeats, loopWordCount } = detectNgramLoops(
    words,
    cfg.ngramSize,
    cfg.minConsecutiveRepeats,
    cfg.maxRepetitions,
    skipPhrases
  );

  for (const loop of loops) {
    repeatedPhrases.push({ ...loop, isLoop: true });
  }
  for (const rep of scatteredRepeats) {
    repeatedPhrases.push({ ...rep, isLoop: false });
  }

  const repetitionRatio = wordCount > 0 ? loopWordCount / wordCount : 0;

  if (repetitionRatio > cfg.repetitionRatioThreshold) {
    reasons.push(
      `Loop repetition ratio ${(repetitionRatio * 100).toFixed(0)}% exceeds ` +
        `threshold of ${(cfg.repetitionRatioThreshold * 100).toFixed(0)}%`
    );
    severity = "high";
  }

  // --- Check 2: Adaptive confidence floor ---
  if (chunkConfidence < sessionStats.confidenceFloor) {
    reasons.push(
      `Chunk confidence ${(chunkConfidence * 100).toFixed(0)}% is below ` +
        `session floor of ${(sessionStats.confidenceFloor * 100).toFixed(0)}% ` +
        `(p${(cfg.confidencePercentile * 100).toFixed(0)} of this session)`
    );
    if (severity === "none") severity = "low";
  }

  // --- Check 3: Adaptive word count ---
  if (chunkWordCount > sessionStats.wordCountCap) {
    reasons.push(
      `Word count ${chunkWordCount} exceeds session cap of ` +
        `${sessionStats.wordCountCap} ` +
        `(${cfg.wordCountMultiplier}× median of ${sessionStats.medianWordCount})`
    );
    if (severity === "none") severity = "low";
    else if (severity === "low") severity = "medium";
  }

  // --- Check 4: Known Whisper hallucination phrases ---
  const knownHallucinations = detectKnownPhrases(chunkText);
  if (knownHallucinations.length > 0) {
    reasons.push(
      `Contains known Whisper hallucination phrase(s): ` +
        `${knownHallucinations.join(", ")}`
    );
    if (severity === "none") severity = "low";
  }

  // --- Determine action ---
  const isHallucinated = severity === "high";
  let action: HallucinationResult["action"] = "keep";
  if (severity === "high") action = "substitute";
  else if (severity === "medium") action = "review";

  // --- Clean the text (only remove confirmed loops) ---
  const cleanedText =
    severity === "high"
      ? removeConsecutiveLoops(chunkText, cfg.ngramSize, cfg.minConsecutiveRepeats)
      : chunkText;

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

// --- N-gram Loop Detection ---------------------------------------------------

interface LoopResult {
  phrase: string;
  count: number;
}

/**
 * Detects CONSECUTIVE n-gram repetition (the hallucination loop pattern)
 * separately from scattered repetition (natural re-statement).
 */
function detectNgramLoops(
  words: string[],
  ngramSize: number,
  minConsecutive: number,
  maxScattered: number,
  skipPhrases: Set<string>
): {
  loops: LoopResult[];
  scatteredRepeats: LoopResult[];
  loopWordCount: number;
} {
  const normalised = words.map((w) =>
    w.toLowerCase().replace(/[^a-z0-9']/g, "")
  );

  // Track positions of each n-gram
  const positions = new Map<string, number[]>();
  for (let i = 0; i <= normalised.length - ngramSize; i++) {
    const gram = normalised.slice(i, i + ngramSize).join(" ");

    // Skip domain phrases
    if (isDomainPhrase(gram, skipPhrases)) continue;

    if (!positions.has(gram)) positions.set(gram, []);
    positions.get(gram)!.push(i);
  }

  const loops: LoopResult[] = [];
  const scatteredRepeats: LoopResult[] = [];
  let loopWordCount = 0;

  for (const [phrase, pos] of positions.entries()) {
    if (pos.length <= 1) continue;

    // Count consecutive occurrences (positions within ngramSize*1.5 of each other)
    let maxConsecutiveRun = 1;
    let currentRun = 1;
    const threshold = Math.ceil(ngramSize * 1.5);

    for (let i = 1; i < pos.length; i++) {
      if (pos[i] - pos[i - 1] <= threshold) {
        currentRun++;
        maxConsecutiveRun = Math.max(maxConsecutiveRun, currentRun);
      } else {
        currentRun = 1;
      }
    }

    if (maxConsecutiveRun >= minConsecutive) {
      loops.push({ phrase, count: pos.length });
      loopWordCount += (pos.length - 1) * ngramSize;
    } else if (pos.length > maxScattered) {
      scatteredRepeats.push({ phrase, count: pos.length });
    }
  }

  return { loops, scatteredRepeats, loopWordCount };
}

/**
 * Checks if an n-gram contains a domain skip-phrase.
 */
function isDomainPhrase(gram: string, skipPhrases: Set<string>): boolean {
  for (const skip of skipPhrases) {
    if (gram.includes(skip)) return true;
  }
  return false;
}

// --- Text Cleaning -----------------------------------------------------------

/**
 * Removes only consecutive repetition loops from text.
 * Keeps the first occurrence and strips back-to-back duplicates.
 */
function removeConsecutiveLoops(
  text: string,
  ngramSize: number,
  minConsecutive: number
): string {
  const words = text.trim().split(/\s+/);
  const normalised = words.map((w) =>
    w.toLowerCase().replace(/[^a-z0-9']/g, "")
  );
  const keep: boolean[] = new Array(words.length).fill(true);

  const threshold = Math.ceil(ngramSize * 1.5);
  let lastGram = "";
  let lastPos = -999;
  let consecutiveCount = 0;

  for (let i = 0; i <= normalised.length - ngramSize; i++) {
    const gram = normalised.slice(i, i + ngramSize).join(" ");

    if (gram === lastGram && i - lastPos <= threshold) {
      consecutiveCount++;
      if (consecutiveCount >= minConsecutive) {
        for (let j = i; j < i + ngramSize && j < words.length; j++) {
          keep[j] = false;
        }
      }
    } else {
      consecutiveCount = 1;
      lastGram = gram;
    }
    lastPos = i;
  }

  return words.filter((_, i) => keep[i]).join(" ");
}

// --- Known Phrases -----------------------------------------------------------

function detectKnownPhrases(text: string): string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];

  const KNOWN_PATTERNS = [
    "thank you for watching",
    "thanks for watching",
    "please subscribe",
    "like and subscribe",
    "subtitles by",
    "transcribed by",
    "translated by",
    "amara.org",
    "www.mooji.org",
    "music playing",
    "[music]",
  ];

  for (const pattern of KNOWN_PATTERNS) {
    if (lower.includes(pattern)) {
      found.push(`"${pattern}"`);
    }
  }

  // Special case: single word repeated as entire chunk
  const uniqueWords = new Set(lower.split(/\s+/).filter((w) => w.length > 0));
  const totalWords = lower.split(/\s+/).filter((w) => w.length > 0).length;
  if (uniqueWords.size <= 2 && totalWords > 10) {
    found.push(`single word repeated ${totalWords} times`);
  }

  return found;
}

// --- Utilities ---------------------------------------------------------------

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const index = p * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

// --- Pipeline Integration ----------------------------------------------------

/**
 * Processes all Whisper chunks through adaptive hallucination detection.
 * Main entry point for the Notewell merge pipeline.
 */
export function processWhisperChunks(
  whisperChunks: TranscriptionChunk[],
  getAlternative: (
    startTime: string,
    endTime: string
  ) => AlternativeSource | null,
  meetingTitle?: string,
  config: Partial<HallucinationConfig> = {}
): {
  chunks: (TranscriptionChunk & {
    source: string;
    hallucinationResult?: HallucinationResult;
  })[];
  summary: {
    totalChunks: number;
    substituted: number;
    flaggedForReview: number;
    kept: number;
    sessionStats: SessionStats;
  };
} {
  // Extract domain keywords from meeting title
  const titleKeywords = meetingTitle
    ? extractDomainKeywords(meetingTitle)
    : [];

  const mergedConfig = {
    ...config,
    domainKeywords: [
      ...(config.domainKeywords || []),
      ...titleKeywords,
    ],
  };

  // Step 1: Compute session-adaptive thresholds
  const sessionStats = computeSessionStats(whisperChunks, mergedConfig);

  // Step 2: Run detection on each chunk
  let substituted = 0;
  let flaggedForReview = 0;
  let kept = 0;

  const processed = whisperChunks.map((chunk) => {
    const result = detectHallucination(
      chunk.text,
      chunk.confidence,
      chunk.wordCount,
      sessionStats,
      mergedConfig
    );

    if (result.action === "substitute") {
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
        return {
          ...chunk,
          text: result.cleanedText,
          source: `whisper-cleaned (${result.reasons[0]})`,
          hallucinationResult: result,
        };
      }
    }

    if (result.action === "review") {
      flaggedForReview++;
      return {
        ...chunk,
        source: `whisper (review: ${result.reasons[0]})`,
        hallucinationResult: result,
      };
    }

    kept++;
    return { ...chunk, source: "whisper" };
  });

  return {
    chunks: processed,
    summary: {
      totalChunks: whisperChunks.length,
      substituted,
      flaggedForReview,
      kept,
      sessionStats,
    },
  };
}

/**
 * Extracts meaningful keywords from a meeting title for the domain skip-list.
 */
function extractDomainKeywords(title: string): string[] {
  const stopwords = new Set([
    "a", "an", "the", "and", "or", "of", "in", "to", "for", "with",
    "on", "at", "by", "from", "is", "are", "was", "were", "be", "been",
    "being", "have", "has", "had", "do", "does", "did", "will", "would",
    "could", "should", "may", "might", "shall", "can", "this", "that",
    "these", "those", "it", "its", "not", "no", "nor", "but", "so",
    "yet", "both", "each", "every", "all", "any", "few", "more", "most",
    "other", "some", "such", "than", "too", "very", "just", "about",
  ]);

  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !stopwords.has(w));
}
