// src/utils/TranscriptCleaner.ts

export interface RemovedSegment {
  text: string;
  reason: string;
  timestamp: string;
  confidence?: number;
  type: 'hallucination' | 'low-confidence' | 'too-short' | 'duplicate' | 'quiet-section';
}

type Options = {
  // live-mode knobs
  liveThreshold?: number;   // near-dup sim threshold (0..1)
  liveWindow?: number;      // sentences to look back
  // final-mode knobs
  finalThreshold?: number;
  finalWindow?: number;
};

export class TranscriptCleaner {
  private liveThreshold: number;
  private liveWindow: number;
  private finalThreshold: number;
  private finalWindow: number;
  private removedSegments: RemovedSegment[] = []; // Track removed items

  constructor(opts?: Options) {
    this.liveThreshold  = opts?.liveThreshold  ?? 0.94; // conservative live
    this.liveWindow     = opts?.liveWindow     ?? 6;
    this.finalThreshold = opts?.finalThreshold ?? 0.97; // strict final
    this.finalWindow    = opts?.finalWindow    ?? 15;
  }

  // ---------- Public entry points ----------

  /** Use for streaming updates (low flicker). Pass previous full text + new chunk. */
  cleanStreamingAppend(prevText: string, newChunk: string, confidence?: number): string {
    if (!newChunk) return prevText || "";
    if (confidence !== undefined && confidence < 0.7) return prevText || "";

    // 1) Basic normalisation
    const prev = this.normWS(prevText);
    const chunk = this.normWS(this.stripSystem(newChunk));

    // 2) Cut overlap so we don't double-append
    const merged = this.mergeWithoutOverlap(prev, chunk);

    // 3) Light sentence-level dedupe
    const lightly = this.dedupeSentences(merged, this.liveThreshold, this.liveWindow);

    // 4) NHS corrections
    const corrected = this.applyNHSCorrections(lightly);

    // 5) Micro-tidy
    return this.microTidy(corrected);
  }

  /** Use once at end for export-quality output. */
  cleanFinal(fullText: string): string {
    if (!fullText) return "";

    // 1) Normalise, then split and join half-sentences
    const initial = this.normWS(fullText);
    const joined = this.joinHalfSentences(this.splitSentences(initial));

    // 2) Strict sentence-level dedupe
    const deduped = this.dedupeSentences(joined.join(" "), this.finalThreshold, this.finalWindow);

    // 3) NHS corrections
    const corrected = this.applyNHSCorrections(deduped);

    // 4) Final micro tidy
    return this.finalPolish(this.microTidy(corrected)).trim();
  }

  // Legacy compatibility methods (for gradual migration)
  cleanStreamingTranscript(prevText: string, newChunk: string, confidence?: number): string {
    // Legacy method - redirect to new API
    return this.cleanStreamingAppend(prevText, newChunk, confidence);
  }

  cleanTranscript(text: string, options?: any): string {
    // Legacy method - redirect to final clean
    return this.cleanFinal(text);
  }

  // Legacy removed segments compatibility
  getRemovedSegments(): RemovedSegment[] {
    return this.removedSegments;
  }

  addRemovedSegment(text: string, reason: string, confidence?: number, type: RemovedSegment['type'] = 'duplicate'): void {
    this.removedSegments.push({
      text,
      reason,
      timestamp: new Date().toISOString(),
      confidence,
      type
    });
  }

  clearRemovedSegments(): void {
    this.removedSegments = [];
  }

  // ---------- Normalisation & system noise ----------

  private normWS(t: string): string {
    return t.replace(/\s+/g, " ").trim();
  }

