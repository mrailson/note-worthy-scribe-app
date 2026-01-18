// Enhanced timestamp-based segment merger to prevent large-scale duplications
import { mergeByTimestamps, segmentsToPlainText, type Segment } from "@/lib/segmentMerge";
import { isLikelyHallucination } from "@/utils/whisperHallucinationPatterns";

export interface TimestampedChunk {
  text: string;
  start_ms?: number;
  end_ms?: number;
  timestamp?: number;
  confidence?: number;
  isFinal?: boolean;
  source?: string;
  speaker?: string;
  id?: string;
}

export interface MergerState {
  finalizedSegments: Segment[];
  lastProcessedTimestamp: number;
  contentHashes: Set<string>;
  lastText: string;
  recentSentences: string[];  // For cross-chunk repetition detection
}

export interface ChunkProcessResult {
  text: string;
  wasProcessed: boolean;
  reason?: string;
  wasHallucination?: boolean;
}

export class TimestampedSegmentMerger {
  private static readonly GRACE_MS = 50; // Reduced to 50ms for stricter timing (was 100ms)
  private static readonly MIN_SEGMENT_LENGTH = 8; // Slightly reduced minimum length
  private static readonly HASH_LENGTH = 80; // Reduced hash length for better duplicate detection
  private static readonly OVERLAP_THRESHOLD = 0.75; // balanced overlap detection
  private static readonly CROSS_CHUNK_SIMILARITY_THRESHOLD = 0.85; // For detecting repeated sentences
  private static readonly MAX_RECENT_SENTENCES = 50; // Track last N sentences for repetition detection
  
  private state: MergerState;
  
  constructor() {
    this.state = {
      finalizedSegments: [],
      lastProcessedTimestamp: 0,
      contentHashes: new Set(),
      lastText: '',
      recentSentences: []
    };
  }

