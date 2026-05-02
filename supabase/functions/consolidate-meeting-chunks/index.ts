import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============= POST-MERGE DEDUP (inlined for Deno) =============

interface DedupDecision {
  i: number;
  action: 'DROP' | 'TRIM_START';
  reason_code: 'DUP_NEAR_EXACT' | 'DUP_BOUNDARY_OVERLAP' | 'DUP_ABA_REPEAT' | 'DEDUP_BLOCKED_CRITICAL_NEW_INFO';
  compared_to: number;
  jaccard: number;
  containment: number;
  overlap_tokens_removed?: number;
  critical_tokens_new?: string[];
  snippet: { prev: string; curr: string };
}

interface PostMergeDedupResult {
  segments: string[];
  decisions: DedupDecision[];
  stats: { inputCount: number; outputCount: number; dropped: number; trimmed: number; blockedByGuard: number };
}

interface NormSegment {
  raw: string;
  normTokens: string[];
  normString: string;
}

const JACCARD_THRESHOLD = 0.82;
const CONTAINMENT_THRESHOLD = 0.90;
const MIN_TOKEN_COUNT = 12;
const MAX_OVERLAP_TOKENS = 20;
const MIN_OVERLAP_TOKENS = 8;
const SNIPPET_LENGTH = 120;

const DIGIT_PATTERN = /\b\d+(\.\d+)?\b/g;
const MEDICATION_TOKENS = new Set(['mg','mcg','ml','od','bd','tds','prn','qds','stat','nocte','mane','tablet','tablets','capsule','capsules','inhaler','injection','patch','cream']);
const PATHWAY_TOKENS = new Set(['2ww','urgent','cardiology','ecg','troponin','dermatology','neurology','oncology','respiratory','gastroenterology','endoscopy','mri','ct','xray','x-ray','ultrasound','referral','pathway']);
const SAFEGUARDING_TOKENS = new Set(['harm','suicide','suicidal','self-harm','selfharm','999','a&e','ae','emergency','ambulance','safeguarding','abuse','neglect','risk','overdose','crisis']);

function dedupNormalise(text: string): NormSegment {
  const raw = text;
  let norm = text.toLowerCase().replace(/\s+/g, ' ').replace(/[^a-z0-9\s]/g, '').trim();
  const normForTokens = norm.replace(/\b\d+(\.\d+)?\b/g, '<NUM>');
  const normTokens = normForTokens.split(/\s+/).filter(Boolean);
  return { raw, normTokens, normString: norm };
}

function dedupTokenJaccard(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let inter = 0;
  for (const t of setA) if (setB.has(t)) inter++;
  const union = setA.size + setB.size - inter;
  return union === 0 ? 0 : inter / union;
}

function dedupContainment(a: string, b: string): number {
  if (!a.length || !b.length) return 0;
  const cAB = a.length <= b.length && b.includes(a) ? a.length / b.length : 0;
  const cBA = b.length <= a.length && a.includes(b) ? b.length / a.length : 0;
  return Math.max(cAB, cBA);
}

function extractCriticalTokens(text: string): Set<string> {
  const tokens = new Set<string>();
  const lower = text.toLowerCase();
  const digits = lower.match(DIGIT_PATTERN);
  if (digits) for (const d of digits) tokens.add(d);
  const words = lower.replace(/[^a-z0-9\s&-]/g, ' ').split(/\s+/);
  for (const w of words) {
    if (MEDICATION_TOKENS.has(w)) tokens.add(w);
    if (PATHWAY_TOKENS.has(w)) tokens.add(w);
    if (SAFEGUARDING_TOKENS.has(w)) tokens.add(w);
  }
  if (lower.includes('chest pain pathway')) tokens.add('chest pain pathway');
  if (lower.includes('a&e')) tokens.add('a&e');
  return tokens;
}

function dedupNewCritical(current: string, previous: string): string[] {
  const curr = extractCriticalTokens(current);
  const prev = extractCriticalTokens(previous);
  const result: string[] = [];
  for (const t of curr) if (!prev.has(t)) result.push(t);
  return result;
}

function dedupSnippet(text: string): string {
  return text.length <= SNIPPET_LENGTH ? text : text.substring(0, SNIPPET_LENGTH) + '...';
}

function dedupTryBoundaryTrim(current: NormSegment, previous: NormSegment): { trimmedText: string; tokensRemoved: number } | null {
  const prevRawTokens = previous.raw.split(/\s+/);
  const currRawTokens = current.raw.split(/\s+/);
  if (currRawTokens.length < MIN_OVERLAP_TOKENS || prevRawTokens.length < MIN_OVERLAP_TOKENS) return null;
  for (let n = Math.min(MAX_OVERLAP_TOKENS, previous.normTokens.length, current.normTokens.length); n >= MIN_OVERLAP_TOKENS; n--) {
    const tail = previous.normTokens.slice(-n);
    const head = current.normTokens.slice(0, n);
    let match = true;
    for (let j = 0; j < n; j++) { if (tail[j] !== head[j]) { match = false; break; } }
    if (match) {
      const trimmed = currRawTokens.slice(n);
      if (trimmed.length === 0) return null;
      return { trimmedText: trimmed.join(' '), tokensRemoved: n };
    }
  }
  return null;
}

function postMergeDedup(segments: string[]): PostMergeDedupResult {
  const decisions: DedupDecision[] = [];
  const stats = { inputCount: segments.length, outputCount: 0, dropped: 0, trimmed: 0, blockedByGuard: 0 };
  if (segments.length === 0) return { segments: [], decisions, stats };

  const normed = segments.map(dedupNormalise);
  const result: string[] = [];
  let prevKept: NormSegment | null = null;
  let prevPrevKept: NormSegment | null = null;
  let prevKeptIdx = -1;
  let prevPrevKeptIdx = -1;

  for (let i = 0; i < normed.length; i++) {
    const seg = normed[i];
    if (!seg.raw.trim()) continue;

    if (prevKept === null) {
      result.push(seg.raw);
      prevKept = seg;
      prevKeptIdx = i;
      continue;
    }

    const jaccard = dedupTokenJaccard(seg.normTokens, prevKept.normTokens);
    const containment = dedupContainment(seg.normString, prevKept.normString);
    const meetsJ = jaccard >= JACCARD_THRESHOLD && Math.min(seg.normTokens.length, prevKept.normTokens.length) >= MIN_TOKEN_COUNT;
    const meetsC = containment >= CONTAINMENT_THRESHOLD;

    if (meetsJ || meetsC) {
      const newCrit = dedupNewCritical(seg.raw, prevKept.raw);
      if (newCrit.length > 0) {
        const trim = dedupTryBoundaryTrim(seg, prevKept);
        if (trim) {
          result.push(trim.trimmedText);
          decisions.push({ i, action: 'TRIM_START', reason_code: 'DEDUP_BLOCKED_CRITICAL_NEW_INFO', compared_to: prevKeptIdx, jaccard, containment, overlap_tokens_removed: trim.tokensRemoved, critical_tokens_new: newCrit, snippet: { prev: dedupSnippet(prevKept.raw), curr: dedupSnippet(seg.raw) } });
          stats.trimmed++; stats.blockedByGuard++;
          prevPrevKept = prevKept; prevPrevKeptIdx = prevKeptIdx;
          prevKept = dedupNormalise(trim.trimmedText); prevKeptIdx = i;
        } else {
          result.push(seg.raw);
          decisions.push({ i, action: 'TRIM_START', reason_code: 'DEDUP_BLOCKED_CRITICAL_NEW_INFO', compared_to: prevKeptIdx, jaccard, containment, overlap_tokens_removed: 0, critical_tokens_new: newCrit, snippet: { prev: dedupSnippet(prevKept.raw), curr: dedupSnippet(seg.raw) } });
          stats.blockedByGuard++;
          prevPrevKept = prevKept; prevPrevKeptIdx = prevKeptIdx;
          prevKept = seg; prevKeptIdx = i;
        }
        continue;
      }
      decisions.push({ i, action: 'DROP', reason_code: 'DUP_NEAR_EXACT', compared_to: prevKeptIdx, jaccard, containment, snippet: { prev: dedupSnippet(prevKept.raw), curr: dedupSnippet(seg.raw) } });
      stats.dropped++;
      continue;
    }

    const trim = dedupTryBoundaryTrim(seg, prevKept);
    if (trim) {
      result.push(trim.trimmedText);
      decisions.push({ i, action: 'TRIM_START', reason_code: 'DUP_BOUNDARY_OVERLAP', compared_to: prevKeptIdx, jaccard, containment, overlap_tokens_removed: trim.tokensRemoved, snippet: { prev: dedupSnippet(prevKept.raw), curr: dedupSnippet(seg.raw) } });
      stats.trimmed++;
      prevPrevKept = prevKept; prevPrevKeptIdx = prevKeptIdx;
      prevKept = dedupNormalise(trim.trimmedText); prevKeptIdx = i;
      continue;
    }

    if (prevPrevKept !== null) {
      const abaJ = dedupTokenJaccard(seg.normTokens, prevPrevKept.normTokens);
      if (abaJ >= JACCARD_THRESHOLD && seg.normTokens.length >= MIN_TOKEN_COUNT) {
        const newCrit = dedupNewCritical(seg.raw, prevPrevKept.raw);
        if (newCrit.length > 0) {
          result.push(seg.raw);
          decisions.push({ i, action: 'TRIM_START', reason_code: 'DEDUP_BLOCKED_CRITICAL_NEW_INFO', compared_to: prevPrevKeptIdx, jaccard: abaJ, containment: 0, overlap_tokens_removed: 0, critical_tokens_new: newCrit, snippet: { prev: dedupSnippet(prevPrevKept.raw), curr: dedupSnippet(seg.raw) } });
          stats.blockedByGuard++;
          prevPrevKept = prevKept; prevPrevKeptIdx = prevKeptIdx;
          prevKept = seg; prevKeptIdx = i;
          continue;
        }
        decisions.push({ i, action: 'DROP', reason_code: 'DUP_ABA_REPEAT', compared_to: prevPrevKeptIdx, jaccard: abaJ, containment: 0, snippet: { prev: dedupSnippet(prevPrevKept.raw), curr: dedupSnippet(seg.raw) } });
        stats.dropped++;
        continue;
      }
    }

    result.push(seg.raw);
    prevPrevKept = prevKept; prevPrevKeptIdx = prevKeptIdx;
    prevKept = seg; prevKeptIdx = i;
  }

  stats.outputCount = result.length;
  return { segments: result, decisions, stats };
}

