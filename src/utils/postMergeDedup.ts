/**
 * Post-Merge Deterministic Deduplication
 * 
 * Runs AFTER the Best-of-All merger selects winning chunks and BEFORE
 * paragraph/sentence reflow (postProcessTranscript). Removes:
 *  - Whole repeated paragraphs (Rule 1: near-exact)
 *  - Boundary overlap repeats (Rule 2: trim start)
 *  - A-B-A pattern repeats (Rule 3)
 * 
 * Safety guards protect segments containing new clinical tokens
 * (digits, medications, pathways, safeguarding phrases) from being dropped.
 * 
 * Every decision is logged for auditability.
 */

// ===================== Types =====================

export interface DedupDecision {
  i: number;
  action: 'DROP' | 'TRIM_START';
  reason_code:
    | 'DUP_NEAR_EXACT'
    | 'DUP_BOUNDARY_OVERLAP'
    | 'DUP_ABA_REPEAT'
    | 'DEDUP_BLOCKED_CRITICAL_NEW_INFO';
  compared_to: number;
  jaccard: number;
  containment: number;
  overlap_tokens_removed?: number;
  critical_tokens_new?: string[];
  snippet: { prev: string; curr: string };
}

export interface PostMergeDedupResult {
  segments: string[];
  decisions: DedupDecision[];
  stats: {
    inputCount: number;
    outputCount: number;
    dropped: number;
    trimmed: number;
    blockedByGuard: number;
  };
}

// ===================== Internal types =====================

interface NormSegment {
  raw: string;
  normTokens: string[];
  normString: string;
}

// ===================== Constants =====================

const JACCARD_THRESHOLD = 0.82;
const CONTAINMENT_THRESHOLD = 0.90;
const MIN_TOKEN_COUNT = 12;
const MAX_OVERLAP_TOKENS = 20;
const MIN_OVERLAP_TOKENS = 8;
const SNIPPET_LENGTH = 120;

// Critical token patterns for safety guards
const DIGIT_PATTERN = /\b\d+(\.\d+)?\b/g;

const MEDICATION_TOKENS = new Set([
  'mg', 'mcg', 'ml', 'od', 'bd', 'tds', 'prn', 'qds',
  'stat', 'nocte', 'mane', 'tablet', 'tablets', 'capsule',
  'capsules', 'inhaler', 'injection', 'patch', 'cream',
]);

const PATHWAY_TOKENS = new Set([
  '2ww', 'urgent', 'cardiology', 'ecg', 'troponin',
  'dermatology', 'neurology', 'oncology', 'respiratory',
  'gastroenterology', 'endoscopy', 'mri', 'ct', 'xray',
  'x-ray', 'ultrasound', 'referral', 'pathway',
]);

const SAFEGUARDING_TOKENS = new Set([
  'harm', 'suicide', 'suicidal', 'self-harm', 'selfharm',
  '999', 'a&e', 'ae', 'emergency', 'ambulance', 'safeguarding',
  'abuse', 'neglect', 'risk', 'overdose', 'crisis',
]);

// ===================== Normalisation (Step 0) =====================

function normaliseForComparison(text: string): NormSegment {
  const raw = text;

  let norm = text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9\s]/g, '') // Strip punctuation, keep letters/digits
    .trim();

  // Mask numbers with <NUM> for similarity comparison only
  const normForTokens = norm.replace(/\b\d+(\.\d+)?\b/g, '<NUM>');

  const normTokens = normForTokens.split(/\s+/).filter(Boolean);
  const normString = norm; // Keep unnumbered version for containment

  return { raw, normTokens, normString };
}

// ===================== Similarity Tests (Step 2) =====================