  /**
   * Process a new chunk with strict timestamp-based deduplication
   */
  processChunk(chunk: TimestampedChunk): ChunkProcessResult {
    const hasRealTs = chunk.start_ms !== undefined && chunk.start_ms > 0;
    console.log(`🔍 [Merger] Processing chunk: confidence=${((chunk.confidence ?? 0) * 100).toFixed(0)}%, length=${chunk.text?.length ?? 0}, id=${chunk.id}, hasRealTimestamps=${hasRealTs}, start_ms=${chunk.start_ms}, end_ms=${chunk.end_ms}`);

    const trimmed = chunk.text?.trim() ?? '';
    // CRITICAL: always allow the very first chunk even if very short
    const isFirstChunk = this.state.finalizedSegments.length === 0 && !this.state.lastText;
    const minLen = isFirstChunk ? 1 : TimestampedSegmentMerger.MIN_SEGMENT_LENGTH;

    if (!trimmed || trimmed.length < minLen) {
      console.log(`🚫 [Merger] Rejected: too short (${chunk.text?.length ?? 0} chars, min ${minLen})`);
      return { text: this.state.lastText, wasProcessed: false, reason: 'Chunk too short or empty' };
    }

    // Only process final chunks to avoid duplicates from interim updates
    if (chunk.isFinal === false) {
      console.log(`⏳ [Merger] Skipping interim chunk: "${chunk.text.substring(0, 30)}..."`);
      return { text: this.state.lastText, wasProcessed: false, reason: 'Interim chunk ignored' };
    }

    // HALLUCINATION CHECK - Defence in depth at merger level
    const hallucinationCheck = isLikelyHallucination(chunk.text, chunk.confidence, {
      confidenceThreshold: 0.30  // Match our hard gate threshold
    });
    if (hallucinationCheck.isHallucination) {
      console.log(`🚫 Hallucination detected in merger: ${hallucinationCheck.reason}`);
      return { 
        text: this.state.lastText, 
        wasProcessed: false, 
        reason: hallucinationCheck.reason,
        wasHallucination: true
      };
    }

    // CROSS-CHUNK REPETITION CHECK - Detect "end of webinar" loops
    const crossChunkRepetition = this.detectCrossChunkRepetition(chunk.text);
    if (crossChunkRepetition.isRepetitive) {
      console.log(`🚫 Cross-chunk repetition detected: ${crossChunkRepetition.reason}`);
      return { 
        text: this.state.lastText, 
        wasProcessed: false, 
        reason: crossChunkRepetition.reason 
      };
    }

    const hasRealTimestamps = chunk.start_ms !== undefined && chunk.start_ms > 0;
    const startTime = this.getChunkStartTime(chunk);
    const endTime = this.getChunkEndTime(chunk, startTime);

    // CRITICAL FIX: For the first chunk, always accept it regardless of timing
    // After that, apply timing checks
    if (!isFirstChunk && hasRealTimestamps) {
      const chunkEndTime = chunk.end_ms ?? endTime;
      const isProgressive = chunkEndTime > this.state.lastProcessedTimestamp;
      const isSequential = startTime > this.state.lastProcessedTimestamp - TimestampedSegmentMerger.GRACE_MS;
      
      // Only reject if chunk is completely before our last processed position
      if (!isProgressive && !isSequential) {
        console.log(`🚫 Temporal overlap detected: chunk ${startTime}-${chunkEndTime}ms is before last processed ${this.state.lastProcessedTimestamp}ms`);
        return { text: this.state.lastText, wasProcessed: false, reason: 'Temporal overlap detected' };
      }
      console.log(`✅ Temporal check passed: progressive=${isProgressive}, sequential=${isSequential}`);
    } else if (isFirstChunk) {
      console.log(`✅ First chunk - accepting without temporal checks`);
    }

    // Content fingerprinting for exact duplicate detection
    const contentHash = this.generateContentHash(chunk.text);
    if (this.state.contentHashes.has(contentHash)) {
      console.log(`🚫 Content duplicate detected: "${chunk.text.substring(0, 50)}..."`);
      return { text: this.state.lastText, wasProcessed: false, reason: 'Content duplicate detected' };
    }

    // Check for large text block overlaps (enhanced scanning)
    if (this.hasLargeTextOverlap(chunk.text, this.state.lastText)) {
      console.log(`🚫 Large text overlap detected: "${chunk.text.substring(0, 50)}..."`);
      return { text: this.state.lastText, wasProcessed: false, reason: 'Large text overlap detected' };
    }

    // Create segment and merge using timestamp-based merging
    const newSegment: Segment = {
      start: startTime / 1000, // Convert to seconds for segmentMerge
      end: endTime / 1000,
      text: chunk.text.trim()
    };

    console.log(`✅ Processing chunk: "${chunk.text.substring(0, 50)}..." (${startTime}-${endTime}ms)`);

    // Use the existing segmentMerge logic for consistent merging
    const mergedSegments = mergeByTimestamps(this.state.finalizedSegments, [newSegment]);
    const mergedText = segmentsToPlainText(mergedSegments);

    // Update state
    this.state.finalizedSegments = mergedSegments;
    this.state.lastProcessedTimestamp = endTime;
    this.state.contentHashes.add(contentHash);
    this.state.lastText = mergedText;

    // Track sentences for cross-chunk repetition detection
    this.updateRecentSentences(chunk.text);

    // Cleanup old hashes to prevent memory growth (keep last 100)
    if (this.state.contentHashes.size > 100) {
      const hashArray = Array.from(this.state.contentHashes);
      this.state.contentHashes = new Set(hashArray.slice(-80)); // Keep 80% of hashes
    }

    console.log(`🔗 Timestamp merge complete: ${mergedText.length} chars total`);
    return { text: mergedText, wasProcessed: true };
  }

  /**
   * Detect cross-chunk repetition by comparing sentences to recent history
   */
  private detectCrossChunkRepetition(text: string): { isRepetitive: boolean; reason?: string } {
    const sentences = text
      .split(/[.!?]+/)
      .map(s => s.trim().toLowerCase())
      .filter(s => s.length > 10);
    
    if (sentences.length === 0) {
      return { isRepetitive: false };
    }

    let repeatedCount = 0;
    for (const sentence of sentences) {
      for (const recent of this.state.recentSentences) {
        if (this.calculateSimilarity(sentence, recent) > TimestampedSegmentMerger.CROSS_CHUNK_SIMILARITY_THRESHOLD) {
          repeatedCount++;
          break;
        }
      }
    }

    const repetitionRatio = repeatedCount / sentences.length;
    if (repetitionRatio > 0.5) {
      return { 
        isRepetitive: true, 
        reason: `Cross-chunk repetition: ${repeatedCount}/${sentences.length} sentences (${(repetitionRatio * 100).toFixed(0)}%) already in transcript`
      };
    }

    return { isRepetitive: false };
  }

