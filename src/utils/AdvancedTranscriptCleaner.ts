// Advanced Transcript Cleaning Pipeline
// Battle-tested approach for processing overlapping Whisper chunks

export interface Word {
  text: string;
  start: number;
  end: number;
}

export interface Segment {
  text: string;
  words: Word[];
  start: number;
  end: number;
  no_speech_prob?: number;
}

interface Fix {
  pattern: RegExp;
  replace: string;
}

// NHS/Medical glossary corrections
const NHS_GLOSSARY: Fix[] = [
  { pattern: /\bARRS\s+roll(s)?\b/gi, replace: 'ARRS role$1' },
  { pattern: /\bPCM\s*Diaz\b/gi, replace: 'PCN DES' },
  { pattern: /\bPCMDR'?s?\b/gi, replace: 'PCN DES' },
  { pattern: /\bCUC\b/g, replace: 'CQC' },
  { pattern: /\b[Ss]ystem\s+one\b/g, replace: 'SystmOne' },
  { pattern: /\barcacity\b/gi, replace: 'capacity' },
  { pattern: /\bDoc\s*Man\b/gi, replace: 'Docman' },
  { pattern: /\bNHS app\b/gi, replace: 'NHS App' },
  { pattern: /\bGP\s+practices?\b/gi, replace: 'GP practice$1' },
  { pattern: /\bpatient\s+list\s+sizes?\b/gi, replace: 'patient list size$1' },
  { pattern: /\bCare\s+Quality\s+Commission\b/gi, replace: 'CQC' },
  // Numbers & currency tidies
  { pattern: /\b7,?800\b/g, replace: '£7,800' },
  { pattern: /\b1,?500\b/g, replace: '1,500' },
  { pattern: /\btwenty\s+four\s+seven\b/gi, replace: '24/7' },
];

export class AdvancedTranscriptCleaner {
  private stats = {
    originalChunks: 0,
    overlapTrimmed: 0,
    duplicatesRemoved: 0,
    fragmentsJoined: 0,
    glossaryFixes: 0,
    finalSentences: 0,
  };

  // Generate n-grams from token array
  private ngrams(tokens: string[], n: number): Set<string> {
    const grams = new Set<string>();
    for (let i = 0; i <= tokens.length - n; i++) {
      grams.add(tokens.slice(i, i + n).join(' '));
    }
    return grams;
  }

  // Calculate Jaccard similarity between two sets
  private jaccard(setA: Set<string>, setB: Set<string>): number {
    const intersection = [...setA].filter(x => setB.has(x)).length;
    const union = new Set([...setA, ...setB]).size;
    return union ? intersection / union : 0;
  }

  // Convert word array to clean sentence
  private wordsToSentence(words: Word[]): string {
    return words
      .map(w => w.text)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Estimate overlap between two word sequences using n-gram similarity
  private estimateOverlapByNgram(
    prevTail: Word[],
    currHead: Word[],
    opts: { similarity: number; minWords: number }
  ): number {
    const prevTris = this.ngrams(
      prevTail.map(w => w.text.toLowerCase()),
      3
    );

    let bestOverlap = 0;
    for (let k = opts.minWords; k <= currHead.length; k++) {
      const candidate = currHead.slice(0, k).map(w => w.text.toLowerCase());
      const candTris = this.ngrams(candidate, 3);
      const similarity = this.jaccard(prevTris, candTris);
      
      if (similarity >= opts.similarity) {
        bestOverlap = k;
      }
    }
    
    if (bestOverlap > 0) {
      this.stats.overlapTrimmed++;
    }
    
    return bestOverlap;
  }

  // Join overlapping chunks using word timestamps
  private joinChunks(
    prev: Segment,
    curr: Segment,
    opts = {
      maxLookbackSec: 3.0,
      similarity: 0.93,
      minWords: 6,
    }
  ): Segment {
    // Take the last N seconds of previous segment as comparison window
    const startCut = Math.max(prev.end - opts.maxLookbackSec, prev.start);
    const prevTail = prev.words.filter(w => w.end >= startCut);

    // Compare with start of current segment
    const currHead = curr.words.slice(0, Math.min(curr.words.length, 60));
    const overlapLength = this.estimateOverlapByNgram(prevTail, currHead, opts);

    // Trim overlapping prefix from current segment
    const trimmedWords = curr.words.slice(overlapLength);
    const text = this.wordsToSentence(trimmedWords);

    return {
      text,
      words: trimmedWords,
      start: trimmedWords.length ? trimmedWords[0].start : curr.start,
      end: curr.end,
    };
  }

  // Calculate n-gram similarity between two sentences
  private ngramSimilarity(sent1: string, sent2: string, n = 3): number {
    const tokens1 = sent1.toLowerCase().split(/\s+/);
    const tokens2 = sent2.toLowerCase().split(/\s+/);
    
    const grams1 = this.ngrams(tokens1, n);
    const grams2 = this.ngrams(tokens2, n);
    
    return this.jaccard(grams1, grams2);
  }

  // Remove adjacent near-duplicates at sentence level
  private deduplicateAdjacent(sentences: string[], similarity = 0.94): string[] {
    const result: string[] = [];
    
    for (const sentence of sentences) {
      const lastSentence = result[result.length - 1];
      
      if (!lastSentence) {
        result.push(sentence);
        continue;
      }
      
      // Check similarity using both 2-grams and 3-grams for robustness
      const sim2 = this.ngramSimilarity(lastSentence, sentence, 2);
      const sim3 = this.ngramSimilarity(lastSentence, sentence, 3);
      const avgSim = (sim2 + sim3) / 2;
      
      if (avgSim >= similarity) {
        this.stats.duplicatesRemoved++;
        continue; // Skip near-duplicate
      }
      
      result.push(sentence);
    }
    
    return result;
  }

  // Smart join for sentence fragments
  private smartJoinFragments(sentences: string[]): string[] {
    const result: string[] = [];
    
    for (const sentence of sentences) {
      if (!result.length) {
        result.push(sentence);
        continue;
      }
      
      const prevSentence = result[result.length - 1];
      const prevEndsOpen = !/[.!?…]$/.test(prevSentence.trim());
      const startsLower = /^[a-z(]/.test(sentence.trim());
      const isShortConnector = sentence.trim().length < 15 && 
        /^(and|or|but|so|because|however|therefore|although)/i.test(sentence.trim());
      
      if (prevEndsOpen && (startsLower || isShortConnector)) {
        result[result.length - 1] = (prevSentence + ' ' + sentence)
          .replace(/\s+/g, ' ')
          .trim();
        this.stats.fragmentsJoined++;
      } else {
        result.push(sentence);
      }
    }
    
    return result;
  }

  // Apply NHS/medical glossary corrections
  private applyGlossary(text: string): string {
    let result = text;
    let fixCount = 0;
    
    for (const fix of NHS_GLOSSARY) {
      const matches = result.match(fix.pattern);
      if (matches) {
        fixCount += matches.length;
      }
      result = result.replace(fix.pattern, fix.replace);
    }
    
    this.stats.glossaryFixes += fixCount;
    return result;
  }

  // Final punctuation and spacing cleanup
  private finalCleanup(text: string): string {
    return text
      // Fix spacing around punctuation
      .replace(/\s+,/g, ',')
      .replace(/\s+\./g, '.')
      .replace(/\s+!/g, '!')
      .replace(/\s+\?/g, '?')
      .replace(/\(\s+/g, '(')
      .replace(/\s+\)/g, ')')
      // Normalize ellipses
      .replace(/\.{2,}/g, '…')
      // Fix multiple spaces
      .replace(/\s{2,}/g, ' ')
      // Fix common speech-to-text issues
      .replace(/\b([A-Z]{2,})\s+([A-Z]{2,})\b/g, '$1 $2')
      .replace(/\b(\d+)\s*([Pp]ercent)\b/g, '$1%')
      .replace(/\b([Pp])ound(s?)\s+(\d+)/g, '£$3')
      .trim();
  }

  // Main processing pipeline
  public processTranscript(
    chunks: Segment[],
    options = {
      overlapSimilarity: 0.93,
      duplicateSimilarity: 0.94,
      maxLookbackSec: 3.0,
      minOverlapWords: 6,
    }
  ): { text: string; stats: typeof this.stats } {
    // Reset stats
    this.stats = {
      originalChunks: chunks.length,
      overlapTrimmed: 0,
      duplicatesRemoved: 0,
      fragmentsJoined: 0,
      glossaryFixes: 0,
      finalSentences: 0,
    };

    if (!chunks.length) {
      return { text: '', stats: this.stats };
    }

    // 1. Filter out low-confidence segments if available
    const filteredChunks = chunks.filter(
      chunk => !chunk.no_speech_prob || chunk.no_speech_prob < 0.5
    );

    // 2. Overlap-aware joining
    const joinedSegments: Segment[] = [];
    
    for (const segment of filteredChunks) {
      if (!joinedSegments.length) {
        joinedSegments.push(segment);
        continue;
      }
      
      const prevSegment = joinedSegments[joinedSegments.length - 1];
      const trimmedSegment = this.joinChunks(prevSegment, segment, {
        maxLookbackSec: options.maxLookbackSec,
        similarity: options.overlapSimilarity,
        minWords: options.minOverlapWords,
      });
      
      // Merge with previous segment
      const combinedText = (prevSegment.text + ' ' + trimmedSegment.text)
        .replace(/\s+/g, ' ')
        .trim();
      
      joinedSegments[joinedSegments.length - 1] = {
        ...prevSegment,
        text: combinedText,
        words: [...prevSegment.words, ...trimmedSegment.words],
        end: trimmedSegment.end,
      };
    }

    // 3. Sentence segmentation
    const fullText = joinedSegments[0]?.text || '';
    let sentences = fullText
      .replace(/\s+/g, ' ')
      .split(/(?<=[.!?…])\s+(?=[A-Z("])/)
      .map(s => s.trim())
      .filter(Boolean);

    // 4. Smart fragment joining
    sentences = this.smartJoinFragments(sentences);

    // 5. Adjacent duplicate removal
    sentences = this.deduplicateAdjacent(sentences, options.duplicateSimilarity);

    // 6. Apply glossary corrections
    let finalText = this.applyGlossary(sentences.join(' '));

    // 7. Final cleanup
    finalText = this.finalCleanup(finalText);

    this.stats.finalSentences = sentences.length;

    return {
      text: finalText,
      stats: { ...this.stats },
    };
  }

  // Simulate processing from plain text (for testing without word timestamps)
  public processPlainText(
    text: string,
    options = {
      duplicateSimilarity: 0.94,
    }
  ): { text: string; stats: typeof this.stats } {
    // Reset stats
    this.stats = {
      originalChunks: 0,
      overlapTrimmed: 0,
      duplicatesRemoved: 0,
      fragmentsJoined: 0,
      glossaryFixes: 0,
      finalSentences: 0,
    };

    if (!text.trim()) {
      return { text: '', stats: this.stats };
    }

    // 1. Basic sentence segmentation
    let sentences = text
      .replace(/\s+/g, ' ')
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(Boolean)
      .map(s => s + '.');

    this.stats.originalChunks = sentences.length;

    // 2. Smart fragment joining
    sentences = this.smartJoinFragments(sentences);

    // 3. Adjacent duplicate removal
    sentences = this.deduplicateAdjacent(sentences, options.duplicateSimilarity);

    // 4. Apply glossary corrections
    let finalText = this.applyGlossary(sentences.join(' '));

    // 5. Final cleanup
    finalText = this.finalCleanup(finalText);

    this.stats.finalSentences = sentences.length;

    return {
      text: finalText,
      stats: { ...this.stats },
    };
  }
}

export default AdvancedTranscriptCleaner;