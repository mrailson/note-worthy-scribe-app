// src/utils/TranscriptMerge.ts
export function mergeLive(prev: string, next: string): string {
  const trim = (s: string) => s.replace(/\s+/g, " ").trim();
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]+/g, " ").replace(/\s+/g, " ").trim();

  const A = prev;
  const B = next;
  if (!A) return trim(B);
  if (!B) return trim(A);

  // STAGE 1: Large block overlap detection
  // Check if B starts with a large portion of A (common in streaming transcription)
  const BLOCK_CHECK_SIZE = Math.min(500, A.length);
  const blockA = norm(A.slice(-BLOCK_CHECK_SIZE));
  const blockB = norm(B.slice(0, BLOCK_CHECK_SIZE));
  
  // If B starts with 70%+ of the end of A, it's likely a full overlap
  if (blockA.length > 50 && blockB.length > 50) {
    const words_a = blockA.split(/\s+/);
    const words_b = blockB.split(/\s+/);
    let matchedWords = 0;
    const checkWords = Math.min(words_a.length, words_b.length);
    
    for (let i = 0; i < checkWords; i++) {
      if (words_a[words_a.length - checkWords + i] === words_b[i]) {
        matchedWords++;
      }
    }
    
    // If 70%+ words match, remove the overlapping portion from B
    if (checkWords > 0 && matchedWords / checkWords > 0.7) {
      const overlapChars = Math.floor(B.length * matchedWords / checkWords);
      if (overlapChars > 50) {
        return mergeLive(A, B.slice(overlapChars));
      }
    }
  }

  // STAGE 2: Tail overlap removal (look back ~220 chars)
  const TAIL = 220;
  const tail = A.slice(-TAIL);
  const idx = (tail && B.startsWith(tail)) ? tail.length : -1;

  let stitched: string;
  if (idx > -1) {
    stitched = A + B.slice(idx);
  } else {
    // ENHANCED fuzzy overlap: reduced threshold from 20 to 10 chars
    let k = Math.min(TAIL, Math.min(A.length, B.length));
    let cut = 0;
    while (k >= 10) {
      if (A.slice(-k) === B.slice(0, k)) { cut = k; break; }
      k--;
    }
    stitched = cut ? (A + B.slice(cut)) : (A + (A.endsWith(" ") ? "" : " ") + B);
  }

  // STAGE 3: Sentence-level deduplication
  const sents = stitched
    .replace(/(\r?\n)+/g, " ")
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(Boolean);

  const out: string[] = [];
  const seen = new Set<string>();
  const sig = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 100);

  for (const s of sents) {
    const key = sig(s);
    if (!seen.has(key)) {
      out.push(s);
      // keep larger window to catch more duplicates
      if (out.length > 80) {
        const first = out[out.length - 80];
        seen.delete(sig(first));
      }
      seen.add(key);
    }
  }

  // STAGE 4: Phrase-level deduplication (n-gram based)
  // Check for repeated phrases of 10+ words
  const finalText = out.join(" ");
  const words = finalText.split(/\s+/);
  const phraseSize = 10;
  const phraseSet = new Set<string>();
  const keptWords: string[] = [];
  
  for (let i = 0; i < words.length; i++) {
    if (i + phraseSize <= words.length) {
      const phrase = words.slice(i, i + phraseSize).join(" ").toLowerCase();
      if (phraseSet.has(phrase)) {
        // Skip this phrase, it's a duplicate
        i += phraseSize - 1;
        continue;
      }
      phraseSet.add(phrase);
    }
    keptWords.push(words[i]);
  }

  return keptWords.join(" ");
}
