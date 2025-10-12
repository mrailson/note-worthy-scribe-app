// src/utils/TranscriptMerge.ts
// Simplified version - now that we store deltas in DB, this is just a safety net
export function mergeLive(prev: string, next: string): string {
  const trim = (s: string) => s.replace(/\s+/g, " ").trim();

  const A = prev;
  const B = next;
  if (!A) return trim(B);
  if (!B) return trim(A);

  // Simple tail overlap removal (look back ~220 chars)
  const TAIL = 220;
  const tail = A.slice(-TAIL);
  const idx = (tail && B.startsWith(tail)) ? tail.length : -1;
  
  let stitched: string;
  if (idx > -1) {
    stitched = A + B.slice(idx);
  } else {
    // Fuzzy overlap: find longest suffix of A that is a prefix of B (>= 10 chars)
    let k = Math.min(TAIL, Math.min(A.length, B.length));
    let cut = 0;
    while (k >= 10) {
      if (A.slice(-k) === B.slice(0, k)) { cut = k; break; }
      k--;
    }
    stitched = cut ? (A + B.slice(cut)) : (A + (A.endsWith(" ") ? "" : " ") + B);
  }

  // Simple sentence deduplication
  const sents = stitched
    .replace(/(\r?\n)+/g, " ")
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(Boolean);

  const out: string[] = [];
  const seen = new Set<string>();
  const sig = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 80);

  for (const s of sents) {
    const key = sig(s);
    if (!seen.has(key)) {
      out.push(s);
      // Keep small window to avoid memory growth
      if (out.length > 60) {
        const first = out[out.length - 60];
        seen.delete(sig(first));
      }
      seen.add(key);
    }
  }

  return out.join(" ");
}
