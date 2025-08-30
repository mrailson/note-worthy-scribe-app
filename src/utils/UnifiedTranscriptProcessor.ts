// Unified Transcript Processor - Phase 4 Implementation
// Single comprehensive system that all transcribers use

import { AdvancedDeduplicationEngine, DeduplicationConfig, ChunkMetadata, DeduplicationResult } from './AdvancedDeduplicationEngine';
import { meetsConfidenceThreshold, MeetingSettingsWithThresholds } from './confidenceGating';

export interface TranscriptChunk {
  text: string;
  confidence?: number;
  isFinal?: boolean;
  timestamp?: number;
  source?: string;
  speaker?: string;
  sessionId?: string;
}

export interface ProcessingOptions {
  enableConfidenceGating: boolean;
  enableAdvancedDeduplication: boolean;
  enableLegacyCompatibility: boolean;
  deduplicationConfig?: Partial<DeduplicationConfig>;
}

export interface ProcessingResult {
  transcript: string;
  wasFiltered: boolean;
  filterReason?: string;
  deduplicationStats?: DeduplicationResult['stats'];
  removedSegments?: DeduplicationResult['removedSegments'];
}

export interface ProcessorCallbacks {
  onTranscriptUpdate?: (transcript: string) => void;
  onChunkFiltered?: (chunk: TranscriptChunk, reason: string) => void;
  onDeduplicationStats?: (stats: DeduplicationResult['stats']) => void;
}

/**
 * Unified Transcript Processor - The single system all transcribers should use
 * Combines confidence gating, advanced deduplication, and legacy compatibility
 */
export class UnifiedTranscriptProcessor {
  private deduplicationEngine: AdvancedDeduplicationEngine;
  private fullTranscript: string = '';
  private chunkCounter: number = 0;
  private sessionStartTime: number = Date.now();
  
  constructor(
    private meetingSettings: MeetingSettingsWithThresholds,
    private options: ProcessingOptions = {
      enableConfidenceGating: true,
      enableAdvancedDeduplication: true,
      enableLegacyCompatibility: true
    },
    private callbacks: ProcessorCallbacks = {}
  ) {
    // Initialize advanced deduplication engine with custom config
    this.deduplicationEngine = new AdvancedDeduplicationEngine(options.deduplicationConfig);
  }

  /**
   * Main processing method - handles a new transcript chunk
   */
  processChunk(chunk: TranscriptChunk): ProcessingResult {
    console.log(`🔄 Processing chunk ${++this.chunkCounter}: "${chunk.text?.substring(0, 50) || ''}..." (final: ${chunk.isFinal}, confidence: ${chunk.confidence})`);

    // Step 1: Basic validation
    if (!chunk.text || !chunk.text.trim()) {
      return {
        transcript: this.fullTranscript,
        wasFiltered: true,
        filterReason: 'Empty chunk'
      };
    }

    // Step 2: Confidence gating (if enabled)
    if (this.options.enableConfidenceGating) {
      const confidenceResult = this.applyConfidenceGating(chunk);
      if (!confidenceResult.passed) {
        this.callbacks.onChunkFiltered?.(chunk, confidenceResult.reason);
        return {
          transcript: this.fullTranscript,
          wasFiltered: true,
          filterReason: confidenceResult.reason
        };
      }
    }

    // Step 3: Legacy compatibility check (only process final chunks by default)
    if (this.options.enableLegacyCompatibility && chunk.isFinal === false) {
      return {
        transcript: this.fullTranscript,
        wasFiltered: true,
        filterReason: 'Non-final chunk (legacy compatibility mode)'
      };
    }

    // Step 4: Advanced deduplication (if enabled)
    let processingResult: DeduplicationResult | null = null;
    let newTranscript = this.fullTranscript;

    if (this.options.enableAdvancedDeduplication) {
      const chunkMetadata: ChunkMetadata = {
        text: chunk.text,
        confidence: chunk.confidence || 0.5,
        timestamp: chunk.timestamp || Date.now(),
        source: chunk.source || 'unknown',
        chunkId: `${chunk.sessionId || 'session'}_${this.chunkCounter}_${Date.now()}`,
        isFinal: chunk.isFinal !== false // default to true if not specified
      };

      processingResult = this.deduplicationEngine.processChunk(chunkMetadata, this.fullTranscript);
      newTranscript = processingResult.cleanedText;

      // Log deduplication results
      if (processingResult.removedSegments.length > 0) {
        console.log(`🧹 Deduplication removed ${processingResult.removedSegments.length} segments:`);
        processingResult.removedSegments.forEach(segment => {
          console.log(`   - ${segment.type}: "${segment.text.substring(0, 60)}..." (${segment.reason})`);
        });
      }

      // Callback for deduplication stats
      this.callbacks.onDeduplicationStats?.(processingResult.stats);
    } else {
      // Fallback: simple append without advanced deduplication
      newTranscript = this.fullTranscript + (this.fullTranscript ? ' ' : '') + chunk.text;
    }

    // Step 5: Update state and notify
    const transcriptChanged = newTranscript !== this.fullTranscript;
    this.fullTranscript = newTranscript;

    if (transcriptChanged && this.callbacks.onTranscriptUpdate) {
      this.callbacks.onTranscriptUpdate(this.fullTranscript);
    }

    return {
      transcript: this.fullTranscript,
      wasFiltered: false,
      deduplicationStats: processingResult?.stats,
      removedSegments: processingResult?.removedSegments
    };
  }

