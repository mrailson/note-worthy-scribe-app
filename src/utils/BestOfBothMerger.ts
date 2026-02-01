/**
 * Best-of-Both Transcript Merger
 * 
 * Deterministic, fast, auditable algorithm for merging dual transcription sources
 * (Whisper batch + AssemblyAI live) into a single high-quality transcript.
 * 
 * Key principles:
 * - AssemblyAI-first for overlaps (more complete coverage)
 * - Whisper used for high-confidence corrections
 * - Winner-takes-all on overlaps (no blending)
 * - Synthetic timeline for Whisper (ignore unreliable timestamps)
 * - Confidence floor for Whisper chunks
 */

export type Engine = 'assembly' | 'whisper';

export interface RawChunk {
  engine: Engine;
  idx: number;               // Monotonic per engine or global
  text: string;
  confidence?: number;       // Whisper avg confidence 0..1 or 0..100 (normalised)
  startSec?: number;         // Use only for assembly if available
  endSec?: number;
}

export interface NormChunk {
  engine: Engine;
  idx: number;
  startSec: number;          // Synthetic if whisper
  endSec: number;            // Synthetic if whisper
  text: string;
  conf: number;              // Normalised 0..1
  tokens: string[];          // Cached for similarity
}

export interface MergeConfig {
  chunkDurationSec: number;      // e.g. 15
  overlapSec: number;            // e.g. 1.5 (capture overlap; merge handles duplicates)
  whisperConfFloor: number;      // e.g. 0.30
  overlapSimilarity: number;     // e.g. 0.60 (winner-takes-all threshold)
  strongConfMargin: number;      // e.g. 0.12 (how much higher to override assembly-first)
  maxLookback: number;           // e.g. 3 (how many recent chunks to consider for overlap)
  continuityMinSim: number;      // e.g. 0.10 (minimum similarity for non-overlapping chunks)
  bufferWindow: number;          // e.g. 4 (how many chunks to hold in buffer)
}

export interface MergeResult {
  transcript: string;
  kept: NormChunk[];
  dropped: NormChunk[];
  stats: {
    whisperChunks: number;
    assemblyChunks: number;
    keptCount: number;
    droppedCount: number;
    overlapConflicts: number;
    bufferedDrops: number;
  };
}

export const DEFAULT_MERGE_CONFIG: MergeConfig = {
  chunkDurationSec: 15,
  overlapSec: 1.5,
  whisperConfFloor: 0.30,
  overlapSimilarity: 0.60,
  strongConfMargin: 0.12,
  maxLookback: 3,
  continuityMinSim: 0.10,
  bufferWindow: 4,
};

/* ----------------------- Utilities ----------------------- */

function normaliseConfidence(engine: Engine, confidence?: number): number {
  if (engine === 'assembly') return 0.80; // Default for assembly if not provided
  if (confidence == null) return 0.0;
  // Handle either 0..1 or 0..100 inputs
  if (confidence > 1) return Math.max(0, Math.min(1, confidence / 100));
  return Math.max(0, Math.min(1, confidence));
}

function normaliseText(s: string): string {
  return (s || '')
    .replace(/\s+/g, ' ')
    .replace(/[""]/g, '"')  // Smart double quotes → straight
    .replace(/['']/g, "'")  // Smart single quotes → straight
    .trim();
}

