/**
 * iPhone Chunk Manager - Sliding Window Audio Chunking
 * 
 * Manages a rolling buffer of audio data and produces overlapping chunks
 * for transcription. This replaces the cumulative audio approach which
 * became unsustainable for longer recordings.
 * 
 * Key features:
 * - Maintains a rolling 60-second audio buffer
 * - Produces 25-30 second chunks with 5-second overlap
 * - Handles iOS M4A header requirements
 * - Memory-efficient: discards old audio after processing
 */

export interface ChunkManagerConfig {
  /** Maximum buffer duration in ms (default: 60000 = 60s) */
  maxBufferDurationMs?: number;
  /** Target chunk duration for transcription (default: 25000 = 25s) */
  targetChunkDurationMs?: number;
  /** Overlap duration to prevent missing speech at boundaries (default: 5000 = 5s) */
  overlapDurationMs?: number;
  /** Minimum chunk duration before allowing flush (default: 8000 = 8s) */
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

export class iPhoneChunkManager {
  private config: Required<ChunkManagerConfig>;
  private audioBuffer: AudioChunkEntry[] = [];
  private headerChunk: Blob | null = null;
  private mimeType: string = 'audio/mp4';
  private chunkCounter = 0;
  private lastProcessedEndTime = 0;
  private recordingStartTime = 0;
  private totalBufferDurationMs = 0;
  
  // Retry queue for failed chunks
  private pendingQueue: ProcessableChunk[] = [];
  private processingChunk: ProcessableChunk | null = null;
  
  // NEW: Track time since last successful processing
  private lastProcessedTime = 0;
  
