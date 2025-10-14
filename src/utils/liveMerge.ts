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

const OVERLAP_SCAN = 200;       // chars to scan for overlaps (increased for better detection)
const STITCH_SIM_THRESHOLD = 0.97; // similarity to consider head/tail overlap (increased to be less aggressive)
const DEDUPE_SIM_THRESHOLD = 0.98; // be less aggressive when filtering duplicates
const DEDUPE_WINDOW = 5;        // compare against last 5 sentences only (reduced from 15)
const MIN_CONFIDENCE_THRESHOLD = 0.30; // minimum confidence to accept chunks (30%)

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

  // Enhanced overlap detection with more aggressive thresholds
  for (let k = Math.min(a.length, b.length); k >= 30; k -= 8) { // Reduced min overlap and step size
    const suf = a.slice(-k);
    const pre = b.slice(0, k);
    const similarity = sim(suf, pre);
    
    if (similarity >= STITCH_SIM_THRESHOLD) {
      console.log(`🔗 Detected overlap (${k} chars, similarity: ${similarity.toFixed(3)}), merging without duplication`);
      return prev + next.slice(k);
    }
  }
  
  // Additional check for large block duplicates
  // TEMPORARILY DISABLED - may be too aggressive for medical terminology
  // if (hasLargeBlockOverlap(prev, next)) {
  //   console.log(`🚫 Large block overlap detected, skipping duplicate content`);
  //   return prev; // Don't add the duplicate content
  // }
  
  return prev + (/[.!?…]$/.test(prev) ? " " : " ") + next;
}

// New function to detect large block overlaps
function hasLargeBlockOverlap(existingText: string, newText: string): boolean {
  if (existingText.length < 200 || newText.length < 100) return false;
  
  const existingNorm = norm(existingText);
  const newNorm = norm(newText);
  
  // Check if 70% or more of the new text already exists in the existing text
  const newWords = newNorm.split(/\s+/).filter(Boolean);
  const existingWords = new Set(existingNorm.split(/\s+/).filter(Boolean));
  
  let matchingWords = 0;
  for (const word of newWords) {
    if (word.length > 3 && existingWords.has(word)) { // Only count meaningful words
      matchingWords++;
    }
  }
  
  const overlapRatio = matchingWords / newWords.length;
  if (overlapRatio > 0.75) {
    console.log(`🔍 Large block overlap detected: ${(overlapRatio * 100).toFixed(1)}% word overlap`);
    return true;
  }
  
  return false;
}

function dedupeTail(text: string) {
  const sents = splitSents(text);
  const out: string[] = [];
  for (const s of sents) {
    const recent = out.slice(-DEDUPE_WINDOW);
    const dup = recent.some(r => sim(r, s) >= DEDUPE_SIM_THRESHOLD);
    if (!dup) {
      out.push(s);
    } else {
      console.warn(`🚫 Filtered DUPLICATE sentence (${(sim(s, recent.find(r => sim(r, s) >= DEDUPE_SIM_THRESHOLD)!) * 100).toFixed(1)}% similar): "${s.substring(0, 80)}..."`);
    }
  }
  return out.join(" ");
}

export interface MergeResult {
  text: string;
  rejectionReason?: string;
  addedChars: number;
}

/**
 * Merge a final chunk into an accumulated, cleaned transcript.
 * - ignores non-final chunks (return prev unchanged)
 * - overlap-aware head/tail stitching
 * - sliding-window dedupe
 * Returns both the merged text AND diagnostic rejection reason
 */
export function mergeLive(prevText: string, chunk: LiveChunk): MergeResult {
  // Safety logging to catch incorrect function calls
  console.log(`🔍 mergeLive called:`, {
    prevLength: prevText.length,
    prevEnd: prevText.substring(Math.max(0, prevText.length - 150)),
    chunkTextPreview: chunk?.text?.substring(0, 100) || '(no text)',
    chunkLength: chunk?.text?.length || 0,
    isFinal: chunk?.isFinal
  });
  
  if (!chunk?.text || !chunk.text.trim()) {
    console.log(`📝 Ignoring empty chunk`);
    return { text: prevText, rejectionReason: 'Empty or whitespace-only chunk', addedChars: 0 };
  }
  
  if (chunk.isFinal === false) {
    console.log(`⏳ Ignoring non-final chunk: "${chunk.text.substring(0, 30)}..."`);
    return { text: prevText, rejectionReason: 'Non-final chunk (interim result)', addedChars: 0 };
  }

  console.log(`✅ Processing final chunk: "${chunk.text.substring(0, 80)}..." (${chunk.text.length} chars)`);

  const prev = norm(prevText);
  const next = norm(chunk.text);
  
  console.log(`🔄 Normalized text:`, {
    prevEnd: prev.substring(Math.max(0, prev.length - 150)),
    nextStart: next.substring(0, 150)
  });

  // stitch with overlap removal
  const stitched = stitchWithOverlap(prev, next);
  const afterStitch = stitched.length - prev.length;
  
  let rejectionReason: string | undefined;
  
  if (afterStitch === 0 && next.length > 10) {
    rejectionReason = `Stitch rejected: 100% overlap detected (similarity > ${STITCH_SIM_THRESHOLD})`;
    console.error(`⚠️ NO TEXT ADDED after stitchWithOverlap!`, {
      chunkLength: next.length,
      prevEnd: prev.substring(Math.max(0, prev.length - 200)),
      chunkText: next,
      reason: rejectionReason
    });
  } else if (afterStitch > 0) {
    console.log(`📝 Stitched: +${afterStitch} chars from ${next.length} char chunk`);
  }

  // run a small dedupe window on the tail
  const deduped = dedupeTail(stitched);
  const afterDedupe = deduped.length - prevText.length;

  console.log(`🔄 Live merge complete: ${prevText.length} -> ${deduped.length} chars (stitch: +${afterStitch}, dedupe final: +${afterDedupe})`);
  
  // More aggressive fallback to prevent data loss
  if (afterDedupe === 0 && chunk.text.length > 10) {
    if (!rejectionReason) {
      rejectionReason = `Dedupe rejected: Content matched recent sentences (similarity > ${DEDUPE_SIM_THRESHOLD})`;
    }
    
    console.error(`❌ CHUNK COMPLETELY REJECTED: No text added despite ${chunk.text.length} char input!`, {
      originalChunk: chunk.text,
      prevTranscriptEnd: prevText.substring(Math.max(0, prevText.length - 300)),
      stitchedLength: stitched.length,
      dedupedLength: deduped.length,
      afterStitch,
      afterDedupe,
      reason: rejectionReason
    });
    
    // Enhanced fallback: if nothing was added at all, force append with clear separator
    if (afterStitch === 0) {
      console.warn('✳️ CRITICAL: Stitch completely rejected chunk - forcing direct append');
      const separator = (/[.!?…]$/.test(prev) ? ' ' : '. ');
      return { 
        text: prev + separator + next, 
        rejectionReason: `${rejectionReason} (forced append used)`, 
        addedChars: next.length 
      };
    } else {
      console.warn('✳️ Dedupe rejected chunk - using stitched version');
      return { 
        text: stitched, 
        rejectionReason: `${rejectionReason} (using stitched version)`, 
        addedChars: afterStitch 
      };
    }
  }
  
  return { text: deduped, rejectionReason, addedChars: afterDedupe };
}