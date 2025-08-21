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
  confidenceThreshold?: number; // New: minimum confidence threshold (0-1)
  minimumLength?: number; // New: minimum segment length to keep
}

export interface RemovedSegment {
  text: string;
  reason: string;
  timestamp: string;
  confidence?: number;
  type: 'hallucination' | 'low-confidence' | 'too-short' | 'duplicate' | 'quiet-section';
}

export class TranscriptCleaner {
  private hallucinationPatterns: RegExp[];
  private fillerWords: RegExp;
  private commonHallucinations: string[];
  private lastConfidence: number = 1.0; // Track last known confidence
  private removedSegments: RemovedSegment[] = []; // Track removed items
  
  constructor() {
    // Common hallucination patterns
    this.hallucinationPatterns = [
      // FIXED: Only remove actual repeated complete words (3+ times to be safe)
      /\b(\w+)(\s+\1){2,}\b/gi, // Only match 3+ repetitions, not 2+
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
      // Quiet section specific hallucinations
      "hmm",
      "mm",
      "uh-huh",
      "yeah",
      "ok",
      "okay",
      "right",
      "bye",
      "bye bye", 
      "goodbye",
      "thanks",
      "thank you",
      "good",
      "well",
      "so",
      "now",
      "yes",
      "no",
      "hello",
      "hi",
      "oh",
      "ah",
      "eh",
      "hm",
      "mm-hmm",
      "uh-oh",
      "oops",
      "wow",
      "hey",
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

    // Remove specific phrases (case insensitive) - FIXED: Use word boundaries to prevent partial matches
    this.commonHallucinations.forEach(phrase => {
      // Only match complete standalone words/phrases, not parts of other words
      const regex = new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
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
    // FIXED: Only remove actual repeated words, not partial matches
    // Remove complete word repetitions (e.g., "the the the" -> "the")
    let cleaned = text.replace(/\b(\w+)(\s+\1){2,}\b/gi, '$1');
    
    // Remove two-word phrase repetitions (e.g., "you know you know" -> "you know")
    cleaned = cleaned.replace(/\b(\w+\s+\w+)(\s+\1){1,}\b/gi, '$1');
    
    // Special case: remove repetitive "unclear audio, music" patterns
    cleaned = cleaned.replace(/(unclear audio[,\s]*music[,\s]*or\s+)+/gi, ' ');
    cleaned = cleaned.replace(/(music[,\s]*or\s+unclear audio[,\s]*)+/gi, ' ');
    
    // DISABLED: This was causing word corruption
    // cleaned = cleaned.replace(/\b(.{5,20}?)\1{2,}/gi, '$1');
    
    return cleaned;
  }

  /**
   * Remove overlapping dialogue segments that repeat across different speakers
   */
  private removeOverlappingSegments(text: string): string {
    // First, handle large block duplicates (like entire paragraphs repeated)
    let cleaned = this.removeLargeBlockDuplicates(text);
    
    // Then handle sentence-level duplicates
    const sentences = cleaned.split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    if (sentences.length <= 1) return cleaned;

    // Remove exact duplicates first
    const uniqueSentences: string[] = [];
    const seenExact = new Set<string>();

    for (const sentence of sentences) {
      const normalized = sentence.toLowerCase().trim();
      if (!seenExact.has(normalized) && normalized.length > 2) {
        seenExact.add(normalized);
        uniqueSentences.push(sentence);
      }
    }

    // Now check for similar overlaps
    const finalSentences: string[] = [];
    
    for (let i = 0; i < uniqueSentences.length; i++) {
      const current = uniqueSentences[i];
      let isDuplicate = false;
      
      // Check against already added sentences
      for (const existing of finalSentences) {
        if (this.calculateSimilarity(current.toLowerCase(), existing.toLowerCase()) > 0.85) {
          this.addRemovedSegment(current, `Duplicate sentence (${Math.round(this.calculateSimilarity(current.toLowerCase(), existing.toLowerCase()) * 100)}% similar)`, undefined, 'duplicate');
          console.log(`🚫 Removing similar segment: "${current.substring(0, 50)}..."`);
          isDuplicate = true;
          break;
        }
      }
      
      if (!isDuplicate) {
        finalSentences.push(current);
      }
    }

    const result = finalSentences.join('. ') + (finalSentences.length > 0 ? '.' : '');
    
    // Log the deduplication if it made a significant change
    if (text.length - result.length > 50) {
      console.log(`🧹 Deduplication removed ${text.length - result.length} characters of overlap`);
    }
    
    return result;
  }

  /**
   * Remove large block duplicates (entire paragraphs/sections repeated)
   */
  private removeLargeBlockDuplicates(text: string): string {
    // Split text into chunks by looking for natural breaks
    const chunks = text.split(/(?:[.!?]\s+){2,}/).filter(chunk => chunk.trim().length > 10);
    
    if (chunks.length <= 1) return text;
    
    const uniqueChunks: string[] = [];
    const seenChunks = new Set<string>();
    
    for (const chunk of chunks) {
      const normalized = chunk.toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
      
      // Check for exact or very high similarity matches
      let isDuplicate = false;
      for (const seen of seenChunks) {
        const similarity = this.calculateSimilarity(normalized, seen);
        if (similarity > 0.9) {
          this.addRemovedSegment(chunk, `Duplicate block (${Math.round(similarity * 100)}% similar)`, undefined, 'duplicate');
          console.log(`🚫 Removing duplicate block (${Math.round(similarity * 100)}% similar):`, chunk.substring(0, 80) + '...');
          isDuplicate = true;
          break;
        }
      }
      
      if (!isDuplicate) {
        seenChunks.add(normalized);
        uniqueChunks.push(chunk.trim());
      }
    }
    
    return uniqueChunks.join('. ');
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
   * Enhanced check that includes confidence and length filtering
   */
  isLikelyHallucinationWithMetrics(text: string, confidence?: number, options?: CleaningOptions): boolean {
    // Apply basic hallucination check first
    if (this.isLikelyHallucination(text)) {
      this.addRemovedSegment(text, 'Common hallucination pattern detected', confidence, 'hallucination');
      return true;
    }

    // Apply confidence threshold if provided
    if (confidence !== undefined && options?.confidenceThreshold !== undefined) {
      if (confidence < options.confidenceThreshold) {
        this.addRemovedSegment(text, `Low confidence: ${Math.round(confidence * 100)}%`, confidence, 'low-confidence');
        console.log(`🚫 Low confidence segment (${Math.round(confidence * 100)}%):`, text.substring(0, 50) + '...');
        return true;
      }
    }

    // Apply minimum length filter
    if (options?.minimumLength !== undefined) {
      const trimmedText = text.trim();
      if (trimmedText.length < options.minimumLength) {
        this.addRemovedSegment(text, `Too short: ${trimmedText.length} characters`, confidence, 'too-short');
        console.log(`🚫 Too short segment (${trimmedText.length} chars):`, trimmedText);
        return true;
      }
    }

    // Check for quiet-section specific patterns
    if (this.isQuietSectionHallucination(text)) {
      this.addRemovedSegment(text, 'Quiet section filler word/phrase', confidence, 'quiet-section');
      console.log('🚫 Quiet section hallucination detected:', text);
      return true;
    }

    return false;
  }

  /**
   * Detect hallucinations specific to quiet sections
   */
  private isQuietSectionHallucination(text: string): boolean {
    const trimmed = text.trim().toLowerCase();
    
    // Very short standalone words that often appear in quiet sections
    const quietHallucinations = [
      /^(hmm|mm|uh|oh|ah|eh|hm)\.?$/,
      /^(bye|hi|hello|yeah|yes|no|ok|okay|right|good|well|so|now)\.?$/,
      /^(thanks?|thank you)\.?$/,
      /^(wow|hey|oops)\.?$/,
    ];

    // Check if the entire text matches quiet section patterns
    return quietHallucinations.some(pattern => pattern.test(trimmed));
  }

  /**
   * Clean transcript with confidence filtering
   */
  cleanTranscriptWithConfidence(text: string, confidence?: number, options: CleaningOptions = {
    removeHallucinations: true,
    fixGrammar: true,
    addPunctuation: true,
    removeFiller: false,
    mergeFragments: true,
    confidenceThreshold: 0.6, // Default 60% confidence threshold
    minimumLength: 3 // Default minimum 3 characters
  }): string {
    // Skip cleaning if segment is likely hallucination based on metrics
    if (this.isLikelyHallucinationWithMetrics(text, confidence, options)) {
      return ''; // Return empty string to filter out the segment
    }

    // Apply normal cleaning
    return this.cleanTranscript(text, options);
  }

  /**
   * Clean transcript in real-time (for streaming) with enhanced filtering
   */
  cleanStreamingTranscript(currentText: string, newSegment: string, confidence?: number): string {
    // Enhanced filtering options for streaming
    const streamingOptions: CleaningOptions = {
      removeHallucinations: true,
      fixGrammar: true,
      addPunctuation: false, // Don't add punctuation for live text
      removeFiller: false,
      mergeFragments: false, // Don't merge fragments for live updates
      confidenceThreshold: 0.5, // Lower threshold for real-time (50%)
      minimumLength: 2 // Minimum 2 characters for real-time
    };

    // First check if new segment should be filtered out
    if (this.isLikelyHallucinationWithMetrics(newSegment, confidence, streamingOptions)) {
      console.log('🚫 Filtering out segment:', newSegment);
      return currentText; // Don't add the hallucination
    }

    // Combine and clean
    const combined = currentText + (currentText ? ' ' : '') + newSegment;
    return this.cleanTranscript(combined, streamingOptions);
  }

  /**
   * Add a removed segment to the tracking list
   */
  private addRemovedSegment(text: string, reason: string, confidence?: number, type: RemovedSegment['type'] = 'hallucination') {
    const segment: RemovedSegment = {
      text: text.trim(),
      reason,
      timestamp: new Date().toISOString(),
      confidence,
      type
    };
    
    this.removedSegments.push(segment);
    
    // Keep only the last 100 removed segments to prevent memory issues
    if (this.removedSegments.length > 100) {
      this.removedSegments = this.removedSegments.slice(-100);
    }
  }

  /**
   * Get all removed segments for review
   */
  getRemovedSegments(): RemovedSegment[] {
    return [...this.removedSegments]; // Return a copy
  }

  /**
   * Clear the removed segments list
   */
  clearRemovedSegments() {
    this.removedSegments = [];
  }

  /**
   * Get removed segments by type
   */
  getRemovedSegmentsByType(type: RemovedSegment['type']): RemovedSegment[] {
    return this.removedSegments.filter(segment => segment.type === type);
  }
}

// Singleton instance for use across the app
export const transcriptCleaner = new TranscriptCleaner();