// ============= BEST-OF-ALL MERGER (Deno-compatible, 3-engine) =============

type Engine = 'assembly' | 'whisper' | 'deepgram';

interface RawChunk {
  engine: Engine;
  idx: number;
  text: string;
  confidence?: number;
  startSec?: number;
  endSec?: number;
}

interface NormChunk {
  engine: Engine;
  idx: number;
  startSec: number;
  endSec: number;
  text: string;
  conf: number;
  tokens: string[];
}

interface MergeConfig {
  chunkDurationSec: number;
  overlapSec: number;
  whisperConfFloor: number;
  overlapSimilarity: number;
  strongConfMargin: number;
  maxLookback: number;
  continuityMinSim: number;
  bufferWindow: number;
}

const DEFAULT_MERGE_CONFIG: MergeConfig = {
  chunkDurationSec: 90,
  overlapSec: 3,
  whisperConfFloor: 0.30,
  overlapSimilarity: 0.60,
  strongConfMargin: 0.12,
  maxLookback: 3,
  continuityMinSim: 0.10,
  bufferWindow: 4,
};

function getEngineTier(engine: Engine): number {
  if (engine === 'whisper') return 1;  // Batch = gold standard
  return 2; // assembly, deepgram = gap-fill
}

// Gap-fill similarity gate helper
function gapFillJaccard(candidateTokens: string[], whisperTokens: string[]): number {
  if (!candidateTokens.length || !whisperTokens.length) return 0;
  const a = new Set(candidateTokens);
  const b = new Set(whisperTokens);
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

function normaliseConfidence(engine: Engine, confidence?: number): number {
  if (engine === 'assembly') return 0.80;
  if (engine === 'deepgram') {
    if (confidence == null) return 0.75;
    if (confidence > 1) return Math.max(0, Math.min(1, confidence / 100));
    return Math.max(0, Math.min(1, confidence));
  }
  if (confidence == null) return 0.0;
  if (confidence > 1) return Math.max(0, Math.min(1, confidence / 100));
  return Math.max(0, Math.min(1, confidence));
}

function normaliseText(s: string): string {
  return (s || '').replace(/\s+/g, ' ').replace(/[""]/g, '"').replace(/['']/g, "'").trim();
}

function tokenise(s: string): string[] {
  // Strip speaker labels before tokenising so they don't affect similarity comparisons
  const stripped = normaliseText(s).replace(/\[speaker\s+[a-z0-9]+\]:\s*/gi, '');
  return stripped.toLowerCase().replace(/[^a-z0-9\s']/g, ' ').split(/\s+/).filter(Boolean);
}

function jaccardSim(aTokens: string[], bTokens: string[]): number {
  if (!aTokens.length || !bTokens.length) return 0;
  const a = new Set(aTokens);
  const b = new Set(bTokens);
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

function endsCleanly(text: string): boolean {
  return /[.!?]["')\]]?\s*$/.test(text.trim());
}

function startsCleanly(text: string): boolean {
  return /^["'(\[]?[A-Z]|^(and|but|so|because|then)\b/i.test(text.trim());
}

function looksLikeHangingFragment(text: string): boolean {
  const t = text.trim();
  return /[,;:\-]\s*$/.test(t) || /\b(and|but|so|because|that|which|who)\s*$/i.test(t);
}

function scoreChunk(c: NormChunk): number {
  const len = Math.min(1, c.tokens.length / 40);
  const endBonus = endsCleanly(c.text) ? 0.08 : 0;
  const startBonus = startsCleanly(c.text) ? 0.04 : 0;
  return (c.conf * 0.75) + (len * 0.15) + endBonus + startBonus;
}

function continuitySimAgainstRecent(recent: NormChunk[], chunk: NormChunk): number {
  if (!recent.length) return 1;
  let best = 0;
  for (const r of recent) {
    const sim = jaccardSim(r.tokens, chunk.tokens);
    if (sim > best) best = sim;
  }
  return best;
}

function normaliseChunks(raw: RawChunk[], cfg: MergeConfig): NormChunk[] {
  return raw
    .map(r => {
      const text = normaliseText(r.text);
      const conf = normaliseConfidence(r.engine, r.confidence);
      const syntheticStart = r.idx * cfg.chunkDurationSec;
      const syntheticEnd = syntheticStart + cfg.chunkDurationSec;
      const startSec = (r.engine === 'assembly' && r.startSec != null) ? r.startSec : syntheticStart;
      const endSec = (r.engine === 'assembly' && r.endSec != null) ? r.endSec : syntheticEnd;
      return { engine: r.engine, idx: r.idx, startSec, endSec, text, conf, tokens: tokenise(text) };
    })
    .filter(c => c.text.length > 0);
}

function timeOverlaps(a: NormChunk, b: NormChunk, cfg: MergeConfig): boolean {
  const tol = Math.max(0.5, cfg.overlapSec);
  return !(a.endSec < b.startSec - tol || b.endSec < a.startSec - tol);
}

function findBestOverlapCandidate(recent: NormChunk[], chunk: NormChunk, cfg: MergeConfig): NormChunk | null {
  let best: NormChunk | null = null;
  let bestSim = 0;
  for (const r of recent) {
    if (!timeOverlaps(r, chunk, cfg)) continue;
    const sim = jaccardSim(r.tokens, chunk.tokens);
    if (sim >= cfg.overlapSimilarity && sim > bestSim) { best = r; bestSim = sim; }
  }
  return best;
}

function chooseWinner(a: NormChunk, b: NormChunk, cfg: MergeConfig): NormChunk {
  const aScore = scoreChunk(a);
  const bScore = scoreChunk(b);
  if (a.engine !== b.engine) {
    const aTier = getEngineTier(a.engine);
    const bTier = getEngineTier(b.engine);
    if (aTier !== bTier) {
      const higher = aTier < bTier ? a : b;
      const lower = aTier < bTier ? b : a;
      const higherScore = higher === a ? aScore : bScore;
      const lowerScore = lower === a ? aScore : bScore;
      if (lowerScore >= higherScore + cfg.strongConfMargin) return lower;
      return higher;
    }
    return bScore > aScore ? b : a;
  }
  return bScore > aScore ? b : a;
}

function postProcessTranscript(s: string): string {
  // Preserve speaker label line breaks: temporarily replace \n[Speaker with a placeholder
  let out = (s || '');
  out = out.replace(/\n(\[Speaker\s)/g, '§SPKBREAK§$1');
  out = out.replace(/\s+/g, ' ').trim();
  out = out.replace(/([.!?])\s+([a-z])/g, (_, p1, p2) => `${p1} ${p2.toUpperCase()}`);
  out = out.replace(/\b(the|a|an|and|but|so|we|i|you|is|are|was|were|to|of|in|on|for|it)\s+\1\b/gi, '$1');
  out = out.replace(/\s+,/g, ',').replace(/\s+\./g, '.');
  out = out.replace(/\.{3,}\s*/g, '... ').trim();
  // Restore speaker label line breaks
  out = out.replace(/§SPKBREAK§/g, '\n');
  return out;
}

function mergeBestOfAll(whisperRaw: RawChunk[], assemblyRaw: RawChunk[], deepgramRaw: RawChunk[], cfg: MergeConfig = DEFAULT_MERGE_CONFIG) {
  const whisper = normaliseChunks(whisperRaw, cfg).sort((a, b) => a.idx - b.idx);
  const assembly = normaliseChunks(assemblyRaw, cfg).sort((a, b) => (a.startSec - b.startSec) || (a.idx - b.idx));
  const deepgram = normaliseChunks(deepgramRaw, cfg).sort((a, b) => a.idx - b.idx);

  const combined = [...assembly, ...deepgram, ...whisper].sort((a, b) => {
    const t = a.startSec - b.startSec;
    if (t !== 0) return t;
    const tierDiff = getEngineTier(a.engine) - getEngineTier(b.engine);
    if (tierDiff !== 0) return tierDiff;
    return a.idx - b.idx;
  });

  const kept: NormChunk[] = [];
  const dropped: NormChunk[] = [];
  const buffer: NormChunk[] = [];
  let overlapConflicts = 0;
  let bufferedDrops = 0;

  for (const chunk of combined) {
    if (chunk.engine === 'whisper' && chunk.conf < cfg.whisperConfFloor) {
      const hasTier1Near = kept.slice(-cfg.maxLookback).some(k =>
        getEngineTier(k.engine) === 1 && timeOverlaps(k, chunk, cfg) && jaccardSim(k.tokens, chunk.tokens) >= 0.25
      );
      if (hasTier1Near) { dropped.push(chunk); continue; }
    }

    const recent = kept.slice(-cfg.maxLookback);
    const overlapCandidate = findBestOverlapCandidate(recent, chunk, cfg);
    
    if (!overlapCandidate) {
      // Gap-fill similarity gate: block non-whisper candidates if Whisper already covers the content
      if (chunk.engine !== 'whisper') {
        const keptWhisperChunks = kept.filter(k => k.engine === 'whisper');
        if (keptWhisperChunks.length > 0) {
          const maxSim = Math.max(
            ...keptWhisperChunks.map(w => gapFillJaccard(chunk.tokens, w.tokens))
          );
          if (maxSim >= 0.75) {
            dropped.push(chunk);
            continue;
          }
        }
      }

      const contSim = continuitySimAgainstRecent(recent, chunk);
      const last = kept[kept.length - 1];
      const hangingThreshold = last && looksLikeHangingFragment(last.text) ? cfg.continuityMinSim * 1.8 : cfg.continuityMinSim;
      
      if (recent.length > 0 && contSim < hangingThreshold) {
        buffer.push(chunk);
        if (buffer.length > cfg.bufferWindow) { dropped.push(buffer.shift()!); bufferedDrops++; }
        continue;
      }
      
      kept.push(chunk);
      for (let i = buffer.length - 1; i >= 0; i--) {
        const b = buffer[i];
        const sim = continuitySimAgainstRecent(kept.slice(-cfg.maxLookback), b);
        if (sim >= cfg.continuityMinSim) { kept.push(b); buffer.splice(i, 1); }
      }
      continue;
    }
    
    overlapConflicts++;
    const winner = chooseWinner(overlapCandidate, chunk, cfg);
    if (winner === overlapCandidate) {
      dropped.push(chunk);
    } else {
      const idx = kept.lastIndexOf(overlapCandidate);
      if (idx >= 0) kept.splice(idx, 1, chunk);
      else kept.push(chunk);
      dropped.push(overlapCandidate);
    }
  }

  for (const b of buffer) { dropped.push(b); bufferedDrops++; }

  kept.sort((a, b) => {
    const t = a.startSec - b.startSec;
    if (t !== 0) return t;
    const tierDiff = getEngineTier(a.engine) - getEngineTier(b.engine);
    if (tierDiff !== 0) return tierDiff;
    return a.idx - b.idx;
  });

  // Post-merge deterministic dedup — runs on raw segment text BEFORE sentence reflow
  const dedupResult = postMergeDedup(kept.map(k => k.text));
  
  if (dedupResult.decisions.length > 0) {
    console.log(`[Dedup] ${dedupResult.stats.dropped} dropped, ${dedupResult.stats.trimmed} trimmed, ${dedupResult.stats.blockedByGuard} blocked`);
  }

  let transcript = postProcessTranscript(dedupResult.segments.join(' '));

  // Apply shared dedupTranscriptText on the final merged transcript
  // Same normalisation + hashing + thresholds as the Whisper clean step
  const finalDedupResult = cleanWhisperTranscriptInline(transcript);
  if (finalDedupResult.paragraphsDropped > 0 || finalDedupResult.overlapsTrimmed > 0) {
    console.log(`[FinalDedup] ${finalDedupResult.paragraphsDropped} paragraphs dropped, ${finalDedupResult.overlapsTrimmed} overlaps trimmed`);
    transcript = finalDedupResult.text;
  }

  return {
    transcript,
    kept,
    dropped,
    dedupDecisions: dedupResult.decisions,
    dedupStats: dedupResult.stats,
    finalDedupStats: {
      paragraphsDropped: finalDedupResult.paragraphsDropped,
      overlapsTrimmed: finalDedupResult.overlapsTrimmed,
    },
    stats: {
      whisperChunks: whisperRaw.length,
      assemblyChunks: assemblyRaw.length,
      deepgramChunks: deepgramRaw.length,
      keptCount: kept.length,
      droppedCount: dropped.length,
      overlapConflicts,
      bufferedDrops
    }
  };
}

// ============= INLINED CLEAN WHISPER TRANSCRIPT (Deno-compatible) =============

interface WhisperCleanResult {
  text: string;
  paragraphsDropped: number;
  overlapsTrimmed: number;
}

function cleanNormalise(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').replace(/([.!?,;:])\1+/g, '$1').trim();
}

function fnv1a32(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function splitIntoCleanBlocks(text: string): string[] {
  const splits = text.split(/\n\n+/).map(b => b.trim()).filter(Boolean);
  if (splits.length >= 2) return splits;
  // Fall back to sentence grouping
  const sentences = text.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length > 0);
  if (sentences.length <= 3) return sentences.length > 0 ? [sentences.join(' ')] : [];
  const blocks: string[] = [];
  for (let i = 0; i < sentences.length; i += 3) {
    blocks.push(sentences.slice(i, i + 3).join(' '));
  }
  return blocks;
}

function trimRawByNormLen(raw: string, normLen: number): string {
  let normCount = 0;
  let rawIdx = 0;
  const lower = raw.toLowerCase();
  while (rawIdx < raw.length && normCount < normLen) {
    const ch = lower[rawIdx];
    if (ch !== ' ' || (rawIdx > 0 && lower[rawIdx - 1] !== ' ')) normCount++;
    rawIdx++;
  }
  while (rawIdx < raw.length && raw[rawIdx] === ' ') rawIdx++;
  return raw.substring(rawIdx);
}

function cleanWhisperTranscriptInline(rawText: string): WhisperCleanResult {
  if (!rawText?.trim()) return { text: '', paragraphsDropped: 0, overlapsTrimmed: 0 };

  const WINDOW = 350;
  const MIN_WIN = 50;
  const RATIO = 0.60;

  // Step A — Block-level overlap trim
  let blocks = splitIntoCleanBlocks(rawText);
  let overlapsTrimmed = 0;

  if (blocks.length >= 2) {
    const trimmed = [blocks[0]];
    for (let i = 1; i < blocks.length; i++) {
      const tailNorm = cleanNormalise(trimmed[trimmed.length - 1].slice(-WINDOW));
      const headNorm = cleanNormalise(blocks[i].slice(0, WINDOW));
      if (tailNorm.length < MIN_WIN || headNorm.length < MIN_WIN) { trimmed.push(blocks[i]); continue; }
      let bestLen = 0;
      const maxScan = Math.min(headNorm.length, tailNorm.length, WINDOW);
      for (let len = maxScan; len >= MIN_WIN; len--) {
        if (tailNorm.endsWith(headNorm.substring(0, len))) { bestLen = len; break; }
      }
      if (bestLen > 0 && (bestLen / headNorm.length) >= RATIO) {
        const tr = trimRawByNormLen(blocks[i], bestLen);
        if (tr.trim().length > 0) { trimmed.push(tr); overlapsTrimmed++; }
        else overlapsTrimmed++;
      } else {
        trimmed.push(blocks[i]);
      }
    }
    blocks = trimmed;
  }

  // Step B — Paragraph-hash dedup (FNV-1a, sliding window of 50)
  let paragraphsDropped = 0;
  const HASH_WINDOW = 50;
  const recentHashes: number[] = [];
  const surviving: string[] = [];
  for (const block of blocks) {
    const norm = cleanNormalise(block);
    if (norm.length < 10) { surviving.push(block); continue; }
    const hash = fnv1a32(norm);
    if (recentHashes.includes(hash)) { paragraphsDropped++; continue; }
    surviving.push(block);
    recentHashes.push(hash);
    if (recentHashes.length > HASH_WINDOW) recentHashes.shift();
  }

  return { text: surviving.join('\n\n'), paragraphsDropped, overlapsTrimmed };
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}

// ============= HALLUCINATION DETECTION =============

const HALLUCINATION_PATTERNS = [
  /thank you (very much )?for (your )?attention/gi,
  /thank you for watching/gi,
  /please (like and )?subscribe/gi,
  /this (video|webinar) (has been|is now)/gi,
  /if you have any questions/gi,
  /i (hope|will be happy to)/gi,
  /all of the above are in the description/gi,
  /this is the end of the (webinar|video|meeting)/gi,
];

function isLikelyHallucination(text: string, confidence: number): { isHallucination: boolean; reason: string } {
  // NOTE: Confidence is NOT used as a rejection signal.
  // Hallucination is detected purely via repetition density, unique-phrase ratios, and pattern matching.
  // Low-confidence chunks that are lexically diverse and coherent are retained.

  const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;

  // 1. Hallucination phrase pattern matching
  let matchCount = 0;
  for (const pattern of HALLUCINATION_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) matchCount += matches.length;
  }
  if (matchCount > 2) {
    return { isHallucination: true, reason: `${matchCount} hallucination patterns detected` };
  }

  // 2. Unique-word ratio (lexical diversity) — only flag if very low AND text is short-ish
  if (wordCount >= 8) {
    const uniqueWords = new Set(words).size;
    const uniqueRatio = uniqueWords / wordCount;
    if (uniqueRatio < 0.20) {
      return { isHallucination: true, reason: `Very low lexical diversity: ${(uniqueRatio * 100).toFixed(0)}% unique words` };
    }
  }

  // 3. Phrase-level repetition (catches "X, X, X, X..." looping)
  const phrases = text.split(/[,.]/).map(p => p.trim().toLowerCase()).filter(p => p.length > 3);
  if (phrases.length >= 4) {
    const uniquePhrases = new Set(phrases).size;
    const phraseUniqueRatio = uniquePhrases / phrases.length;
    if (phraseUniqueRatio < 0.25) {
      return { isHallucination: true, reason: `Repeated phrase loop: ${uniquePhrases}/${phrases.length} unique (${(phraseUniqueRatio * 100).toFixed(0)}%)` };
    }
  }

  // 4. Sentence-level repetition
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
  if (sentences.length > 3) {
    const uniqueSentences = new Set(sentences.map(s => s.trim().toLowerCase()));
    const repetitionRatio = 1 - (uniqueSentences.size / sentences.length);
    if (repetitionRatio > 0.5) {
      return { isHallucination: true, reason: `${(repetitionRatio * 100).toFixed(0)}% sentence repetition detected` };
    }
  }

  // 5. Log low confidence as informational only — NOT a rejection signal
  if (confidence < 0.30) {
    console.log(`ℹ️ Low confidence ${(confidence * 100).toFixed(1)}% but chunk is lexically diverse — retaining`);
  }

  return { isHallucination: false, reason: '' };
}

function isTextHallucinated(text: string): boolean {
  if (!text || text.length < 50) return true;
  let matchCount = 0;
  for (const pattern of HALLUCINATION_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) matchCount += matches.length;
  }
  if (matchCount > 3) return true;
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
  if (sentences.length > 3) {
    const uniqueSentences = new Set(sentences.map(s => s.trim().toLowerCase()));
    const repetitionRatio = 1 - (uniqueSentences.size / sentences.length);
    if (repetitionRatio > 0.6) return true;
  }
  return false;
}

// ============= POST-MERGE SPEAKER INJECTION (Diarisation Overlay) =============

interface SpeakerSegment {
  speaker: string;
  startSec: number;
  endSec: number;
  source: 'assembly' | 'deepgram';
}

interface SpeakerInjectionConfig {
  toleranceMs: number;       // Alignment tolerance (default 500ms)
  unknownLabel: string;      // Label when no speaker found
}

const DEFAULT_SPEAKER_CONFIG: SpeakerInjectionConfig = {
  toleranceMs: 500,
  unknownLabel: 'Unknown Speaker',
};

/**
 * Parse [Speaker X]: labels from a chunk's text and map them to time spans
 * within that chunk's start/end window.
 */
function parseSpeakerSegmentsFromText(
  text: string,
  chunkStartSec: number,
  chunkEndSec: number,
  source: 'assembly' | 'deepgram'
): SpeakerSegment[] {
  const segments: SpeakerSegment[] = [];
  const regex = /\[Speaker\s+([A-Za-z0-9]+)\]\s*:\s*/gi;
  const matches: { speaker: string; charOffset: number }[] = [];

  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    matches.push({ speaker: m[1], charOffset: m.index });
  }

  if (matches.length === 0) {
    // No speaker labels — treat entire chunk as one segment with no label
    return [];
  }

  const totalChars = text.length;
  const chunkDuration = chunkEndSec - chunkStartSec;

  for (let i = 0; i < matches.length; i++) {
    const startFrac = matches[i].charOffset / totalChars;
    const endFrac = i + 1 < matches.length ? matches[i + 1].charOffset / totalChars : 1.0;

    segments.push({
      speaker: matches[i].speaker,
      startSec: chunkStartSec + startFrac * chunkDuration,
      endSec: chunkStartSec + endFrac * chunkDuration,
      source,
    });
  }

  return segments;
}

/**
 * Build a unified speaker timeline from AssemblyAI (primary) and Deepgram (fallback) chunks.
 * AssemblyAI segments take priority; Deepgram fills gaps.
 */
function buildSpeakerTimeline(
  assemblyChunks: RawChunk[],
  deepgramChunks: RawChunk[],
  cfg: MergeConfig
): SpeakerSegment[] {
  const assemblySegments: SpeakerSegment[] = [];
  const deepgramSegments: SpeakerSegment[] = [];

  // Parse AssemblyAI speaker segments
  for (const chunk of assemblyChunks) {
    const startSec = chunk.startSec ?? (chunk.idx * cfg.chunkDurationSec);
    const endSec = chunk.endSec ?? (startSec + cfg.chunkDurationSec);
    const segs = parseSpeakerSegmentsFromText(chunk.text, startSec, endSec, 'assembly');
    assemblySegments.push(...segs);
  }

  // Parse Deepgram speaker segments
  for (const chunk of deepgramChunks) {
    const startSec = chunk.startSec ?? (chunk.idx * cfg.chunkDurationSec);
    const endSec = chunk.endSec ?? (startSec + cfg.chunkDurationSec);
    const segs = parseSpeakerSegmentsFromText(chunk.text, startSec, endSec, 'deepgram');
    deepgramSegments.push(...segs);
  }

  // Sort both by start time
  assemblySegments.sort((a, b) => a.startSec - b.startSec);
  deepgramSegments.sort((a, b) => a.startSec - b.startSec);

  if (assemblySegments.length === 0 && deepgramSegments.length === 0) {
    return [];
  }

  if (assemblySegments.length === 0) return deepgramSegments;
  if (deepgramSegments.length === 0) return assemblySegments;

  // Merge: AssemblyAI is primary, Deepgram fills gaps
  const timeline: SpeakerSegment[] = [...assemblySegments];

  for (const dg of deepgramSegments) {
    // Check if AssemblyAI already covers this time window
    const covered = assemblySegments.some(
      a => a.startSec <= dg.startSec + 0.5 && a.endSec >= dg.endSec - 0.5
    );
    if (!covered) {
      // Check for partial overlap — only add if there's a genuine gap
      const overlaps = assemblySegments.some(
        a => !(a.endSec <= dg.startSec || a.startSec >= dg.endSec)
      );
      if (!overlaps) {
        timeline.push(dg);
      }
    }
  }

  timeline.sort((a, b) => a.startSec - b.startSec);
  return timeline;
}

/**
 * Look up the speaker at a given time position using the speaker timeline.
 * Returns the speaker label or null if none found within tolerance.
 */
function lookupSpeaker(
  timeSec: number,
  timeline: SpeakerSegment[],
  toleranceSec: number
): string | null {
  // Exact match first
  for (const seg of timeline) {
    if (timeSec >= seg.startSec - toleranceSec && timeSec <= seg.endSec + toleranceSec) {
      return seg.speaker;
    }
  }
  // Nearest neighbour within tolerance
  let nearest: SpeakerSegment | null = null;
  let bestDist = Infinity;
  for (const seg of timeline) {
    const midpoint = (seg.startSec + seg.endSec) / 2;
    const dist = Math.abs(timeSec - midpoint);
    if (dist < bestDist) {
      bestDist = dist;
      nearest = seg;
    }
  }
  if (nearest && bestDist <= toleranceSec * 2) {
    return nearest.speaker;
  }
  return null;
}

/**
 * Inject speaker labels into the merged transcript at speaker change boundaries.
 * Uses timestamp-proportional mapping to align words with the speaker timeline.
 */
function injectSpeakerLabels(
  mergedText: string,
  timeline: SpeakerSegment[],
  totalDurationSec: number,
  config: SpeakerInjectionConfig = DEFAULT_SPEAKER_CONFIG
): { text: string; speakerCount: number; injectedLabels: number } {
  if (!mergedText?.trim() || timeline.length === 0 || totalDurationSec <= 0) {
    return { text: mergedText, speakerCount: 0, injectedLabels: 0 };
  }

  const toleranceSec = config.toleranceMs / 1000;

  // Split into sentences for granular speaker assignment
  const sentences = mergedText
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  if (sentences.length === 0) {
    return { text: mergedText, speakerCount: 0, injectedLabels: 0 };
  }

  // Calculate cumulative character offsets for proportional time mapping
  const totalChars = mergedText.length;
  let charOffset = 0;
  const sentenceTimings: { sentence: string; timeSec: number }[] = [];

  for (const sentence of sentences) {
    const sentenceMidChar = charOffset + sentence.length / 2;
    const timeSec = (sentenceMidChar / totalChars) * totalDurationSec;
    sentenceTimings.push({ sentence, timeSec });
    charOffset += sentence.length + 1; // +1 for the space between sentences
  }

  // Assign speakers to sentences
  const speakerSet = new Set<string>();
  let lastSpeaker: string | null = null;
  let injectedLabels = 0;
  const outputParts: string[] = [];

  for (const { sentence, timeSec } of sentenceTimings) {
    const speaker = lookupSpeaker(timeSec, timeline, toleranceSec) || config.unknownLabel;
    speakerSet.add(speaker);

    if (speaker !== lastSpeaker) {
      // Speaker change — inject label
      outputParts.push(`\n[Speaker ${speaker}]: ${sentence}`);
      lastSpeaker = speaker;
      injectedLabels++;
    } else {
      outputParts.push(sentence);
    }
  }

  let result = outputParts.join(' ')
    .replace(/\n\s+/g, '\n')   // Clean up extra spaces after newlines
    .replace(/^\n/, '')         // Remove leading newline
    .trim();

  return {
    text: result,
    speakerCount: speakerSet.size,
    injectedLabels,
  };
}

// ============= MAIN HANDLER =============

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const pipelineStart = Date.now();
    const { meetingId, liveTranscript } = await req.json();
    
    if (!meetingId) {
      throw new Error('meetingId is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`🔄 Consolidating chunks for meeting: ${meetingId} using Best-of-All 3-engine merge`);
    console.log(`📝 Live transcript provided: ${liveTranscript ? `${liveTranscript.length} chars` : 'none'}`);

    // Fetch existing meeting data
    const { data: existingMeeting, error: meetingError } = await supabase
      .from('meetings')
      .select('live_transcript_text, whisper_transcript_text, word_count, primary_transcript_source')
      .eq('id', meetingId)
      .single();

    if (meetingError) {
      console.error('Error fetching existing meeting:', meetingError);
    }

    const existingTranscript = existingMeeting?.live_transcript_text || '';
    const existingWordCount = existingMeeting?.word_count || 0;
    console.log(`📊 Existing transcript: ${existingTranscript.length} chars, ${existingWordCount} words`);

    // Fetch all chunks for this meeting
    const { data: chunks, error: chunkError } = await supabase
      .from('meeting_transcription_chunks')
      .select('cleaned_text, chunk_number, cleaning_status, transcription_text, word_count, confidence, transcriber_type, start_time, end_time')
      .eq('meeting_id', meetingId)
      .order('chunk_number');

    if (chunkError) {
      throw new Error(`Error fetching chunks: ${chunkError.message}`);
    }

    // Fetch Deepgram chunks from dedicated table
    const { data: deepgramChunksData, error: deepgramError } = await supabase
      .from('deepgram_transcriptions')
      .select('chunk_number, transcription_text, confidence, is_final')
      .eq('meeting_id', meetingId)
      .eq('is_final', true)
      .order('chunk_number');

    if (deepgramError) {
      console.warn('⚠️ Failed to fetch Deepgram chunks:', deepgramError.message);
    }

    const deepgramChunkCount = deepgramChunksData?.length || 0;
    console.log(`📊 Deepgram chunks fetched: ${deepgramChunkCount}`);

    // If no chunks AND we have a live transcript, save it and return
    if ((!chunks || chunks.length === 0) && (!deepgramChunksData || deepgramChunksData.length === 0) && liveTranscript && liveTranscript.length > 50) {
      console.log('✅ No chunks found, using provided live transcript');
      const wordCount = liveTranscript.split(/\s+/).filter((w: string) => w.length > 0).length;
      
      await supabase.from('meetings').update({
        live_transcript_text: liveTranscript,
        word_count: wordCount,
        primary_transcript_source: 'whisper',
        updated_at: new Date().toISOString()
      }).eq('id', meetingId);

      return new Response(JSON.stringify({
        success: true,
        message: 'Used live transcript (no chunks available)',
        source: 'browser_live',
        transcriptLength: liveTranscript.length,
        wordCount
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if ((!chunks || chunks.length === 0) && (!deepgramChunksData || deepgramChunksData.length === 0)) {
      return new Response(JSON.stringify({
        success: false,
        message: 'No chunks found and no live transcript provided',
        chunksProcessed: 0
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`📊 Found ${chunks?.length || 0} meeting_transcription_chunks + ${deepgramChunkCount} Deepgram chunks to consolidate`);

    // Build RawChunks for Best-of-All merger
    const whisperRaw: RawChunk[] = [];
    const assemblyRaw: RawChunk[] = [];
    const deepgramRaw: RawChunk[] = [];
    const rejectedChunks: { chunkNumber: number; reason: string }[] = [];

    // Process meeting_transcription_chunks (Whisper + AssemblyAI)
    for (const chunk of (chunks || [])) {
      const chunkText = chunk.cleaned_text || chunk.transcription_text || '';
      const confidence = chunk.confidence || 0;

      let textToCheck = chunkText;
      try {
        const parsed = JSON.parse(chunkText);
        if (Array.isArray(parsed)) {
          textToCheck = parsed.map((seg: any) => seg.text || '').join(' ');
        }
      } catch { /* Not JSON */ }

      const hallucinationCheck = isLikelyHallucination(textToCheck, confidence);
      if (hallucinationCheck.isHallucination) {
        console.log(`🚫 Chunk ${chunk.chunk_number} pre-filtered: ${hallucinationCheck.reason}`);
        rejectedChunks.push({ chunkNumber: chunk.chunk_number, reason: hallucinationCheck.reason });
        
        await supabase.from('meeting_transcription_chunks')
          .update({ merge_rejection_reason: hallucinationCheck.reason })
          .eq('meeting_id', meetingId)
          .eq('chunk_number', chunk.chunk_number);
        continue;
      }

      const rawChunk: RawChunk = {
        engine: chunk.transcriber_type === 'assembly' ? 'assembly' : 'whisper',
        idx: chunk.chunk_number,
        text: textToCheck,
        confidence: confidence
      };

      if (chunk.start_time != null) {
        const parsedStart = Number(chunk.start_time);
        if (Number.isFinite(parsedStart)) {
          rawChunk.startSec = parsedStart;
        }
      }
      if (chunk.end_time != null) {
        const parsedEnd = Number(chunk.end_time);
        if (Number.isFinite(parsedEnd)) {
          rawChunk.endSec = parsedEnd;
        }
      }

      if (chunk.transcriber_type === 'assembly') {
        assemblyRaw.push(rawChunk);
      } else {
        whisperRaw.push(rawChunk);
      }
    }

    // Process Deepgram chunks
    for (const dgChunk of (deepgramChunksData || [])) {
      const text = dgChunk.transcription_text || '';
      if (!text.trim()) continue;

      deepgramRaw.push({
        engine: 'deepgram',
        idx: dgChunk.chunk_number,
        text: text,
        confidence: dgChunk.confidence || undefined
      });
    }

    console.log(`📊 After pre-filter: ${whisperRaw.length} Whisper, ${assemblyRaw.length} Assembly, ${deepgramRaw.length} Deepgram chunks`);

    // If all chunks were filtered, fall back to live transcript or existing
    if (whisperRaw.length === 0 && assemblyRaw.length === 0 && deepgramRaw.length === 0) {
      if (liveTranscript && liveTranscript.length > 50 && !isTextHallucinated(liveTranscript)) {
        console.log('✅ All chunks filtered, using provided live transcript');
        const wordCount = liveTranscript.split(/\s+/).filter((w: string) => w.length > 0).length;
        
        await supabase.from('meetings').update({
          live_transcript_text: liveTranscript,
          word_count: wordCount,
          primary_transcript_source: 'whisper',
          updated_at: new Date().toISOString()
        }).eq('id', meetingId);

        return new Response(JSON.stringify({
          success: true,
          message: 'All chunks filtered - used live transcript',
          source: 'browser_live',
          chunksProcessed: (chunks?.length || 0) + deepgramChunkCount,
          chunksFiltered: rejectedChunks.length,
          transcriptLength: liveTranscript.length,
          wordCount,
          rejectedChunks
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (existingTranscript && existingTranscript.length > 50 && !isTextHallucinated(existingTranscript)) {
        console.log('✅ All chunks filtered, keeping existing transcript');
        return new Response(JSON.stringify({
          success: true,
          message: 'All chunks filtered - kept existing transcript',
          source: 'existing',
          chunksProcessed: (chunks?.length || 0) + deepgramChunkCount,
          chunksFiltered: rejectedChunks.length,
          keptExistingTranscript: true,
          rejectedChunks
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      await supabase.from('meetings').update({
        live_transcript_text: '[Transcript unavailable - audio quality insufficient for reliable transcription]',
        whisper_transcript_text: '[Transcript unavailable - audio quality insufficient for reliable transcription]',
        word_count: 0,
        primary_transcript_source: 'whisper',
        updated_at: new Date().toISOString()
      }).eq('id', meetingId);

      return new Response(JSON.stringify({
        success: true,
        message: 'All chunks filtered as hallucinations - transcript marked as unavailable',
        chunksProcessed: (chunks?.length || 0) + deepgramChunkCount,
        chunksFiltered: rejectedChunks.length,
        rejectedChunks
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ============= CLEAN WHISPER BEFORE MERGING =============
    // Build raw Whisper transcript by concatenating chunks in order
    const whisperRawText = whisperRaw.length > 0
      ? whisperRaw
          .sort((a, b) => a.idx - b.idx)
          .map(c => normaliseText(c.text))
          .filter(t => t.length > 0)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim()
      : '';
    
    const whisperRawWordCount = countWords(whisperRawText);
    
    // Clean Whisper transcript (overlap trim + paragraph dedup)
    const whisperCleanResult = whisperRawText
      ? cleanWhisperTranscriptInline(whisperRawText)
      : { text: '', paragraphsDropped: 0, overlapsTrimmed: 0 };
    
    const whisperCleanText = whisperCleanResult.text;
    const whisperCleanWordCount = countWords(whisperCleanText);
    
    console.log(`🧹 Whisper clean: ${whisperRawWordCount} → ${whisperCleanWordCount} words ` +
      `(${whisperCleanResult.paragraphsDropped} paragraphs dropped, ${whisperCleanResult.overlapsTrimmed} overlaps trimmed)`);

    // Feed Whisper as ONE single gold chunk into the merger
    const whisperGoldChunks: RawChunk[] = [];
    if (whisperCleanText.trim()) {
      // Find the max endSec from all engines for the gold chunk's span
      const allEndSecs = [
        ...assemblyRaw.map(c => c.endSec || 0),
        ...deepgramRaw.map(c => c.endSec || 0),
        ...whisperRaw.map(c => (c.idx + 1) * DEFAULT_MERGE_CONFIG.chunkDurationSec)
      ];
      const maxEndSec = allEndSecs.length > 0 ? Math.max(...allEndSecs) : DEFAULT_MERGE_CONFIG.chunkDurationSec;
      
      whisperGoldChunks.push({
        engine: 'whisper',
        idx: 0,
        text: whisperCleanText,
        confidence: 0.85, // High confidence for cleaned batch transcript
        startSec: 0,
        endSec: maxEndSec
      });
    }

    // ============= PERFORM BEST-OF-ALL 3-ENGINE MERGE =============
    const mergeStart = Date.now();
    const mergeResult = mergeBestOfAll(whisperGoldChunks, assemblyRaw, deepgramRaw, DEFAULT_MERGE_CONFIG);
    const mergeDurationMs = Date.now() - mergeStart;
    
    console.log(`🔀 Best-of-All merge complete:`);
    console.log(`   Whisper (gold): ${whisperGoldChunks.length} chunk(s), Assembly: ${mergeResult.stats.assemblyChunks}, Deepgram: ${mergeResult.stats.deepgramChunks}`);
    console.log(`   Kept: ${mergeResult.stats.keptCount}, Dropped: ${mergeResult.stats.droppedCount}`);
    console.log(`   Overlap conflicts resolved: ${mergeResult.stats.overlapConflicts}`);
    console.log(`   Dedup: input=${mergeResult.dedupStats.inputCount}, output=${mergeResult.dedupStats.outputCount}, dropped=${mergeResult.dedupStats.dropped}, trimmed=${mergeResult.dedupStats.trimmed}`);
    if (mergeResult.finalDedupStats) {
      console.log(`   FinalDedup: ${mergeResult.finalDedupStats.paragraphsDropped} paragraphs dropped, ${mergeResult.finalDedupStats.overlapsTrimmed} overlaps trimmed`);
    }
    console.log(`   Final transcript: ${mergeResult.transcript.length} chars`);

    const mergedWordCount = mergeResult.transcript.split(/\s+/).filter(w => w.length > 0).length;

    // Check if merged result is worse than alternatives
    let bestTranscript = mergeResult.transcript;
    let bestSource = 'consolidated';
    let bestWordCount = mergedWordCount;

    const mergedIsHallucinated = isTextHallucinated(mergeResult.transcript);

    // Compare with live transcript if provided
    if (liveTranscript && liveTranscript.length > 50) {
      const liveWordCount = liveTranscript.split(/\s+/).filter((w: string) => w.length > 0).length;
      const liveIsHallucinated = isTextHallucinated(liveTranscript);
      
      if (mergedIsHallucinated && !liveIsHallucinated) {
        bestTranscript = liveTranscript;
        bestSource = 'whisper';
        bestWordCount = liveWordCount;
        console.log('✅ Using live transcript (merged was hallucinated)');
      } else if (!liveIsHallucinated && liveWordCount > mergedWordCount * 1.5) {
        bestTranscript = liveTranscript;
        bestSource = 'whisper';
        bestWordCount = liveWordCount;
        console.log('✅ Using live transcript (significantly longer and valid)');
      }
    }

    // Protect existing good transcript
    if (existingTranscript && existingTranscript.length > 50 && !isTextHallucinated(existingTranscript)) {
      if (isTextHallucinated(bestTranscript) || (existingWordCount > bestWordCount * 1.5)) {
        console.log('⚠️ Keeping existing transcript - new one is worse quality');
        return new Response(JSON.stringify({
          success: true,
          message: 'Kept existing transcript - new consolidation was lower quality',
          source: 'existing_preserved',
          mergeStats: mergeResult.stats,
          dedupStats: mergeResult.dedupStats,
          chunksProcessed: (chunks?.length || 0) + deepgramChunkCount,
          chunksFiltered: rejectedChunks.length,
          keptExistingTranscript: true
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // Build dedicated AssemblyAI-only transcript for the assembly tab
    let assemblyOnlyTranscript = '';
    if (assemblyRaw.length > 0) {
      assemblyOnlyTranscript = assemblyRaw
        .sort((a, b) => a.idx - b.idx)
        .map(c => normaliseText(c.text))
        .filter(t => t.length > 0)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      console.log(`📝 Built AssemblyAI-only transcript: ${assemblyOnlyTranscript.length} chars from ${assemblyRaw.length} chunks`);
    }

    // Whisper-only transcript = whisperClean (already built above)
    const whisperOnlyTranscript = whisperCleanText;
    if (whisperOnlyTranscript) {
      console.log(`📝 Whisper-only transcript (cleaned): ${whisperOnlyTranscript.length} chars`);
    }

    // Build dedicated Deepgram-only transcript for the Deepgram tab
    let deepgramOnlyTranscript = '';
    if (deepgramRaw.length > 0) {
      deepgramOnlyTranscript = deepgramRaw
        .sort((a, b) => a.idx - b.idx)
        .map(c => normaliseText(c.text))
        .filter(t => t.length > 0)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      console.log(`📝 Built Deepgram-only transcript: ${deepgramOnlyTranscript.length} chars from ${deepgramRaw.length} chunks`);
    }

    // Count how many distinct engine types contributed to kept segments
    const distinctEngines = new Set(mergeResult.kept.map(k => k.engine));
    const isMultiSource = distinctEngines.size >= 2;
    const dedupTranscriptNonEmpty = mergeResult.transcript.trim().length > 0;

    // Final paragraph-level dedup on bestTranscript (covers fallback paths)
    const bestTranscriptDedup = cleanWhisperTranscriptInline(bestTranscript);
    if (bestTranscriptDedup.paragraphsDropped > 0 || bestTranscriptDedup.overlapsTrimmed > 0) {
      console.log(`[BestTranscriptDedup] ${bestTranscriptDedup.paragraphsDropped} paragraphs dropped, ${bestTranscriptDedup.overlapsTrimmed} overlaps trimmed`);
      bestTranscript = bestTranscriptDedup.text;
      bestWordCount = bestTranscript.split(/\s+/).filter(w => w.length > 0).length;
    }

    // Safety dedup on best_of_all_transcript before storage
    let bestOfAllText = mergeResult.transcript;
    if (dedupTranscriptNonEmpty) {
      const boaDedup = cleanWhisperTranscriptInline(bestOfAllText);
      if (boaDedup.paragraphsDropped > 0 || boaDedup.overlapsTrimmed > 0) {
        console.log(`[BestOfAllDedup] ${boaDedup.paragraphsDropped} paragraphs dropped, ${boaDedup.overlapsTrimmed} overlaps trimmed`);
        bestOfAllText = boaDedup.text;
      }
    }

    // ============= HALLUCINATION DETECTION & REPAIR (BoT cleanup) =============
    const hallucinationRepairStart = Date.now();
    let hallucinationRepairLog: any = null;
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      if (supabaseUrl && supabaseServiceKey) {
        console.log(`[HallucinationRepair] Running repair on best_of_all transcript (${bestOfAllText.length} chars)...`);
        
        const repairResponse = await fetch(`${supabaseUrl}/functions/v1/repair-transcript-hallucinations`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            transcript: bestOfAllText,
            meetingId,
          }),
        });

        if (repairResponse.ok) {
          const repairResult = await repairResponse.json();
          hallucinationRepairLog = repairResult.stats || { skipped: repairResult.skipped, reason: repairResult.reason };

          if (!repairResult.skipped && repairResult.cleaned_transcript && repairResult.repair_log?.length > 0) {
            const repairedWordCount = repairResult.cleaned_transcript.split(/\s+/).filter((w: string) => w.length > 0).length;
            console.log(`[HallucinationRepair] Applied ${repairResult.repair_log.length} repair(s): ${bestWordCount} → ${repairedWordCount} words`);
            
            // Update both bestOfAll and bestTranscript
            bestOfAllText = repairResult.cleaned_transcript;
            if (bestSource === 'best_of_all' || bestSource === 'consolidated') {
              bestTranscript = repairResult.cleaned_transcript;
              bestWordCount = repairedWordCount;
            }
          } else {
            console.log(`[HallucinationRepair] Skipped: ${repairResult.reason || 'no artefacts found'}`);
          }
        } else {
          const errText = await repairResponse.text();
          console.warn(`[HallucinationRepair] Edge function error ${repairResponse.status}: ${errText}`);
        }
      }
    } catch (repairErr: any) {
      console.warn(`[HallucinationRepair] Non-blocking error: ${repairErr.message}`);
    }
    const hallucinationRepairDurationMs = Date.now() - hallucinationRepairStart;

    // ============= POST-MERGE SPEAKER INJECTION (Diarisation Overlay) =============
    const speakerInjectionStart = Date.now();
    let speakerInjectionLog: any = null;
    try {
      // Build speaker timeline from AssemblyAI (primary) and Deepgram (fallback)
      const speakerTimeline = buildSpeakerTimeline(assemblyRaw, deepgramRaw, DEFAULT_MERGE_CONFIG);

      if (speakerTimeline.length > 0) {
        // Estimate total duration from all chunks
        const allEndSecs = [
          ...assemblyRaw.map(c => c.endSec || ((c.idx + 1) * DEFAULT_MERGE_CONFIG.chunkDurationSec)),
          ...deepgramRaw.map(c => c.endSec || ((c.idx + 1) * DEFAULT_MERGE_CONFIG.chunkDurationSec)),
          ...whisperRaw.map(c => c.endSec || ((c.idx + 1) * DEFAULT_MERGE_CONFIG.chunkDurationSec)),
        ];
        const totalDurationSec = allEndSecs.length > 0 ? Math.max(...allEndSecs) : 0;

        if (totalDurationSec > 0) {
          // Inject into bestOfAllText
          const boaResult = injectSpeakerLabels(bestOfAllText, speakerTimeline, totalDurationSec);
          if (boaResult.injectedLabels > 0) {
            bestOfAllText = boaResult.text;
            console.log(`🎙️ Speaker injection (best_of_all): ${boaResult.injectedLabels} labels, ${boaResult.speakerCount} speakers`);
          }

          // Inject into bestTranscript (if it's the consolidated/best_of_all version)
          if (bestSource === 'consolidated' || bestSource === 'best_of_all') {
            const btResult = injectSpeakerLabels(bestTranscript, speakerTimeline, totalDurationSec);
            if (btResult.injectedLabels > 0) {
              bestTranscript = btResult.text;
              bestWordCount = bestTranscript.split(/\s+/).filter(w => w.length > 0).length;
              console.log(`🎙️ Speaker injection (bestTranscript): ${btResult.injectedLabels} labels, ${btResult.speakerCount} speakers`);
            }
          }

          speakerInjectionLog = {
            timelineSegments: speakerTimeline.length,
            assemblySpeakers: new Set(speakerTimeline.filter(s => s.source === 'assembly').map(s => s.speaker)).size,
            deepgramSpeakers: new Set(speakerTimeline.filter(s => s.source === 'deepgram').map(s => s.speaker)).size,
            totalDurationSec: Math.round(totalDurationSec),
            injectedLabels: boaResult.injectedLabels,
            speakerCount: boaResult.speakerCount,
          };
        }
      } else {
        console.log('🎙️ No speaker labels found in AssemblyAI or Deepgram — skipping diarisation overlay');
        speakerInjectionLog = { skipped: true, reason: 'no_speaker_labels_in_sources' };
      }
    } catch (speakerErr: any) {
      console.warn(`[SpeakerInjection] Non-blocking error: ${speakerErr.message}`);
      speakerInjectionLog = { error: speakerErr.message };
    }
    const speakerInjectionDurationMs = Date.now() - speakerInjectionStart;
    const totalPipelineDurationMs = Date.now() - pipelineStart;

    // Build consolidation timing data
    const consolidationTiming = {
      merge_seconds: parseFloat((mergeDurationMs / 1000).toFixed(2)),
      hallucination_repair_seconds: parseFloat((hallucinationRepairDurationMs / 1000).toFixed(2)),
      speaker_injection_seconds: parseFloat((speakerInjectionDurationMs / 1000).toFixed(2)),
      total_consolidation_seconds: parseFloat((totalPipelineDurationMs / 1000).toFixed(2)),
    };
    console.log(`[TIMING] Merge: ${consolidationTiming.merge_seconds}s | Repair: ${consolidationTiming.hallucination_repair_seconds}s | Speakers: ${consolidationTiming.speaker_injection_seconds}s | Total: ${consolidationTiming.total_consolidation_seconds}s`);

    // Update the meeting with the best transcript AND per-source transcripts
    const updatePayload: Record<string, any> = {
      live_transcript_text: bestTranscript,
      word_count: bestWordCount,
      primary_transcript_source: bestSource,
      updated_at: new Date().toISOString(),
      // Always store best_of_all_transcript if we have it
      best_of_all_transcript: dedupTranscriptNonEmpty ? bestOfAllText : null,
      // Store merge decision log with Whisper clean diagnostics
      merge_decision_log: {
        decisions: mergeResult.dedupDecisions?.slice(0, 100),
        stats: mergeResult.dedupStats,
        mergeStats: mergeResult.stats,
        distinctEngines: Array.from(distinctEngines),
        whisperDedupStats: {
          paragraphsDropped: whisperCleanResult.paragraphsDropped,
          overlapsTrimmed: whisperCleanResult.overlapsTrimmed,
        },
        finalDedupStats: mergeResult.finalDedupStats || { paragraphsDropped: 0, overlapsTrimmed: 0 },
        whisperRawWordCount,
        whisperDedupWordCount: whisperCleanWordCount,
        assemblyRawWordCount: countWords(assemblyRaw.map(c => c.text).join(' ')),
        deepgramRawWordCount: countWords(deepgramRaw.map(c => c.text).join(' ')),
        finalRawWordCount: countWords(postProcessTranscript(mergeResult.kept.map(k => k.text).join(' '))),
        finalDedupWordCount: mergedWordCount,
        finalEqualsWhisperClean: mergeResult.transcript.trim() === whisperCleanText.trim(),
        hallucinationRepair: hallucinationRepairLog,
        speakerInjection: speakerInjectionLog,
        timing: consolidationTiming,
        generatedAt: new Date().toISOString()
      }
    };

    // Only set primary_transcript_source to 'best_of_all' when dedup produced output AND multi-source
    if (dedupTranscriptNonEmpty && isMultiSource) {
      updatePayload.primary_transcript_source = 'best_of_all';
    }

    // Always populate whisper_transcript_text
    if (whisperOnlyTranscript) {
      updatePayload.whisper_transcript_text = whisperOnlyTranscript;
    } else if (bestSource === 'consolidated' || bestSource === 'best_of_all') {
      updatePayload.whisper_transcript_text = bestTranscript;
    }

    // Always populate assembly_transcript_text when assembly chunks exist
    if (assemblyOnlyTranscript) {
      updatePayload.assembly_transcript_text = assemblyOnlyTranscript;
    }

    const { error: updateError } = await supabase.from('meetings')
      .update(updatePayload)
      .eq('id', meetingId);

    if (updateError) {
      throw new Error(`Error updating meeting: ${updateError.message}`);
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Transcript consolidated using Best-of-All 3-engine merge (Whisper-gold)',
      source: updatePayload.primary_transcript_source,
      mergeStats: mergeResult.stats,
      dedupStats: mergeResult.dedupStats,
      whisperDedupStats: {
        paragraphsDropped: whisperCleanResult.paragraphsDropped,
        overlapsTrimmed: whisperCleanResult.overlapsTrimmed,
      },
      finalDedupStats: mergeResult.finalDedupStats || { paragraphsDropped: 0, overlapsTrimmed: 0 },
      whisperRawWordCount,
      whisperDedupWordCount: whisperCleanWordCount,
      assemblyRawWordCount: countWords(assemblyRaw.map(c => c.text).join(' ')),
      deepgramRawWordCount: countWords(deepgramRaw.map(c => c.text).join(' ')),
      finalRawWordCount: countWords(postProcessTranscript(mergeResult.kept.map(k => k.text).join(' '))),
      finalDedupWordCount: mergedWordCount,
      finalEqualsWhisperClean: mergeResult.transcript.trim() === whisperCleanText.trim(),
      chunksProcessed: (chunks?.length || 0) + deepgramChunkCount,
      chunksFiltered: rejectedChunks.length,
      totalWords: bestWordCount,
      transcriptLength: bestTranscript.length,
      bestOfAllLength: mergeResult.transcript.length,
      distinctEngines: Array.from(distinctEngines),
      rejectedChunks: rejectedChunks.slice(0, 10)
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('❌ Error consolidating chunks:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