function tokenJaccard(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const t of setA) {
    if (setB.has(t)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function substringContainment(a: string, b: string): number {
  if (!a.length || !b.length) return 0;
  const containAinB = a.length <= b.length && b.includes(a)
    ? a.length / b.length
    : 0;
  const containBinA = b.length <= a.length && a.includes(b)
    ? b.length / a.length
    : 0;
  return Math.max(containAinB, containBinA);
}

// ===================== Critical Token Extraction (Step 4) =====================

function extractCriticalTokens(text: string): Set<string> {
  const tokens = new Set<string>();
  const lower = text.toLowerCase();

  // Extract digits
  const digitMatches = lower.match(DIGIT_PATTERN);
  if (digitMatches) {
    for (const d of digitMatches) tokens.add(d);
  }

  // Check medication tokens
  const words = lower.replace(/[^a-z0-9\s&-]/g, ' ').split(/\s+/);
  for (const w of words) {
    if (MEDICATION_TOKENS.has(w)) tokens.add(w);
    if (PATHWAY_TOKENS.has(w)) tokens.add(w);
    if (SAFEGUARDING_TOKENS.has(w)) tokens.add(w);
  }

  // Check multi-word patterns
  if (lower.includes('chest pain pathway')) tokens.add('chest pain pathway');
  if (lower.includes('self-harm') || lower.includes('self harm')) tokens.add('self-harm');
  if (lower.includes('a&e')) tokens.add('a&e');

  return tokens;
}

function newCriticalTokens(current: string, previous: string): string[] {
  const currTokens = extractCriticalTokens(current);
  const prevTokens = extractCriticalTokens(previous);
  const newTokens: string[] = [];
  for (const t of currTokens) {
    if (!prevTokens.has(t)) newTokens.push(t);
  }
  return newTokens;
}

// ===================== Snippet helper =====================

function snippet(text: string): string {
  if (text.length <= SNIPPET_LENGTH) return text;
  return text.substring(0, SNIPPET_LENGTH) + '...';
}

// ===================== Main Algorithm =====================

export function postMergeDedup(segments: string[]): PostMergeDedupResult {
  const decisions: DedupDecision[] = [];
  const stats = {
    inputCount: segments.length,
    outputCount: 0,
    dropped: 0,
    trimmed: 0,
    blockedByGuard: 0,
  };

  if (segments.length === 0) {
    return { segments: [], decisions, stats };
  }

  // Step 0: Normalise all segments
  const normed: NormSegment[] = segments.map(normaliseForComparison);

  // Track which segments are kept and their current text
  // keptIndices[n] = original index of the nth kept segment
  const result: string[] = [];
  // For comparison we track the last two kept normalised segments
  let prevKept: NormSegment | null = null;
  let prevPrevKept: NormSegment | null = null;
  let prevKeptOrigIndex = -1;
  let prevPrevKeptOrigIndex = -1;

  for (let i = 0; i < normed.length; i++) {
    const seg = normed[i];

    // Skip empty segments
    if (!seg.raw.trim()) {
      continue;
    }

    // First segment always kept
    if (prevKept === null) {
      result.push(seg.raw);
      prevPrevKept = null;
      prevKept = seg;
      prevKeptOrigIndex = i;
      continue;
    }

    // Step 1 & 2: Compare to previous kept
    const jaccard = tokenJaccard(seg.normTokens, prevKept.normTokens);
    const containment = substringContainment(seg.normString, prevKept.normString);

    // Step 3: Check Rule 1 — Near-exact duplicate
    const meetsJaccard = jaccard >= JACCARD_THRESHOLD &&
      Math.min(seg.normTokens.length, prevKept.normTokens.length) >= MIN_TOKEN_COUNT;
    const meetsContainment = containment >= CONTAINMENT_THRESHOLD;

    if (meetsJaccard || meetsContainment) {
      // Step 4: Safety guard — check for new critical tokens
      const newCritical = newCriticalTokens(seg.raw, prevKept.raw);

      if (newCritical.length > 0) {
        // Don't drop — try boundary trim instead
        const trimResult = tryBoundaryTrim(seg, prevKept, i, prevKeptOrigIndex);
        if (trimResult) {
          result.push(trimResult.trimmedText);
          decisions.push({
            i,
            action: 'TRIM_START',
            reason_code: 'DEDUP_BLOCKED_CRITICAL_NEW_INFO',
            compared_to: prevKeptOrigIndex,
            jaccard,
            containment,
            overlap_tokens_removed: trimResult.tokensRemoved,
            critical_tokens_new: newCritical,
            snippet: { prev: snippet(prevKept.raw), curr: snippet(seg.raw) },
          });
          stats.trimmed++;
          stats.blockedByGuard++;
          prevPrevKept = prevKept;
          prevPrevKeptOrigIndex = prevKeptOrigIndex;
          prevKept = normaliseForComparison(trimResult.trimmedText);
          prevKeptOrigIndex = i;
        } else {
          // Keep as-is (safety guard protects it)
          result.push(seg.raw);
          decisions.push({
            i,
            action: 'TRIM_START',
            reason_code: 'DEDUP_BLOCKED_CRITICAL_NEW_INFO',
            compared_to: prevKeptOrigIndex,
            jaccard,
            containment,
            overlap_tokens_removed: 0,
            critical_tokens_new: newCritical,
            snippet: { prev: snippet(prevKept.raw), curr: snippet(seg.raw) },
          });
          stats.blockedByGuard++;
          prevPrevKept = prevKept;
          prevPrevKeptOrigIndex = prevKeptOrigIndex;
          prevKept = seg;
          prevKeptOrigIndex = i;
        }
        continue;
      }

      // Safe to drop
      decisions.push({
        i,
        action: 'DROP',
        reason_code: 'DUP_NEAR_EXACT',
        compared_to: prevKeptOrigIndex,
        jaccard,
        containment,
        snippet: { prev: snippet(prevKept.raw), curr: snippet(seg.raw) },
      });
      stats.dropped++;
      continue;
    }

    // Step 3: Check Rule 2 — Boundary overlap trim
    const trimResult = tryBoundaryTrim(seg, prevKept, i, prevKeptOrigIndex);
    if (trimResult) {
      result.push(trimResult.trimmedText);
      decisions.push({
        i,
        action: 'TRIM_START',
        reason_code: 'DUP_BOUNDARY_OVERLAP',
        compared_to: prevKeptOrigIndex,
        jaccard,
        containment,
        overlap_tokens_removed: trimResult.tokensRemoved,
        snippet: { prev: snippet(prevKept.raw), curr: snippet(seg.raw) },
      });
      stats.trimmed++;
      prevPrevKept = prevKept;
      prevPrevKeptOrigIndex = prevKeptOrigIndex;
      prevKept = normaliseForComparison(trimResult.trimmedText);
      prevKeptOrigIndex = i;
      continue;
    }

    // Step 3: Check Rule 3 — A-B-A repeat
    if (prevPrevKept !== null) {
      const abaJaccard = tokenJaccard(seg.normTokens, prevPrevKept.normTokens);
      if (abaJaccard >= JACCARD_THRESHOLD && seg.normTokens.length >= MIN_TOKEN_COUNT) {
        // Safety guard for A-B-A too
        const newCritical = newCriticalTokens(seg.raw, prevPrevKept.raw);
        if (newCritical.length > 0) {
          // Block drop, keep segment
          result.push(seg.raw);
          decisions.push({
            i,
            action: 'TRIM_START',
            reason_code: 'DEDUP_BLOCKED_CRITICAL_NEW_INFO',
            compared_to: prevPrevKeptOrigIndex,
            jaccard: abaJaccard,
            containment: 0,
            overlap_tokens_removed: 0,
            critical_tokens_new: newCritical,
            snippet: { prev: snippet(prevPrevKept.raw), curr: snippet(seg.raw) },
          });
          stats.blockedByGuard++;
          prevPrevKept = prevKept;
          prevPrevKeptOrigIndex = prevKeptOrigIndex;
          prevKept = seg;
          prevKeptOrigIndex = i;
          continue;
        }

        decisions.push({
          i,
          action: 'DROP',
          reason_code: 'DUP_ABA_REPEAT',
          compared_to: prevPrevKeptOrigIndex,
          jaccard: abaJaccard,
          containment: 0,
          snippet: { prev: snippet(prevPrevKept.raw), curr: snippet(seg.raw) },
        });
        stats.dropped++;
        continue;
      }
    }

    // No rule triggered — keep segment
    result.push(seg.raw);
    prevPrevKept = prevKept;
    prevPrevKeptOrigIndex = prevKeptOrigIndex;
    prevKept = seg;
    prevKeptOrigIndex = i;
  }

  stats.outputCount = result.length;

  return { segments: result, decisions, stats };
}

// ===================== Boundary Trim Helper =====================

function tryBoundaryTrim(
  current: NormSegment,
  previous: NormSegment,
  currentIdx: number,
  previousIdx: number,
): { trimmedText: string; tokensRemoved: number } | null {
  // Check if the start of current repeats the end of previous
  // Try N tokens from MAX_OVERLAP_TOKENS down to MIN_OVERLAP_TOKENS
  const prevRawTokens = previous.raw.split(/\s+/);
  const currRawTokens = current.raw.split(/\s+/);

  if (currRawTokens.length < MIN_OVERLAP_TOKENS || prevRawTokens.length < MIN_OVERLAP_TOKENS) {
    return null;
  }

  // Use normalised tokens for comparison
  const prevNormTail = previous.normTokens;
  const currNormHead = current.normTokens;

  for (let n = Math.min(MAX_OVERLAP_TOKENS, prevNormTail.length, currNormHead.length); n >= MIN_OVERLAP_TOKENS; n--) {
    const tail = prevNormTail.slice(-n);
    const head = currNormHead.slice(0, n);

    // Check exact token match
    let match = true;
    for (let j = 0; j < n; j++) {
      if (tail[j] !== head[j]) {
        match = false;
        break;
      }
    }

    if (match) {
      // Trim the first n tokens from the raw text of current
      // We need to find the position in raw text after n whitespace-delimited tokens
      const trimmedRawTokens = currRawTokens.slice(n);
      if (trimmedRawTokens.length === 0) {
        return null; // Would remove entire segment
      }
      return {
        trimmedText: trimmedRawTokens.join(' '),
        tokensRemoved: n,
      };
    }
  }

  return null;
}
