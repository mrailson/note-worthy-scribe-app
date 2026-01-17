// src/utils/UnifiedTranscriptMerger.ts
// Unified transcript merging system that prioritizes timestamp-based merging
// with fallbacks to sequence-based and text-based deduplication

import { mergeByTimestamps, segmentsToPlainText, type Segment } from "@/lib/segmentMerge";
import { mergeLive, type LiveChunk } from "@/utils/liveMerge";
import { isLikelyHallucination } from "@/utils/whisperHallucinationPatterns";

export interface TranscriptChunk {
  id?: string;
  text: string;
  timestamp?: number; // Unix timestamp in milliseconds
  start_ms?: number;
  end_ms?: number;
  chunkNumber?: number;
  sequenceId?: number;
  confidence?: number;
  isFinal?: boolean;
  speaker?: string;
  source?: string;
}

export interface MergedTranscriptResult {
  text: string;
  totalChunks: number;
  mergeMethod: 'timestamp' | 'sequence' | 'text-based';
  confidence?: number;
  warnings?: string[];
}

export class UnifiedTranscriptMerger {
  // CRITICAL: Lowered from 0.85 to 0.30 to prevent clinically important chunks being dropped
  // Chunk 4 (73% confidence) was being filtered out despite containing critical cardiovascular data
  private static readonly CONFIDENCE_THRESHOLD = 0.30;
  private static readonly MIN_CHUNK_LENGTH = 10;
  
  /**
   * Main entry point for merging transcript chunks using the best available method
   */
  static mergeChunks(chunks: TranscriptChunk[]): MergedTranscriptResult {
    if (!chunks?.length) {
      return {
        text: '',
        totalChunks: 0,
        mergeMethod: 'text-based',
        warnings: ['No chunks provided']
      };
    }

    const validChunks = this.filterValidChunks(chunks);
    const warnings: string[] = [];

    if (validChunks.length !== chunks.length) {
      warnings.push(`Filtered out ${chunks.length - validChunks.length} invalid chunks`);
    }

    // Method 1: Timestamp-based merging (preferred)
    if (this.hasTimestamps(validChunks)) {
      console.log('🕐 Using timestamp-based merging for', validChunks.length, 'chunks');
      const segments = this.chunksToSegments(validChunks);
      const mergedSegments = mergeByTimestamps([], segments);
      const text = segmentsToPlainText(mergedSegments);
      
      return {
        text,
        totalChunks: validChunks.length,
        mergeMethod: 'timestamp',
        confidence: this.calculateAverageConfidence(validChunks),
        warnings
      };
    }

    // Method 2: Sequence-based merging (fallback)
    if (this.hasSequenceData(validChunks)) {
      console.log('📊 Using sequence-based merging for', validChunks.length, 'chunks');
      const sortedChunks = [...validChunks].sort((a, b) => 
        (a.sequenceId || a.chunkNumber || 0) - (b.sequenceId || b.chunkNumber || 0)
      );
      
      let merged = '';
      for (const chunk of sortedChunks) {
        const liveChunk: LiveChunk = {
          text: chunk.text,
          isFinal: chunk.isFinal,
          seq: chunk.sequenceId || chunk.chunkNumber,
          source: chunk.source || 'sequence-merge'
        };
        merged = mergeLive(merged, liveChunk).text;
      }

      return {
        text: merged,
        totalChunks: validChunks.length,
        mergeMethod: 'sequence',
        confidence: this.calculateAverageConfidence(validChunks),
        warnings
      };
    }

    // Method 3: Text-based merging (last resort)
    console.log('📝 Using text-based merging for', validChunks.length, 'chunks');
    warnings.push('No timestamp or sequence data available, using text-based merging');
    
    let merged = '';
    for (const chunk of validChunks) {
      const liveChunk: LiveChunk = {
        text: chunk.text,
        isFinal: chunk.isFinal !== false, // default to true if not specified
        source: chunk.source || 'text-merge'
      };
      merged = mergeLive(merged, liveChunk).text;
    }

    return {
      text: merged,
      totalChunks: validChunks.length,
      mergeMethod: 'text-based',
      confidence: this.calculateAverageConfidence(validChunks),
      warnings
    };
  }

