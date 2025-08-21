// Streaming version of AdvancedTranscriptCleaner for real-time transcript processing
// Implements ChatGPT's enhanced overlap detection and deduplication

import { AdvancedTranscriptCleaner, type Word, type Segment } from './AdvancedTranscriptCleaner';

export interface StreamingSegment {
  text: string;
  timestamp?: number;
  words?: Word[];
  confidence?: number;
  is_final?: boolean;
}

export class StreamingTranscriptCleaner {
  private advancedCleaner = new AdvancedTranscriptCleaner();
  private accumulatedSegments: StreamingSegment[] = [];
  private lastProcessedText = '';
  
  // ChatGPT's fallback joiner for text without word timestamps
  private overlapJoinText(prevText: string, currText: string): string {
    if (!prevText || !currText) return currText || prevText || '';
    
    const tail = prevText.slice(-250);
    const head = currText.slice(0, 250);
    const tokensA = tail.toLowerCase().split(/\s+/).filter(Boolean);
    const tokensB = head.toLowerCase().split(/\s+/).filter(Boolean);

    const trisA = this.ngrams(tokensA, 3);
    let bestCut = 0;
    
    for (let k = 6; k <= tokensB.length; k++) {
      const trisB = this.ngrams(tokensB.slice(0, k), 3);
      const sim = this.jaccard(trisA, trisB);
      if (sim >= 0.93 && k > bestCut) { 
        bestCut = k; 
      }
    }
    
    const cutChars = tokensB.slice(0, bestCut).join(" ").length;
    const cutPoint = head.toLowerCase().indexOf(tokensB.slice(0, bestCut).join(" ").toLowerCase());
    const cutAt = (bestCut && cutPoint >= 0) ? cutPoint + cutChars : 0;
    const currTrimmed = currText.slice(cutAt).replace(/^\s+/, "");
    
    return (prevText + " " + currTrimmed).replace(/\s+/g, " ").trim();
  }

  // Helper methods from AdvancedTranscriptCleaner
  private ngrams(tokens: string[], n: number): Set<string> {
    const grams = new Set<string>();
    for (let i = 0; i <= tokens.length - n; i++) {
      grams.add(tokens.slice(i, i + n).join(' '));
    }
    return grams;
  }

  private jaccard(setA: Set<string>, setB: Set<string>): number {
    const intersection = [...setA].filter(x => setB.has(x)).length;
    const union = new Set([...setA, ...setB]).size;
    return union ? intersection / union : 0;
  }

  // Process new streaming segment with smart overlap detection
  public processStreamingSegment(newSegment: StreamingSegment): {
    text: string;
    isUpdate: boolean;
    stats: any;
  } {
    console.log('🔄 Processing streaming segment:', newSegment.text.substring(0, 50));
    
    // Handle empty or very short segments
    if (!newSegment.text || newSegment.text.trim().length < 3) {
      return { text: this.lastProcessedText, isUpdate: false, stats: {} };
    }

    // Check if this is a cumulative update (Whisper often sends growing transcripts)
    const isCumulative = this.detectCumulativeUpdate(this.lastProcessedText, newSegment.text);
    
    if (isCumulative) {
      console.log('📝 Detected cumulative update, replacing entire transcript');
      // Process as single segment with advanced cleaner
      const result = this.advancedCleaner.processPlainText(newSegment.text);
      this.lastProcessedText = result.text;
      return { text: result.text, isUpdate: true, stats: result.stats };
    }

    // Handle incremental addition
    let combinedText: string;
    
    if (newSegment.words && this.accumulatedSegments.length > 0) {
      // Use word-timestamp based joining if available
      console.log('🎯 Using word-timestamp based overlap detection');
      const lastSegment = this.accumulatedSegments[this.accumulatedSegments.length - 1];
      
      if (lastSegment.words) {
        // Convert to Segment format for AdvancedTranscriptCleaner
        const prevSegment: Segment = {
          text: lastSegment.text,
          words: lastSegment.words,
          start: lastSegment.words[0]?.start || 0,
          end: lastSegment.words[lastSegment.words.length - 1]?.end || 0,
        };
        
        const currSegment: Segment = {
          text: newSegment.text,
          words: newSegment.words,
          start: newSegment.words[0]?.start || 0,
          end: newSegment.words[newSegment.words.length - 1]?.end || 0,
        };
        
        const result = this.advancedCleaner.processTranscript([prevSegment, currSegment]);
        combinedText = result.text;
      } else {
        // Fallback to text-based joining
        combinedText = this.overlapJoinText(this.lastProcessedText, newSegment.text);
      }
    } else {
      // Fallback to text-based joining
      console.log('📄 Using text-based overlap detection');
      combinedText = this.overlapJoinText(this.lastProcessedText, newSegment.text);
    }

    // Apply final cleaning
    const result = this.advancedCleaner.processPlainText(combinedText);
    this.lastProcessedText = result.text;
    this.accumulatedSegments.push(newSegment);
    
    // Keep only last 10 segments to prevent memory bloat
    if (this.accumulatedSegments.length > 10) {
      this.accumulatedSegments = this.accumulatedSegments.slice(-5);
    }

    return { text: result.text, isUpdate: true, stats: result.stats };
  }

  // Detect if new text is a cumulative update vs incremental addition
  private detectCumulativeUpdate(prevText: string, newText: string): boolean {
    if (!prevText || !newText) return false;
    
    // If new text is significantly longer and contains most of previous text
    if (newText.length > prevText.length * 1.2) {
      const prevWords = prevText.toLowerCase().split(/\s+/).slice(0, 20);
      const newWords = newText.toLowerCase().split(/\s+/);
      
      let matchCount = 0;
      for (const prevWord of prevWords) {
        if (newWords.some(word => word.includes(prevWord) || prevWord.includes(word))) {
          matchCount++;
        }
      }
      
      // If 70% of sample words match, it's likely cumulative
      return matchCount / prevWords.length > 0.7;
    }
    
    return false;
  }

  // Reset the cleaner state
  public reset(): void {
    this.accumulatedSegments = [];
    this.lastProcessedText = '';
    console.log('🔄 Streaming transcript cleaner reset');
  }

  // Get current cleaned text
  public getCurrentText(): string {
    return this.lastProcessedText;
  }

  // Get processing stats
  public getStats(): any {
    return {
      accumulatedSegments: this.accumulatedSegments.length,
      lastTextLength: this.lastProcessedText.length,
    };
  }
}

// Export singleton instance
export const streamingTranscriptCleaner = new StreamingTranscriptCleaner();