  /**
   * Calculate similarity between two strings (Jaccard-like)
   */
  private calculateSimilarity(a: string, b: string): number {
    const wordsA = new Set(a.split(/\s+/).filter(w => w.length > 2));
    const wordsB = new Set(b.split(/\s+/).filter(w => w.length > 2));
    
    if (wordsA.size === 0 || wordsB.size === 0) return 0;
    
    let intersection = 0;
    for (const word of wordsA) {
      if (wordsB.has(word)) intersection++;
    }
    
    const union = wordsA.size + wordsB.size - intersection;
    return intersection / union;
  }

  /**
   * Update recent sentences tracker
   */
  private updateRecentSentences(text: string): void {
    const sentences = text
      .split(/[.!?]+/)
      .map(s => s.trim().toLowerCase())
      .filter(s => s.length > 10);
    
    this.state.recentSentences.push(...sentences);
    
    // Keep only the most recent sentences
    if (this.state.recentSentences.length > TimestampedSegmentMerger.MAX_RECENT_SENTENCES) {
      this.state.recentSentences = this.state.recentSentences.slice(-TimestampedSegmentMerger.MAX_RECENT_SENTENCES);
    }
  }

  /**
   * Get current state for debugging
   */
  getState(): MergerState {
    return { ...this.state };
  }

  /**
   * Clear all state (useful for new sessions)
   */
  reset(): void {
    this.state = {
      finalizedSegments: [],
      lastProcessedTimestamp: 0,
      contentHashes: new Set(),
      lastText: '',
      recentSentences: []
    };
    console.log('🔄 TimestampedSegmentMerger reset');
  }

  private getChunkStartTime(chunk: TimestampedChunk): number {
    // Priority 1: Explicit millisecond timestamps (from recording timeline)
    if (chunk.start_ms !== undefined && chunk.start_ms > 0) return chunk.start_ms;
    
    // Priority 2: Numeric timestamp (already ms)
    if (chunk.timestamp !== undefined && typeof chunk.timestamp === 'number' && chunk.timestamp > 0) {
      return chunk.timestamp;
    }
    
    // Fallback: Sequential after last processed (ensures no overlap, relies on content dedup)
    // Add 1ms to guarantee we're after the last timestamp
    return this.state.lastProcessedTimestamp + 1;
  }

  private getChunkEndTime(chunk: TimestampedChunk, startTime: number): number {
    if (chunk.end_ms !== undefined) return chunk.end_ms;
    // Estimate duration based on text length (roughly 150 words per minute = 2.5 words per second)
    const wordCount = chunk.text.trim().split(/\s+/).length;
    const estimatedDurationMs = (wordCount / 2.5) * 1000;
    return startTime + Math.max(estimatedDurationMs, 1000); // Minimum 1 second
  }

  private generateContentHash(text: string): string {
    // Create a hash from the first part of the text for duplicate detection
    const normalized = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, TimestampedSegmentMerger.HASH_LENGTH);
    
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  private hasLargeTextOverlap(newText: string, existingText: string): boolean {
    if (!existingText || existingText.length < 80) return false;
    
    const newNormalized = this.normalizeForComparison(newText);
    const existingNormalized = this.normalizeForComparison(existingText);
    
    // More aggressive overlap detection with smaller windows
    const scanWindow = 200; // Reduced from 500
    const minOverlapLength = 60; // Reduced from 100
    const stepSize = 25; // Reduced from 50 for more thorough scanning
    
    // Check if chunks of new text already exist in the existing text
    for (let i = 0; i <= newNormalized.length - minOverlapLength; i += stepSize) {
      const chunk = newNormalized.substring(i, i + scanWindow);
      if (chunk.length >= minOverlapLength && existingNormalized.includes(chunk)) {
        console.log(`🔍 Large overlap found: "${chunk.substring(0, 50)}..." (${chunk.length} chars)`);
        return true;
      }
    }
    
    // Additional check: word-based overlap detection
    const newWords = newNormalized.split(/\s+/).filter(w => w.length > 3);
    const existingWords = new Set(existingNormalized.split(/\s+/).filter(w => w.length > 3));
    
    if (newWords.length > 10) {
      let matchingWords = 0;
      for (const word of newWords) {
        if (existingWords.has(word)) matchingWords++;
      }
      
      const overlapRatio = matchingWords / newWords.length;
      if (overlapRatio > TimestampedSegmentMerger.OVERLAP_THRESHOLD) {
        console.log(`🔍 Word-based overlap detected: ${(overlapRatio * 100).toFixed(1)}% word overlap`);
        return true;
      }
    }
    
    return false;
  }

  private normalizeForComparison(text: string): string {
    return text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