  /**
   * Real-time merging for live transcription
   */
  static mergeLiveChunk(currentText: string, newChunk: TranscriptChunk): string {
    const liveChunk: LiveChunk = {
      text: newChunk.text,
      isFinal: newChunk.isFinal,
      seq: newChunk.sequenceId || newChunk.chunkNumber,
      start_ms: newChunk.start_ms,
      end_ms: newChunk.end_ms,
      source: newChunk.source || 'live',
      speaker: newChunk.speaker
    };

    return mergeLive(currentText, liveChunk).text;
  }

  /**
   * Create segments with progressive enhancement
   */
  static createProgressiveSegments(chunks: TranscriptChunk[]): Segment[] {
    const validChunks = this.filterValidChunks(chunks);
    
    return validChunks.map((chunk, index) => ({
      start: this.getChunkStartTime(chunk, index),
      end: this.getChunkEndTime(chunk, index + 1),
      text: chunk.text
    }));
  }

  // Private helper methods
  private static filterValidChunks(chunks: TranscriptChunk[]): TranscriptChunk[] {
    return chunks.filter(chunk => {
      // Basic validation
      if (!chunk?.text || chunk.text.trim().length < this.MIN_CHUNK_LENGTH) {
        return false;
      }
      
      // Confidence threshold check (hard gate at 30%)
      if (chunk.confidence !== undefined && chunk.confidence < this.CONFIDENCE_THRESHOLD) {
        console.log(`🚫 Chunk filtered: confidence ${(chunk.confidence * 100).toFixed(1)}% below ${this.CONFIDENCE_THRESHOLD * 100}% threshold`);
        return false;
      }
      
      // Hallucination check - defence in depth
      const hallucinationCheck = isLikelyHallucination(chunk.text, chunk.confidence, {
        confidenceThreshold: this.CONFIDENCE_THRESHOLD
      });
      if (hallucinationCheck.isHallucination) {
        console.log(`🚫 Chunk filtered as hallucination: ${hallucinationCheck.reason}`);
        return false;
      }
      
      return true;
    });
  }

  private static hasTimestamps(chunks: TranscriptChunk[]): boolean {
    return chunks.some(chunk => 
      (chunk.timestamp && chunk.timestamp > 0) ||
      (chunk.start_ms !== undefined && chunk.end_ms !== undefined)
    );
  }

  private static hasSequenceData(chunks: TranscriptChunk[]): boolean {
    return chunks.some(chunk => 
      chunk.sequenceId !== undefined || chunk.chunkNumber !== undefined
    );
  }

  private static chunksToSegments(chunks: TranscriptChunk[]): Segment[] {
    return chunks.map((chunk, index) => ({
      start: this.getChunkStartTime(chunk, index) / 1000, // Convert to seconds
      end: this.getChunkEndTime(chunk, index + 1) / 1000, // Convert to seconds
      text: chunk.text
    }));
  }

  private static getChunkStartTime(chunk: TranscriptChunk, fallbackIndex: number): number {
    if (chunk.start_ms !== undefined) return chunk.start_ms;
    if (chunk.timestamp) return chunk.timestamp;
    // Fallback: estimate based on index (assume 5 second chunks)
    return fallbackIndex * 5000;
  }

  private static getChunkEndTime(chunk: TranscriptChunk, fallbackIndex: number): number {
    if (chunk.end_ms !== undefined) return chunk.end_ms;
    if (chunk.start_ms !== undefined) return chunk.start_ms + 5000; // Assume 5s duration
    if (chunk.timestamp) return chunk.timestamp + 5000;
    // Fallback: estimate based on index
    return fallbackIndex * 5000;
  }

  private static calculateAverageConfidence(chunks: TranscriptChunk[]): number | undefined {
    const confidenceScores = chunks
      .map(chunk => chunk.confidence)
      .filter((conf): conf is number => conf !== undefined);
    
    if (confidenceScores.length === 0) return undefined;
    
    return confidenceScores.reduce((sum, conf) => sum + conf, 0) / confidenceScores.length;
  }
}