  /**
   * Apply confidence-based filtering
   */
  private applyConfidenceGating(chunk: TranscriptChunk): { passed: boolean; reason: string } {
    if (chunk.confidence === undefined) {
      return { passed: true, reason: '' }; // No confidence provided, allow through
    }

    const meetsThreshold = meetsConfidenceThreshold(chunk.confidence, this.meetingSettings);
    
    if (!meetsThreshold) {
      const activeThreshold = this.meetingSettings.transcriberService === 'deepgram' 
        ? this.meetingSettings.transcriberThresholds.deepgram
        : this.meetingSettings.transcriberThresholds.whisper;
      
      return {
        passed: false,
        reason: `Low confidence: ${chunk.confidence.toFixed(3)} < ${activeThreshold} (${this.meetingSettings.transcriberService})`
      };
    }

    return { passed: true, reason: '' };
  }

  /**
   * Get current full transcript
   */
  getTranscript(): string {
    return this.fullTranscript;
  }

  /**
   * Clear all transcript data
   */
  clear(): void {
    this.fullTranscript = '';
    this.chunkCounter = 0;
    this.sessionStartTime = Date.now();
    this.deduplicationEngine.reset();
    this.callbacks.onTranscriptUpdate?.('');
  }

  /**
   * Update processing options
   */
  updateOptions(newOptions: Partial<ProcessingOptions>): void {
    this.options = { ...this.options, ...newOptions };
    
    if (newOptions.deduplicationConfig) {
      this.deduplicationEngine.updateConfig(newOptions.deduplicationConfig);
    }
  }

  /**
   * Get processing statistics
   */
  getStats(): {
    chunkCount: number;
    transcriptLength: number;
    sessionDurationMs: number;
    deduplicationConfig: DeduplicationConfig;
  } {
    return {
      chunkCount: this.chunkCounter,
      transcriptLength: this.fullTranscript.length,
      sessionDurationMs: Date.now() - this.sessionStartTime,
      deduplicationConfig: this.deduplicationEngine.getConfig()
    };
  }

  /**
   * Legacy compatibility methods
   */
  
  // For ChromiumMicTranscriber compatibility
  processLegacyChunk(text: string, confidence?: number, source: string = 'legacy'): string {
    const result = this.processChunk({
      text,
      confidence,
      isFinal: true,
      source,
      timestamp: Date.now()
    });
    return result.transcript;
  }

  // For incremental handlers compatibility
  processIncrementalData(data: {
    text: string;
    is_final: boolean;
    confidence: number;
    segment_id?: string;
  }): string {
    const result = this.processChunk({
      text: data.text,
      confidence: data.confidence,
      isFinal: data.is_final,
      source: 'incremental',
      sessionId: data.segment_id,
      timestamp: Date.now()
    });
    return result.transcript;
  }
}