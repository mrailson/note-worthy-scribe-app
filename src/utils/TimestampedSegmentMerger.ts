// Enhanced timestamp-based segment merger to prevent large-scale duplications
import { mergeByTimestamps, segmentsToPlainText, type Segment } from "@/lib/segmentMerge";

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
}

export class TimestampedSegmentMerger {
  private static readonly GRACE_MS = 100; // 100ms grace period for timing variations
  private static readonly MIN_SEGMENT_LENGTH = 10;
  private static readonly HASH_LENGTH = 120; // Characters to hash for content fingerprinting
  
  private state: MergerState;
  
  constructor() {
    this.state = {
      finalizedSegments: [],
      lastProcessedTimestamp: 0,
      contentHashes: new Set(),
      lastText: ''
    };
  }

  /**
   * Process a new chunk with strict timestamp-based deduplication
   */
  processChunk(chunk: TimestampedChunk): { text: string; wasProcessed: boolean; reason?: string } {
    if (!chunk.text?.trim() || chunk.text.trim().length < TimestampedSegmentMerger.MIN_SEGMENT_LENGTH) {
      return { text: this.state.lastText, wasProcessed: false, reason: 'Chunk too short or empty' };
    }

    // Only process final chunks to avoid duplicates from interim updates
    if (chunk.isFinal === false) {
      console.log(`⏳ Skipping interim chunk: "${chunk.text.substring(0, 30)}..."`);
      return { text: this.state.lastText, wasProcessed: false, reason: 'Interim chunk ignored' };
    }

    const startTime = this.getChunkStartTime(chunk);
    const endTime = this.getChunkEndTime(chunk, startTime);

    // Check for temporal overlap with already processed content
    if (startTime <= this.state.lastProcessedTimestamp + TimestampedSegmentMerger.GRACE_MS) {
      console.log(`🚫 Temporal overlap detected: chunk starts at ${startTime}ms, last processed: ${this.state.lastProcessedTimestamp}ms`);
      return { text: this.state.lastText, wasProcessed: false, reason: 'Temporal overlap detected' };
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

    // Cleanup old hashes to prevent memory growth (keep last 100)
    if (this.state.contentHashes.size > 100) {
      const hashArray = Array.from(this.state.contentHashes);
      this.state.contentHashes = new Set(hashArray.slice(-80)); // Keep 80% of hashes
    }

    console.log(`🔗 Timestamp merge complete: ${mergedText.length} chars total`);
    return { text: mergedText, wasProcessed: true };
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
      lastText: ''
    };
    console.log('🔄 TimestampedSegmentMerger reset');
  }

  private getChunkStartTime(chunk: TimestampedChunk): number {
    if (chunk.start_ms !== undefined) return chunk.start_ms;
    if (chunk.timestamp !== undefined) return chunk.timestamp;
    // Fallback: use current time relative to session start
    return Date.now() - this.state.lastProcessedTimestamp;
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
    if (!existingText || existingText.length < 100) return false;
    
    const newNormalized = this.normalizeForComparison(newText);
    const existingNormalized = this.normalizeForComparison(existingText);
    
    // Check for substantial overlaps (500+ characters)
    const scanWindow = 500;
    const minOverlapLength = 100;
    
    // Check if large chunks of new text already exist in the existing text
    for (let i = 0; i <= newNormalized.length - minOverlapLength; i += 50) {
      const chunk = newNormalized.substring(i, i + scanWindow);
      if (chunk.length >= minOverlapLength && existingNormalized.includes(chunk)) {
        console.log(`🔍 Large overlap found: "${chunk.substring(0, 50)}..." (${chunk.length} chars)`);
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
