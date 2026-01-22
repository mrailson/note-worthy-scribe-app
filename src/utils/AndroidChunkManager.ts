/**
 * Android Chunk Manager - Sliding Window Audio Chunking
 * 
 * Similar to iPhoneChunkManager but optimised for Android devices.
 * Handles WebM/Opus format instead of M4A.
 * 
 * Key features:
 * - Maintains a rolling 60-second audio buffer
 * - Produces 15-20 second chunks for faster transcription
 * - WebM/Opus header handling
 * - Memory-efficient: discards old audio after processing
 */

export interface AndroidChunkManagerConfig {
  /** Maximum buffer duration in ms (default: 60000 = 60s) */
  maxBufferDurationMs?: number;
  /** Target chunk duration for transcription (default: 15000 = 15s) */
  targetChunkDurationMs?: number;
  /** Overlap duration to prevent missing speech at boundaries (default: 3000 = 3s) */
  overlapDurationMs?: number;
  /** Minimum chunk duration before allowing flush (default: 5000 = 5s) */
  minChunkDurationMs?: number;
}

interface AudioChunkEntry {
  blob: Blob;
  timestamp: number;
  durationMs: number;
}

export interface ProcessableChunk {
  blob: Blob;
  startTimeMs: number;
  endTimeMs: number;
  chunkIndex: number;
  isOverlapping: boolean;
}

export class AndroidChunkManager {
  private config: Required<AndroidChunkManagerConfig>;
  private audioBuffer: AudioChunkEntry[] = [];
  private headerChunk: Blob | null = null;
  private mimeType: string = 'audio/webm;codecs=opus';
  private chunkCounter = 0;
  private lastProcessedEndTime = 0;
  private recordingStartTime = 0;
  private totalBufferDurationMs = 0;
  
  // Retry queue for failed chunks
  private pendingQueue: ProcessableChunk[] = [];
  private processingChunk: ProcessableChunk | null = null;
  
  // Track time since last successful processing
  private lastProcessedTime = 0;
  
  constructor(config: AndroidChunkManagerConfig = {}) {
    this.config = {
      maxBufferDurationMs: config.maxBufferDurationMs ?? 60000,  // 60s default
      targetChunkDurationMs: config.targetChunkDurationMs ?? 15000, // 15s - faster than iPhone
      overlapDurationMs: config.overlapDurationMs ?? 3000,
      minChunkDurationMs: config.minChunkDurationMs ?? 5000
    };
  }

  /**
   * Initialize the chunk manager for a new recording session
   */
  initialize(mimeType: string): void {
    this.mimeType = mimeType;
    this.audioBuffer = [];
    this.headerChunk = null;
    this.chunkCounter = 0;
    this.lastProcessedEndTime = 0;
    this.recordingStartTime = Date.now();
    this.totalBufferDurationMs = 0;
    this.pendingQueue = [];
    this.processingChunk = null;
    this.lastProcessedTime = 0;
    
    console.log('📦 AndroidChunkManager initialized', {
      mimeType,
      config: this.config
    });
  }

  /**
   * Add a new audio chunk from MediaRecorder
   */
  addChunk(blob: Blob, estimatedDurationMs: number = 5000): void {
    if (blob.size === 0) return;

    const now = Date.now();
    
    // Capture first chunk as header (WebM container metadata)
    if (!this.headerChunk) {
      this.headerChunk = blob;
      console.log(`📦 AndroidChunkManager: Captured WebM header (${blob.size} bytes)`);
    }

    const entry: AudioChunkEntry = {
      blob,
      timestamp: now,
      durationMs: estimatedDurationMs
    };

    this.audioBuffer.push(entry);
    this.totalBufferDurationMs += estimatedDurationMs;

    // Cleanup old chunks if buffer exceeds max duration
    this.pruneOldChunks();

    console.log(`📦 AndroidChunkManager: Added chunk (${blob.size} bytes), buffer: ${this.audioBuffer.length} chunks, ~${(this.totalBufferDurationMs / 1000).toFixed(1)}s`);
  }

  /**
   * Remove old chunks to keep buffer within maxBufferDurationMs
   */
  private pruneOldChunks(): void {
    if (this.processingChunk) {
      console.log(`📦 AndroidChunkManager: Skipping prune - chunk being processed`);
      return;
    }
    
    while (this.totalBufferDurationMs > this.config.maxBufferDurationMs && this.audioBuffer.length > 1) {
      const removed = this.audioBuffer.shift();
      if (removed) {
        this.totalBufferDurationMs -= removed.durationMs;
        console.log(`🗑️ AndroidChunkManager: Pruned old chunk, buffer now ~${(this.totalBufferDurationMs / 1000).toFixed(1)}s`);
      }
    }
  }

  /**
   * Check if we have enough audio data for a chunk
   */
  hasEnoughForChunk(): boolean {
    return this.totalBufferDurationMs >= this.config.minChunkDurationMs;
  }

  /**
   * Check if we should process now (reached target duration)
   */
  shouldProcessNow(): boolean {
    return this.totalBufferDurationMs >= this.config.targetChunkDurationMs;
  }

  /**
   * Get unprocessed audio duration in milliseconds
   */
  getUnprocessedDurationMs(): number {
    return this.totalBufferDurationMs;
  }

  /**
   * Get time since last successful processing in milliseconds
   */
  getTimeSinceLastProcess(): number {
    if (this.lastProcessedTime === 0) return 0;
    return Date.now() - this.lastProcessedTime;
  }