  constructor(config: ChunkManagerConfig = {}) {
    this.config = {
      maxBufferDurationMs: config.maxBufferDurationMs ?? 120000,  // 120s default - accommodate 90s chunks
      targetChunkDurationMs: config.targetChunkDurationMs ?? 90000, // 90s (Option A)
      overlapDurationMs: config.overlapDurationMs ?? 3000,  // 3s overlap
      minChunkDurationMs: config.minChunkDurationMs ?? 10000 // 10s minimum
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
    this.lastProcessedTime = 0; // Reset time tracking
    
    console.log('📦 iPhoneChunkManager initialized', {
      mimeType,
      config: this.config
    });
  }

  /**
   * Add a new audio chunk from MediaRecorder
   * @param blob The audio data blob
   * @param estimatedDurationMs Estimated duration of this chunk (typically from timeslice)
   */
  addChunk(blob: Blob, estimatedDurationMs: number = 5000): void {
    if (blob.size === 0) return;

    const now = Date.now();
    
    // Capture first chunk as header (contains M4A container metadata)
    if (!this.headerChunk) {
      this.headerChunk = blob;
      console.log(`📦 ChunkManager: Captured M4A header (${blob.size} bytes)`);
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

    console.log(`📦 ChunkManager: Added chunk (${blob.size} bytes), buffer: ${this.audioBuffer.length} chunks, ~${(this.totalBufferDurationMs / 1000).toFixed(1)}s`);
  }

  /**
   * Remove old chunks to keep buffer within maxBufferDurationMs
   * Note: Won't prune if a chunk is currently being processed
   */
  private pruneOldChunks(): void {
    // Don't prune while processing - could lose audio
    if (this.processingChunk) {
      console.log(`📦 ChunkManager: Skipping prune - chunk being processed`);
      return;
    }
    
    // Warn when approaching limit
    const bufferPercentage = (this.totalBufferDurationMs / this.config.maxBufferDurationMs) * 100;
    if (bufferPercentage > 75 && bufferPercentage < 100) {
      console.warn(`⚠️ ChunkManager: Buffer at ${bufferPercentage.toFixed(0)}% capacity (${(this.totalBufferDurationMs / 1000).toFixed(1)}s / ${this.config.maxBufferDurationMs / 1000}s)`);
    }
    
    while (this.totalBufferDurationMs > this.config.maxBufferDurationMs && this.audioBuffer.length > 1) {
      const removed = this.audioBuffer.shift();
      if (removed) {
        this.totalBufferDurationMs -= removed.durationMs;
        console.log(`🗑️ ChunkManager: Pruned old chunk, buffer now ~${(this.totalBufferDurationMs / 1000).toFixed(1)}s`);
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
    const timeSinceLastProcess = this.totalBufferDurationMs;
    return timeSinceLastProcess >= this.config.targetChunkDurationMs;
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
   * Returns null if not enough audio data available
   * NEW: Now includes time-based forcing to prevent deadlocks
   */
  getChunkForProcessing(force: boolean = false): ProcessableChunk | null {
    // Check if we have anything in the retry queue first
    if (this.pendingQueue.length > 0) {
      const chunk = this.pendingQueue.shift()!;
      this.processingChunk = chunk;
      console.log(`📤 ChunkManager: Retrying queued chunk #${chunk.chunkIndex}`);
      return chunk;
    }

    // NEW: Force processing if it's been too long since last process (prevents deadlock)
    const timeSinceLastProcess = this.getTimeSinceLastProcess();
    const timeForced = timeSinceLastProcess > 20000; // 20 seconds without processing

    // Check if we have enough audio (unless time-forced)
    if (!force && !timeForced && !this.hasEnoughForChunk()) {
      console.log(`📦 ChunkManager: Not enough audio for chunk (${(this.totalBufferDurationMs / 1000).toFixed(1)}s < ${this.config.minChunkDurationMs / 1000}s min)`);
      return null;
    }

    // If time-forced but below absolute minimum, still need at least 2 seconds of audio
    if (timeForced && this.totalBufferDurationMs < 2000) {
      console.log(`📦 ChunkManager: Time-forced but only ${(this.totalBufferDurationMs / 1000).toFixed(1)}s (need 2s min)`);
      return null;
    }

    // Check target duration (with time-based override)
    if (!force && !timeForced && !this.shouldProcessNow()) {
      // Allow processing if we have minimum AND it's been >10s since last process
      if (this.hasEnoughForChunk() && timeSinceLastProcess > 10000) {
        console.log(`📦 ChunkManager: Below target but ${(timeSinceLastProcess / 1000).toFixed(0)}s since last process - allowing`);
      } else {
        console.log(`📦 ChunkManager: Below target duration (${(this.totalBufferDurationMs / 1000).toFixed(1)}s < ${this.config.targetChunkDurationMs / 1000}s target)`);
        return null;
      }
    }

    if (timeForced) {
      console.log(`⏰ ChunkManager: TIME-FORCED processing (${(timeSinceLastProcess / 1000).toFixed(0)}s since last, buffer: ${(this.totalBufferDurationMs / 1000).toFixed(1)}s)`);
    }

    if (this.audioBuffer.length === 0) {
      return null;
    }

    // Build the audio blob
    // For iOS M4A, we need to include the header for valid decoding
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

    console.log(`📤 ChunkManager: Created chunk #${chunk.chunkIndex} (${(blob.size / 1024).toFixed(1)}KB, ${(this.totalBufferDurationMs / 1000).toFixed(1)}s)`);

    return chunk;
  }

  /**
   * Mark current chunk as successfully processed
   * This clears the buffer except for overlap data
   */
  markChunkProcessed(): void {
    if (!this.processingChunk) return;

    const processedDuration = this.processingChunk.endTimeMs - this.processingChunk.startTimeMs;
    this.lastProcessedEndTime = this.processingChunk.endTimeMs;
    this.lastProcessedTime = Date.now(); // Track when we last processed
    
    // Keep overlap for continuity - DURATION-BASED, not chunk-count based
    // Remove oldest entries while keeping at least overlapDurationMs of audio
    const targetOverlapMs = this.config.overlapDurationMs;
    
    while (this.audioBuffer.length > 1 && this.totalBufferDurationMs > targetOverlapMs) {
      const oldestDuration = this.audioBuffer[0]?.durationMs || 0;
      // Only remove if we'll still have enough overlap after removal
      if (this.totalBufferDurationMs - oldestDuration >= targetOverlapMs * 0.8) {
        const removed = this.audioBuffer.shift();
        if (removed) {
          this.totalBufferDurationMs -= removed.durationMs;
        }
      } else {
        break; // Keep this chunk to maintain overlap
      }
    }

    console.log(`✅ ChunkManager: Chunk #${this.processingChunk.chunkIndex} processed, kept ${this.audioBuffer.length} chunks for overlap (~${(this.totalBufferDurationMs / 1000).toFixed(1)}s)`);
    
    this.processingChunk = null;
  }

  /**
   * Mark current chunk as failed - add to retry queue
   */
  markChunkFailed(): void {
    if (!this.processingChunk) return;

    console.warn(`⚠️ ChunkManager: Chunk #${this.processingChunk.chunkIndex} failed, queuing for retry`);
    
    // Re-queue for retry (but rebuild the blob to ensure it's fresh)
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

    // Force get whatever we have
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
    
    console.log('📦 ChunkManager: Reset complete');
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