  private stripSystem(t: string): string {
    return t
      .replace(/\[(?:silence|no audio) detected\]/gi, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  // ---------- Chunk overlap removal ----------

  /**
   * Remove duplicated overlap when appending a new chunk to previous text.
   * Finds the best suffix of prev that matches the prefix of chunk using n-gram Jaccard.
   */
  private mergeWithoutOverlap(prev: string, chunk: string): string {
    if (!prev) return chunk;
    if (!chunk) return prev;

    const maxLook = Math.min(400, prev.length, chunk.length); // limit cost
    const tail = prev.slice(-maxLook);
    const head = chunk.slice(0, maxLook);

    const best = this.bestOverlapIndex(tail, head);
    if (best <= 0) return prev + " " + chunk;

    // Cut the overlapping part from the start of chunk
    return (prev + " " + chunk.slice(best)).replace(/\s{2,}/g, " ").trim();
  }

  /** Return index in head where overlap ends (number of chars to skip). */
  private bestOverlapIndex(tail: string, head: string): number {
    // Try several window sizes; compute bigram Jaccard on growing prefixes of head.
    const grams = (s: string, n = 2) => {
      const w = s.toLowerCase().split(/\s+/);
      const set = new Set<string>();
      for (let i = 0; i <= w.length - n; i++) set.add(w.slice(i, i + n).join(" "));
      return set;
    };

    let bestScore = 0;
    let bestIdx = 0;

    // Try multiple cut points on head (prefix lengths)
    const steps = 10;
    for (let i = 1; i <= steps; i++) {
      const cut = Math.floor((i / steps) * head.length);
      const h = head.slice(0, cut);
      if (h.length < 20) continue; // too tiny to trust

      const A2 = grams(tail, 2), B2 = grams(h, 2);
      const A3 = grams(tail, 3), B3 = grams(h, 3);

      const jac = (X: Set<string>, Y: Set<string>) => {
        const inter = [...X].filter(x => Y.has(x)).length;
        const uni = new Set([...X, ...Y]).size || 1;
        return inter / uni;
      };

      const score = Math.max(jac(A2, B2), jac(A3, B3));
      if (score > bestScore) {
        bestScore = score;
        bestIdx = cut;
      }
    }

    // Require a reasonable similarity to accept an overlap
    return bestScore >= 0.55 ? bestIdx : 0;
  }

  // ---------- Sentence segmentation & joining ----------

  private splitSentences(text: string): string[] {
    return text
      .split(/(?<=[.!?…])\s+(?=[A-Z""('\[])/) // sentence end + next starts with cap/quote/paren
      .map(s => s.trim())
      .filter(Boolean);
  }

  /** Merge split halves like "justify. requesting..." */
  private joinHalfSentences(sents: string[]): string[] {
    const out: string[] = [];
    for (const s of sents) {
      if (!out.length) { out.push(s); continue; }
      const prev = out[out.length - 1];
      const prevOpen = !/[.!?…]$/.test(prev);
      const startsLower = /^[a-z""(]/.test(s);
      if (prevOpen && startsLower) {
        out[out.length - 1] = (prev + " " + s).replace(/\s+/g, " ");
      } else {
        out.push(s);
      }
    }
    return out;
  }

  // ---------- Near-duplicate removal ----------

  private dedupeSentences(text: string, threshold: number, window: number): string {
    const sents = this.splitSentences(text);
    const out: string[] = [];

    const grams = (t: string, n: number) => {
      const w = t.toLowerCase().split(/\s+/);
      const set = new Set<string>();
      for (let i = 0; i <= w.length - n; i++) set.add(w.slice(i, i + n).join(" "));
      return set;
    };
    const jacc = (A: Set<string>, B: Set<string>) => {
      const inter = [...A].filter(x => B.has(x)).length;
      const uni = new Set([...A, ...B]).size || 1;
      return inter / uni;
    };
    const sim = (a: string, b: string) =>
      Math.max(jacc(grams(a, 2), grams(b, 2)), jacc(grams(a, 3), grams(b, 3)));

    for (const s of sents) {
      const recent = out.slice(-window);
      const dup = recent.some(r => sim(r, s) >= threshold);
      if (!dup) out.push(s);
    }
    return out.join(" ");
  }

  // ---------- NHS corrections ----------

  private applyNHSCorrections(text: string): string {
    const stringFixes: Array<[RegExp, string]> = [
      // Schemes / acronyms
      [/\bARS\b/gi, "ARRS"],
      [/\bIRS\b/gi, "ARRS"],
      [/\bARRS\b/gi, "ARRS"],
      [/\bPCN\s*DES\b/gi, "PCN DES"],
      [/\bPCM\s*D(AS|ES)?\b/gi, "PCN DES"],
      [/\bIIF\b/gi, "IIF"],
      [/\bQOF\b/gi, "QOF"],
      [/\bICB\b/gi, "ICB"],
      [/\bCQC\b/gi, "CQC"],
      // Systems / platforms
      [/\bDoc\s*man\b/gi, "Docman"],
      [/\bSystem\s*One\b/gi, "SystmOne"],
      [/\bSyst(?:em)?\s*1\b/gi, "SystmOne"],
      [/\bNHS app\b/gi, "NHS App"],
      // Common mis-hears seen in your data
      [/\bcall\s*cues\b/gi, "call queues"],
      [/\bcool\s*cues\b/gi, "call queues"],
      [/\bcall\s+que+e?s?\b/gi, "call queues"],
      [/\bsalary doctor\b/gi, "salaried doctor"],
      [/\bsmiles\b/gi, "SMRs"],
      [/\bsame day\b/gi, "same-day"],
      [/\bneighbo(u)?rhood\b/gi, "neighbourhood"],
      [/\bdocument workflow\b/gi, "Docman workflow"],
      [/\bstudy evil\b/gi, "study leave"],
      [/\bred(u|)ctions\b/gi, "redactions"],
      [/\bfridge(s)?\b/gi, "fridges"]
    ];
    
    let out = text;
    
    // Apply string replacements
    for (const [pat, rep] of stringFixes) {
      out = out.replace(pat, rep);
    }
    
    // Apply function replacements
    out = out.replace(/\blocum spend was about\s*£?\s*([0-9][0-9,\.]*)\b/gi, (match, n) => `locum spend was about £${n}`);
    
    return out;
  }

  // ---------- Micro tidy / polish ----------

  private microTidy(text: string): string {
    return text
      .replace(/\b(No\?\s+){2,}/gi, "No? ")
      .replace(/\s+,/g, ",")
      .replace(/\(\s+/g, "(")
      .replace(/\s+\)/g, ")")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  private finalPolish(text: string): string {
    return text
      // kill a few known echo patterns if they slipped through
      .replace(/(\baround 120 new registrations[^.]*\.)\s+\1/gi, "$1")
      .replace(/(list size is now just over\s*12,?600[^.]*\.)\s+\1/gi, "$1")
      .replace(/(we can'?t create more same-?day appointments[^.]*\.)\s+\1/gi, "$1")
      .trim();
  }
}

// Export singleton instance for backward compatibility
export const transcriptCleaner = new TranscriptCleaner();