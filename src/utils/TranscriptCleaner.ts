/**
 * Advanced Transcript Cleaning Service
 * Cleans and formats transcripts in real-time by removing hallucinations,
 * fixing grammar, and improving readability
 */

export interface CleaningOptions {
  removeHallucinations: boolean;
  fixGrammar: boolean;
  addPunctuation: boolean;
  removeFiller: boolean;
  mergeFragments: boolean;
}

export class TranscriptCleaner {
  private hallucinationPatterns: RegExp[];
  private fillerWords: RegExp;
  private commonHallucinations: string[];
  
  constructor() {
    // Common hallucination patterns
    this.hallucinationPatterns = [
      // Repeated words (3+ times)
      /\b(\w+)(\s+\1){2,}\b/gi,
      // Audio instructions
      /please use (earphones|headphones|headset|microphone)/gi,
      /check your (audio|microphone|speakers|headphones)/gi,
      /turn (on|off) your (microphone|camera|audio)/gi,
      // Generic meeting phrases that appear incorrectly
      /thank you for watching/gi,
      /thanks for listening/gi,
      /see you (next time|later|soon)/gi,
      /goodbye everyone/gi,
      /that's all for today/gi,
      // Technical artifacts
      /\[inaudible\]/gi,
      /\[unclear\]/gi,
      /\[background noise\]/gi,
      /\[static\]/gi,
      // Whisper model artifacts
      /transcript provided by/gi,
      /subtitles by/gi,
      /closed captioning/gi,
      // Music and sound references when not contextual
      /♪.*?♪/g,
      /\[music\]/gi,
      /\[applause\]/gi,
      /\[laughter\] \[laughter\]/gi, // Repeated laughter
    ];

    // Common filler words and phrases
    this.fillerWords = /\b(um+|uh+|er+|ah+|like|you know|basically|actually|literally|sort of|kind of)\b/gi;

    // Specific hallucination phrases
    this.commonHallucinations = [
      "please use earphones or a headset",
      "please use headphones",
      "check your microphone",
      "turn on your microphone",
      "can you hear me",
      "testing testing",
      "hello hello",
      "mic check",
      "one two three",
      "thank you for watching",
      "goodbye everyone",
      "see you next time",
      "that's all for today",
      "transcript provided by",
      "subtitles by",
      "closed captioning",
      "automatic transcript",
      "this meeting is being recorded in english",
      "this meeting is being recorded",
      "recording in progress",
      "this call is being recorded",
      "this session is being recorded",
      "recording has started",
      "recording will begin",
      "start recording",
      "stop recording",
      "recording stopped",
      "meeting recording enabled",
      "audio is being captured",
      "voice recording active",
    ];
  }

  /**
   * Main cleaning function - processes transcript text
   */
  cleanTranscript(text: string, options: CleaningOptions = {
    removeHallucinations: true,
    fixGrammar: true,
    addPunctuation: true,
    removeFiller: false, // Keep false by default to preserve natural speech
    mergeFragments: true
  }): string {
    if (!text || typeof text !== 'string') return '';

    let cleaned = text.trim();

    // Step 1: Remove obvious hallucinations
    if (options.removeHallucinations) {
      cleaned = this.removeHallucinations(cleaned);
    }

    // Step 2: Remove excessive filler words (optional)
    if (options.removeFiller) {
      cleaned = this.removeExcessiveFiller(cleaned);
    }

    // Step 3: Fix basic grammar and spacing
    if (options.fixGrammar) {
      cleaned = this.fixBasicGrammar(cleaned);
    }

    // Step 4: Add punctuation
    if (options.addPunctuation) {
      cleaned = this.addPunctuation(cleaned);
    }

    // Step 5: Merge sentence fragments
    if (options.mergeFragments) {
      cleaned = this.mergeFragments(cleaned);
    }

    // Step 6: Final cleanup
    cleaned = this.finalCleanup(cleaned);

    return cleaned;
  }

  /**
   * Remove hallucinations and artifacts
   */
  private removeHallucinations(text: string): string {
    let cleaned = text;

    // Remove using regex patterns
    this.hallucinationPatterns.forEach(pattern => {
      cleaned = cleaned.replace(pattern, ' ');
    });

    // Remove specific phrases (case insensitive)
    this.commonHallucinations.forEach(phrase => {
      const regex = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      cleaned = cleaned.replace(regex, ' ');
    });

    // Remove very short repeated segments
    cleaned = this.removeShortRepeats(cleaned);

    return cleaned;
  }

  /**
   * Remove short repeated segments like "the the the" or "and and"
   */
  private removeShortRepeats(text: string): string {
    // Remove 2-3 word repeated segments
    return text.replace(/\b(\w{1,6}(?:\s+\w{1,6}){0,2})(\s+\1){1,}/gi, '$1');
  }

  /**
   * Remove excessive filler words but keep some natural speech patterns
   */
  private removeExcessiveFiller(text: string): string {
    // Only remove if there are 3+ filler words in close proximity
    const words = text.split(/\s+/);
    const cleaned: string[] = [];
    let consecutiveFiller = 0;

    words.forEach(word => {
      if (this.fillerWords.test(word)) {
        consecutiveFiller++;
        // Keep first 2 filler words, remove the rest
        if (consecutiveFiller <= 2) {
          cleaned.push(word);
        }
      } else {
        consecutiveFiller = 0;
        cleaned.push(word);
      }
    });

    return cleaned.join(' ');
  }