  /**
   * Get a chunk ready for transcription
   */
  getChunkForProcessing(force: boolean = false): ProcessableChunk | null {
    // Check retry queue first
    if (this.pendingQueue.length > 0) {
      const chunk = this.pendingQueue.shift()!;
      this.processingChunk = chunk;
      console.log(`📤 AndroidChunkManager: Retrying queued chunk #${chunk.chunkIndex}`);
      return chunk;
    }

    // Force processing if it's been too long since last process
    const timeSinceLastProcess = this.getTimeSinceLastProcess();
    const timeForced = timeSinceLastProcess > 20000;

    if (!force && !timeForced && !this.hasEnoughForChunk()) {
      console.log(`📦 AndroidChunkManager: Not enough audio (${(this.totalBufferDurationMs / 1000).toFixed(1)}s < ${this.config.minChunkDurationMs / 1000}s)`);
      return null;
    }

    if (timeForced && this.totalBufferDurationMs < 2000) {
      console.log(`📦 AndroidChunkManager: Time-forced but only ${(this.totalBufferDurationMs / 1000).toFixed(1)}s`);
      return null;
    }

    if (!force && !timeForced && !this.shouldProcessNow()) {
      if (this.hasEnoughForChunk() && timeSinceLastProcess > 10000) {
        console.log(`📦 AndroidChunkManager: Below target but ${(timeSinceLastProcess / 1000).toFixed(0)}s since last - allowing`);
      } else {
        console.log(`📦 AndroidChunkManager: Below target (${(this.totalBufferDurationMs / 1000).toFixed(1)}s < ${this.config.targetChunkDurationMs / 1000}s)`);
        return null;
      }
    }

    if (this.audioBuffer.length === 0) {
      return null;
    }

    // Build the audio blob - for WebM we include header for valid decoding
    const chunksToInclude = this.headerChunk 
      ? [this.headerChunk, ...this.audioBuffer.map(e => e.blob).filter(b => b !== this.headerChunk)]
      : this.audioBuffer.map(e => e.blob);

    const blob = new Blob(chunksToInclude, { type: this.mimeType });
    
    this.chunkCounter++;
    
    const chunk: ProcessableChunk = {
      blob,
      startTimeMs: this.lastProcessedEndTime,
      endTimeMs: this.lastProcessedEndTime + this.totalBufferDurationMs,
      chunkIndex: this.chunkCounter,
      isOverlapping: this.lastProcessedEndTime > 0
    };

    this.processingChunk = chunk;

    console.log(`📤 AndroidChunkManager: Created chunk #${chunk.chunkIndex} (${(blob.size / 1024).toFixed(1)}KB, ${(this.totalBufferDurationMs / 1000).toFixed(1)}s)`);

    return chunk;
  }

  /**
   * Mark current chunk as successfully processed
   */
  markChunkProcessed(): void {
    if (!this.processingChunk) return;

    this.lastProcessedEndTime = this.processingChunk.endTimeMs;
    this.lastProcessedTime = Date.now();
    
    // Keep overlap for continuity
    const targetOverlapMs = this.config.overlapDurationMs;
    
    while (this.audioBuffer.length > 1 && this.totalBufferDurationMs > targetOverlapMs) {
      const oldestDuration = this.audioBuffer[0]?.durationMs || 0;
      if (this.totalBufferDurationMs - oldestDuration >= targetOverlapMs * 0.8) {
        const removed = this.audioBuffer.shift();
        if (removed) {
          this.totalBufferDurationMs -= removed.durationMs;
        }
      } else {
        break;
      }
    }

    console.log(`✅ AndroidChunkManager: Chunk #${this.processingChunk.chunkIndex} processed, kept ${this.audioBuffer.length} chunks (~${(this.totalBufferDurationMs / 1000).toFixed(1)}s)`);
    
    this.processingChunk = null;
  }

  /**
   * Mark current chunk as failed - add to retry queue
   */
  markChunkFailed(): void {
    if (!this.processingChunk) return;

    console.warn(`⚠️ AndroidChunkManager: Chunk #${this.processingChunk.chunkIndex} failed, queuing for retry`);
    
    this.pendingQueue.push(this.processingChunk);
    this.processingChunk = null;
  }

  /**
   * Get number of chunks pending retry
   */
  getPendingRetryCount(): number {
    return this.pendingQueue.length;
  }

  /**
   * Get final chunk for end of recording
   */
  getFinalChunk(): ProcessableChunk | null {
    if (this.audioBuffer.length === 0) {
      return null;
    }
    return this.getChunkForProcessing(true);
  }

  /**
   * Clear all buffers and reset state
   */
  reset(): void {
    this.audioBuffer = [];
    this.headerChunk = null;
    this.chunkCounter = 0;
    this.lastProcessedEndTime = 0;
    this.totalBufferDurationMs = 0;
    this.pendingQueue = [];
    this.processingChunk = null;
    
    console.log('📦 AndroidChunkManager: Reset complete');
  }

  /**
   * Get current stats for debugging
   */
  getStats(): {
    bufferChunks: number;
    bufferDurationMs: number;
    processedChunks: number;
    pendingRetries: number;
    lastProcessedEndTime: number;
    timeSinceLastProcessMs: number;
  } {
    return {
      bufferChunks: this.audioBuffer.length,
      bufferDurationMs: this.totalBufferDurationMs,
      processedChunks: this.chunkCounter,
      pendingRetries: this.pendingQueue.length,
      lastProcessedEndTime: this.lastProcessedEndTime,
      timeSinceLastProcessMs: this.getTimeSinceLastProcess()
    };
  }
}
