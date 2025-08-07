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
      // Repeated words (2+ times)
      /\b(\w+)(\s+\1){1,}\b/gi,
      // Audio instructions and technical terms
      /please use (earphones|headphones|headset|microphone)/gi,
      /check your (audio|microphone|speakers|headphones)/gi,
      /turn (on|off) your (microphone|camera|audio)/gi,
      // Audio quality descriptions (major hallucination source)
      /unclear audio/gi,
      /background noise/gi,
      /static/gi,
      /\[music\]/gi,
      /\[sound\]/gi,
      /\[noise\]/gi,
      // Repetitive audio descriptors
      /\b(music|audio)\b.*?\b(or|and)\b.*?\b(unclear|music|audio)\b/gi,
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
      "unclear audio",
      "background music",
      "background noise",
      "music",
      "speech and unclear audio",
      "or unclear audio",
      "and unclear audio",
      "please subscribe only clear english speech and ignore background noise, music, or unclear audio",
      "please subscribe, like, comment, and share",
      "if you have any questions or comments, please post them in the q&a section",
      "if you have any questions, please let me know in the comments",
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

    // Step 2: Remove overlapping dialogue segments
    if (options.removeHallucinations) {
      cleaned = this.removeOverlappingSegments(cleaned);
    }

    // Step 3: Remove excessive filler words (optional)
    if (options.removeFiller) {
      cleaned = this.removeExcessiveFiller(cleaned);
    }

    // Step 4: Fix basic grammar and spacing
    if (options.fixGrammar) {
      cleaned = this.fixBasicGrammar(cleaned);
    }

    // Step 5: Add punctuation
    if (options.addPunctuation) {
      cleaned = this.addPunctuation(cleaned);
    }

    // Step 6: Merge sentence fragments
    if (options.mergeFragments) {
      cleaned = this.mergeFragments(cleaned);
    }

    // Step 7: Final cleanup
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
   * Also catches longer repetitive patterns like "unclear audio, music, or unclear audio"
   */
  private removeShortRepeats(text: string): string {
    // Remove 2-3 word repeated segments  
    let cleaned = text.replace(/\b(\w{1,6}(?:\s+\w{1,6}){0,2})(\s+\1){1,}/gi, '$1');
    
    // Special case: remove repetitive "unclear audio, music" patterns
    cleaned = cleaned.replace(/(unclear audio[,\s]*music[,\s]*or\s+)+/gi, ' ');
    cleaned = cleaned.replace(/(music[,\s]*or\s+unclear audio[,\s]*)+/gi, ' ');
    
    // Remove any phrase that repeats more than 3 times in a row
    cleaned = cleaned.replace(/\b(.{5,20}?)\1{2,}/gi, '$1');
    
    return cleaned;
  }

  /**
   * Remove overlapping dialogue segments that repeat across different speakers
   */
  private removeOverlappingSegments(text: string): string {
    // Split text into sentences and normalize
    const sentences = text.split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    if (sentences.length <= 1) return text;

    // Find and remove duplicates, keeping the first occurrence
    const uniqueSentences: string[] = [];
    const seenSentences = new Set<string>();

    for (const sentence of sentences) {
      const normalized = sentence.toLowerCase()
        .replace(/speaker\s*/gi, '') // Remove speaker labels
        .replace(/\s+/g, ' ')
        .trim();
      
      // Skip if we've seen this exact sentence or a very similar one
      let isDuplicate = false;
      for (const seen of seenSentences) {
        // Check for exact match or high similarity (>80% overlap)
        if (seen === normalized || this.calculateSimilarity(seen, normalized) > 0.8) {
          isDuplicate = true;
          break;
        }
      }

      if (!isDuplicate && normalized.length > 3) {
        seenSentences.add(normalized);
        uniqueSentences.push(sentence);
      }
    }

    return uniqueSentences.join('. ') + (uniqueSentences.length > 0 ? '.' : '');
  }

  /**
   * Calculate similarity between two strings (0-1)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const words1 = str1.split(/\s+/);
    const words2 = str2.split(/\s+/);
    
    if (words1.length === 0 && words2.length === 0) return 1;
    if (words1.length === 0 || words2.length === 0) return 0;

    const set1 = new Set(words1);
    const set2 = new Set(words2);
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size;
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