  /**
   * Fix basic grammar and spacing issues
   */
  private fixBasicGrammar(text: string): string {
    let fixed = text;

    // Fix spacing around punctuation
    fixed = fixed.replace(/\s+([.!?,:;])/g, '$1');
    fixed = fixed.replace(/([.!?])\s*([a-z])/g, '$1 $2');
    
    // Fix multiple spaces
    fixed = fixed.replace(/\s+/g, ' ');

    // Fix common speech-to-text errors
    fixed = fixed.replace(/\bi\b/g, 'I'); // Capitalize standalone 'i'
    fixed = fixed.replace(/\b(im|ive|ill|id|wont|cant|dont|didnt|isnt|arent|wasnt|werent)\b/gi, (match) => {
      const corrections: { [key: string]: string } = {
        'im': "I'm", 'ive': "I've", 'ill': "I'll", 'id': "I'd",
        'wont': "won't", 'cant': "can't", 'dont': "don't",
        'didnt': "didn't", 'isnt': "isn't", 'arent': "aren't",
        'wasnt': "wasn't", 'werent': "weren't"
      };
      return corrections[match.toLowerCase()] || match;
    });

    return fixed;
  }

  /**
   * Add basic punctuation based on speech patterns
   */
  private addPunctuation(text: string): string {
    let punctuated = text;

    // Add periods at natural sentence breaks
    punctuated = punctuated.replace(/\b(and then|so then|after that|next|finally)\s+/gi, '$1. ');
    
    // Add commas for natural pauses
    punctuated = punctuated.replace(/\b(however|therefore|moreover|furthermore|meanwhile)\s+/gi, ', $1 ');
    
    // Ensure sentences end with periods if they don't have punctuation
    punctuated = punctuated.replace(/([a-z])\s*$/i, '$1.');

    return punctuated;
  }

  /**
   * Merge sentence fragments into complete sentences
   */
  private mergeFragments(text: string): string {
    // Split into potential sentences
    const fragments = text.split(/[.!?]+/).filter(f => f.trim());
    const merged: string[] = [];

    fragments.forEach((fragment, index) => {
      const trimmed = fragment.trim();
      if (!trimmed) return;

      // If fragment is very short and doesn't start with capital letter,
      // try to merge with previous sentence
      if (trimmed.length < 15 && index > 0 && !/^[A-Z]/.test(trimmed)) {
        if (merged.length > 0) {
          merged[merged.length - 1] += ' ' + trimmed;
        } else {
          merged.push(trimmed);
        }
      } else {
        // Capitalize first letter
        const capitalized = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
        merged.push(capitalized);
      }
    });

    return merged.join('. ') + (merged.length > 0 ? '.' : '');
  }

  /**
   * Final cleanup pass
   */
  private finalCleanup(text: string): string {
    let cleaned = text;

    // Remove empty sentences
    cleaned = cleaned.replace(/\.\s*\./g, '.');
    
    // Fix spacing
    cleaned = cleaned.replace(/\s+/g, ' ');
    
    // Remove leading/trailing spaces
    cleaned = cleaned.trim();

    // Ensure proper sentence ending
    if (cleaned && !/[.!?]$/.test(cleaned)) {
      cleaned += '.';
    }

    return cleaned;
  }

  /**
   * Quick check if text contains obvious hallucinations
   */
  isLikelyHallucination(text: string): boolean {
    if (!text || text.length < 3) return true;

    const lowerText = text.toLowerCase();

    // Check for specific hallucination phrases
    const hasHallucinationPhrase = this.commonHallucinations.some(phrase => 
      lowerText.includes(phrase.toLowerCase())
    );

    // Check for excessive repetition
    const words = text.split(/\s+/);
    if (words.length >= 3) {
      const uniqueWords = new Set(words.map(w => w.toLowerCase()));
      const repetitionRatio = uniqueWords.size / words.length;
      if (repetitionRatio < 0.5) return true; // More than 50% repeated words
    }

    // Check for very short repeated patterns
    const hasShortRepeats = /\b(\w{1,3})\s+\1\s+\1/i.test(text);

    return hasHallucinationPhrase || hasShortRepeats;
  }

  /**
   * Clean transcript in real-time (for streaming)
   */
  cleanStreamingTranscript(currentText: string, newSegment: string): string {
    // First check if new segment is likely hallucination
    if (this.isLikelyHallucination(newSegment)) {
      console.log('🚫 Filtering out likely hallucination:', newSegment);
      return currentText; // Don't add the hallucination
    }

    // Combine and clean
    const combined = currentText + (currentText ? ' ' : '') + newSegment;
    return this.cleanTranscript(combined, {
      removeHallucinations: true,
      fixGrammar: true,
      addPunctuation: false, // Don't add punctuation for live text
      removeFiller: false,
      mergeFragments: false // Don't merge fragments for live updates
    });
  }
}

// Singleton instance for use across the app
export const transcriptCleaner = new TranscriptCleaner();
