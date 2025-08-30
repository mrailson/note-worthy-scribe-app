// src/utils/liveMerge.ts
export type LiveChunk = {
  text: string;
  isFinal?: boolean;   // IMPORTANT: set this from your STT if available
  seq?: number;        // monotonically increasing per session
  start_ms?: number;   // if you have audio offsets
  end_ms?: number;
  source?: string;     // "deepgram" | "whisper" | "browser" | ...
  speaker?: string | null;
};

const OVERLAP_SCAN = 180;       // chars to scan for overlaps
const JACCARD_THRESHOLD = 0.85; // balanced near-duplicate cutoff (reduced from 0.97 to preserve content)
const DEDUPE_WINDOW = 10;       // compare against last N sentences

const norm = (s: string) =>
  s.replace(/\u2026/g, "...")      // normalize ellipsis
   .replace(/[ \t]+/g, " ")
   .replace(/\s+/g, " ")
   .trim();

const splitSents = (t: string) =>
  t.split(/(?<=[.!?…])\s+(?=[A-Z""(\[])/)
   .map(s => s.trim())
   .filter(Boolean);

const grams = (s: string, n: number) => {
  const w = s.toLowerCase().split(/\s+/);
  const out = new Set<string>();
  for (let i = 0; i <= w.length - n; i++) out.add(w.slice(i, i + n).join(" "));
  return out;
};

const jacc = (a: Set<string>, b: Set<string>) => {
  const inter = [...a].filter(x => b.has(x)).length;
  const uni = new Set([...a, ...b]).size || 1;
  return inter / uni;
};

const sim = (a: string, b: string) =>
  Math.max(jacc(grams(a, 3), grams(b, 3)), jacc(grams(a, 2), grams(b, 2)));

function stitchWithOverlap(prev: string, next: string) {
  if (!prev) return next;
  const a = prev.slice(-OVERLAP_SCAN);
  const b = next.slice(0, OVERLAP_SCAN);
  if (!a || !b) return prev + (/[.!?…]$/.test(prev) ? " " : " ") + next;

  for (let k = Math.min(a.length, b.length); k >= 40; k -= 10) {
    const suf = a.slice(-k);
    const pre = b.slice(0, k);
    if (sim(suf, pre) >= JACCARD_THRESHOLD) {
      // drop the overlapping prefix from next
      console.log(`🔗 Detected overlap (${k} chars, similarity: ${sim(suf, pre).toFixed(3)}), merging without duplication`);
      return prev + next.slice(k);
    }
  }
  return prev + (/[.!?…]$/.test(prev) ? " " : " ") + next;
}

function dedupeTail(text: string) {
  const sents = splitSents(text);
  const out: string[] = [];
  for (const s of sents) {
    const recent = out.slice(-DEDUPE_WINDOW);
    const dup = recent.some(r => sim(r, s) >= JACCARD_THRESHOLD);
    if (!dup) {
      out.push(s);
    } else {
      console.log(`🚫 Filtered duplicate sentence: "${s.substring(0, 50)}..."`);
    }
  }
  return out.join(" ");
}

/**
 * Merge a final chunk into an accumulated, cleaned transcript.
 * - ignores non-final chunks (return prev unchanged)
 * - overlap-aware head/tail stitching
 * - sliding-window dedupe
 */
export function mergeLive(prevText: string, chunk: LiveChunk): string {
  if (!chunk?.text || !chunk.text.trim()) {
    console.log(`📝 Ignoring empty chunk`);
    return prevText;
  }
  
  if (chunk.isFinal === false) {
    console.log(`⏳ Ignoring non-final chunk: "${chunk.text.substring(0, 30)}..."`);
    return prevText; // ignore interim by default
  }

  console.log(`✅ Processing final chunk: "${chunk.text.substring(0, 50)}..." (${chunk.text.length} chars)`);

  const prev = norm(prevText);
  const next = norm(chunk.text);

  // stitch with overlap removal
  const stitched = stitchWithOverlap(prev, next);

  // run a small dedupe window on the tail
  const deduped = dedupeTail(stitched);

  console.log(`🔄 Live merge complete: ${prevText.length} -> ${deduped.length} chars`);
  return deduped;
}