function tokenise(s: string): string[] {
  // Cheap tokeniser; avoid heavy NLP
  return normaliseText(s)
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Jaccard similarity for token sets.
 * Fast + robust enough for overlap detection.
 */
function jaccardSim(aTokens: string[], bTokens: string[]): number {
  if (!aTokens.length || !bTokens.length) return 0;
  const a = new Set(aTokens);
  const b = new Set(bTokens);
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

/**
 * Heuristic: "does it look like a complete sentence boundary?"
 */
function endsCleanly(text: string): boolean {
  return /[.!?]["')\]]?\s*$/.test(text.trim());
}

function startsCleanly(text: string): boolean {
  // Starts with capital letter, quote, bracket, or common filler
  return /^["'(\[]?[A-Z]|^(and|but|so|because|then)\b/i.test(text.trim());
}

/**
 * Detect if text ends with a hanging fragment (unfinished clause).
 * Used to require stronger continuity before splicing new content.
 */
function looksLikeHangingFragment(text: string): boolean {
  const t = text.trim();
  // Ends with a conjunction / comma / unfinished word
  return /[,;:\-]\s*$/.test(t) || /\b(and|but|so|because|that|which|who)\s*$/i.test(t);
}

function scoreChunk(c: NormChunk): number {
  // Higher is better. Tune weights if needed.
  const len = Math.min(1, c.tokens.length / 40); // Saturate around 40 tokens
  const endBonus = endsCleanly(c.text) ? 0.08 : 0;
  const startBonus = startsCleanly(c.text) ? 0.04 : 0;
  return (c.conf * 0.75) + (len * 0.15) + endBonus + startBonus;
}

/**
 * Calculate continuity similarity against recent chunks.
 * Uses best match from recent window (not just last, since last could be short).
 */
function continuitySimAgainstRecent(recent: NormChunk[], chunk: NormChunk): number {
  if (!recent.length) return 1; // No context = allow through
  let best = 0;
  for (const r of recent) {
    const sim = jaccardSim(r.tokens, chunk.tokens);
    if (sim > best) best = sim;
  }
  return best;
}

/* ----------------------- Normalisation ----------------------- */

/**
 * Create a stable timeline:
 *  - Whisper: synthetic based on idx * chunkDurationSec
 *  - Assembly: use provided start/end if present, otherwise same synthetic approach
 */
function normaliseChunks(raw: RawChunk[], cfg: MergeConfig): NormChunk[] {
  return raw
    .map(r => {
      const text = normaliseText(r.text);
      const conf = normaliseConfidence(r.engine, r.confidence);
      const syntheticStart = r.idx * cfg.chunkDurationSec;
      const syntheticEnd = syntheticStart + cfg.chunkDurationSec;
      const startSec =
        (r.engine === 'assembly' && r.startSec != null) ? r.startSec : syntheticStart;
      const endSec =
        (r.engine === 'assembly' && r.endSec != null) ? r.endSec : syntheticEnd;
      return {
        engine: r.engine,
        idx: r.idx,
        startSec,
        endSec,
        text,
        conf,
        tokens: tokenise(text),
      };
    })
    .filter(c => c.text.length > 0);
}

/* ----------------------- Overlap helpers ----------------------- */

function timeOverlaps(a: NormChunk, b: NormChunk, cfg: MergeConfig): boolean {
  // Allow slight tolerance due to synthetic timings / capture overlap
  const tol = Math.max(0.5, cfg.overlapSec); // seconds
  return !(a.endSec < b.startSec - tol || b.endSec < a.startSec - tol);
}

function findBestOverlapCandidate(
  recent: NormChunk[],
  chunk: NormChunk,
  cfg: MergeConfig
): NormChunk | null {
  let best: NormChunk | null = null;
  let bestSim = 0;
  for (const r of recent) {
    // Only consider if time overlaps or very close
    if (!timeOverlaps(r, chunk, cfg)) continue;
    const sim = jaccardSim(r.tokens, chunk.tokens);
    if (sim >= cfg.overlapSimilarity && sim > bestSim) {
      best = r;
      bestSim = sim;
    }
  }
  return best;
}

/**
 * Assembly-first policy:
 *  - If overlap exists, prefer assembly unless whisper is meaningfully better (score margin)
 *  - Otherwise, choose by chunk score
 */
function chooseWinner(a: NormChunk, b: NormChunk, cfg: MergeConfig): NormChunk {
  // Enforce assembly-first on overlaps
  const aScore = scoreChunk(a);
  const bScore = scoreChunk(b);

  // If one is assembly and the other whisper:
  if (a.engine !== b.engine) {
    const assembly = a.engine === 'assembly' ? a : b;
    const whisper = a.engine === 'whisper' ? a : b;
    const assemblyScore = assembly.engine === a.engine ? aScore : bScore;
    const whisperScore = whisper.engine === a.engine ? aScore : bScore;

    // Keep assembly unless whisper clearly better
    if (whisperScore >= assemblyScore + cfg.strongConfMargin) {
      return whisper;
    }
    return assembly;
  }

  // Same engine: score decides
  return bScore > aScore ? b : a;
}

/* ----------------------- Core merge logic ----------------------- */

/**
 * "Best-of-both" merge:
 *  - Build a single sequence ordered by time (prefer assembly timings when available)
 *  - Resolve overlaps by winner-takes-all (no blending)
 *  - Default preference: AssemblyAI for overlaps
 *  - Whisper chunks below confidence floor are only used when there is no overlapping Assembly
 */
export function mergeBestOfBoth(
  whisperRaw: RawChunk[],
  assemblyRaw: RawChunk[],
  cfg: MergeConfig = DEFAULT_MERGE_CONFIG
): MergeResult {
  const whisper = normaliseChunks(whisperRaw, cfg)
    .sort((a, b) => a.idx - b.idx);

  const assembly = normaliseChunks(assemblyRaw, cfg)
    .sort((a, b) => (a.startSec - b.startSec) || (a.idx - b.idx));

  // Combine into a single stream sorted by start time then engine preference
  const combined = [...assembly, ...whisper].sort((a, b) => {
    const t = a.startSec - b.startSec;
    if (t !== 0) return t;
    // Tie-break: assembly first
    if (a.engine !== b.engine) return a.engine === 'assembly' ? -1 : 1;
    return a.idx - b.idx;
  });

  const kept: NormChunk[] = [];
  const dropped: NormChunk[] = [];
  const buffer: NormChunk[] = []; // Hold non-contiguous chunks for later placement
  let overlapConflicts = 0;
  let bufferedDrops = 0;

  for (const chunk of combined) {
    // If whisper below floor, only consider keeping if there is no close assembly overlap.
    if (chunk.engine === 'whisper' && chunk.conf < cfg.whisperConfFloor) {
      const hasAssemblyNear = kept
        .slice(-cfg.maxLookback)
        .some(k =>
          k.engine === 'assembly' &&
          timeOverlaps(k, chunk, cfg) &&
          jaccardSim(k.tokens, chunk.tokens) >= 0.25 // Low bar: "near the same bit"
        );
      if (hasAssemblyNear) {
        dropped.push(chunk);
        continue;
      }
      // Else allow through (fallback coverage)
    }

    // Compare against recent kept chunks for overlaps
    const recent = kept.slice(-cfg.maxLookback);
    const overlapCandidate = findBestOverlapCandidate(recent, chunk, cfg);

    if (!overlapCandidate) {
      // No overlap detected - check continuity before accepting
      const contSim = continuitySimAgainstRecent(recent, chunk);
      
      // Check if last kept chunk ends with a hanging fragment
      const last = kept[kept.length - 1];
      const hangingThreshold = last && looksLikeHangingFragment(last.text)
        ? cfg.continuityMinSim * 1.8  // Require stronger continuity after fragments
        : cfg.continuityMinSim;
      
      // If it's not overlapping but also not continuous, buffer it
      if (recent.length > 0 && contSim < hangingThreshold) {
        buffer.push(chunk);
        // Prevent unbounded buffer - drop oldest if full
        if (buffer.length > cfg.bufferWindow) {
          const oldest = buffer.shift()!;
          dropped.push(oldest);
          bufferedDrops++;
        }
        continue;
      }
      
      // Accept the chunk
      kept.push(chunk);
      
      // Attempt to place buffered chunks that now look continuous
      for (let i = buffer.length - 1; i >= 0; i--) {
        const b = buffer[i];
        const sim = continuitySimAgainstRecent(kept.slice(-cfg.maxLookback), b);
        if (sim >= cfg.continuityMinSim) {
          kept.push(b);
          buffer.splice(i, 1);
        }
      }
      continue;
    }

    overlapConflicts++;

    // Winner-takes-all decision between chunk and overlapCandidate
    const winner = chooseWinner(overlapCandidate, chunk, cfg);
    if (winner === overlapCandidate) {
      // Keep existing, drop new
      dropped.push(chunk);
    } else {
      // Replace the overlap candidate with new chunk
      const idx = kept.lastIndexOf(overlapCandidate);
      if (idx >= 0) kept.splice(idx, 1, chunk);
      else kept.push(chunk);
      dropped.push(overlapCandidate);
    }
  }

  // Anything left buffered is likely non-contiguous boilerplate; drop it
  for (const b of buffer) {
    dropped.push(b);
    bufferedDrops++;
  }

  // Sort kept by time again (in case replacements changed local ordering)
  kept.sort((a, b) => (a.startSec - b.startSec) || (a.engine === 'assembly' ? -1 : 1));

  // Assemble transcript with minimal join punctuation handling
  const transcript = postProcessTranscript(
    kept.map(k => k.text).join(' '),
  );

  return {
    transcript,
    kept,
    dropped,
    stats: {
      whisperChunks: whisperRaw.length,
      assemblyChunks: assemblyRaw.length,
      keptCount: kept.length,
      droppedCount: dropped.length,
      overlapConflicts,
      bufferedDrops,
    }
  };
}

/* ----------------------- Post-processing (regex-only) ----------------------- */

function postProcessTranscript(s: string): string {
  let out = (s || '').replace(/\s+/g, ' ').trim();

  // Fix the classic "Cambridge. are" => "Cambridge. Are"
  out = out.replace(/([.!?])\s+([a-z])/g, (_, p1, p2) => `${p1} ${p2.toUpperCase()}`);

  // Remove duplicated common words only (safer - won't break "had had", "that that")
  // Only dedupe short common words that are clearly accidental repeats
  out = out.replace(/\b(the|a|an|and|but|so|we|i|you|is|are|was|were|to|of|in|on|for|it)\s+\1\b/gi, '$1');

  // Clean " ,"
  out = out.replace(/\s+,/g, ',').replace(/\s+\./g, '.');

  // Ensure ellipses spacing
  out = out.replace(/\.{3,}\s*/g, '... ');

  return out.trim();
}

/* ----------------------- Convenience: Build RawChunks from DB records ----------------------- */

/**
 * Convert database chunk records to RawChunk format for the merger.
 * Handles both Whisper and AssemblyAI source types.
 */
export function dbChunksToRawChunks(
  chunks: Array<{
    chunk_number: number;
    transcription_text: string;
    confidence_score?: number | null;
    source?: string | null;
    start_time?: string | null;
    end_time?: string | null;
  }>
): { whisper: RawChunk[]; assembly: RawChunk[] } {
  const whisper: RawChunk[] = [];
  const assembly: RawChunk[] = [];

  for (const chunk of chunks) {
    // Parse text - might be JSON segments or plain text
    let text = chunk.transcription_text || '';
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        text = parsed.map((seg: any) => seg.text || '').join(' ');
      }
    } catch {
      // Not JSON, use as-is
    }

    const rawChunk: RawChunk = {
      engine: chunk.source === 'assembly' ? 'assembly' : 'whisper',
      idx: chunk.chunk_number,
      text,
      confidence: chunk.confidence_score ?? undefined,
    };

    // Add timing for assembly if available
    if (chunk.source === 'assembly' && chunk.start_time) {
      try {
        const startDate = new Date(chunk.start_time);
        rawChunk.startSec = startDate.getTime() / 1000;
        if (chunk.end_time) {
          const endDate = new Date(chunk.end_time);
          rawChunk.endSec = endDate.getTime() / 1000;
        }
      } catch {
        // Ignore timing parse errors
      }
    }

    if (rawChunk.engine === 'assembly') {
      assembly.push(rawChunk);
    } else {
      whisper.push(rawChunk);
    }
  }

  return { whisper, assembly };
}
