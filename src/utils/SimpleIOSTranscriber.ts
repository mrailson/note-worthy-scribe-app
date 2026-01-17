/**
 * Fixed iOS Transcriber - Upload Individual Blobs, Buffer Text
 * 
 * Key fix: iOS uses fMP4 (fragmented MP4) which CANNOT be concatenated.
 * Combining blobs creates corrupt audio files that fail to transcribe.
 * 
 * Solution:
 * - Upload each 5-second blob individually (as valid fMP4 segments)
 * - Buffer the transcription TEXT instead of audio
 * - Apply smart merge de-duplication on accumulated text
 * - Emit merged text every ~12 seconds for UI updates
 * 
 * Quality features retained:
 * - Hallucination/noise filtering
 * - Confidence gating  
 * - No-speech probability filtering
 * - Prompt tail for continuity
 * - Levenshtein-based text de-duplication
 */

import { supabase } from "@/integrations/supabase/client";
import { isLikelyHallucination } from './whisperHallucinationPatterns';

export interface IOSTranscriberCallbacks {
  onTranscription: (text: string, isFinal: boolean, confidence: number) => void;
  onError: (error: string) => void;
  onStatusChange: (status: string) => void;
  onStatsUpdate?: (stats: IOSTranscriberStats) => void;
}

export interface IOSTranscriberStats {
  capturedBlobs: number;
  queueLength: number;
  uploadedChunks: number;
  lastUploadStatus: 'idle' | 'uploading' | 'success' | 'failed' | 'retrying';
  lastTextLength: number;
  isRecording: boolean;
  totalTranscribedChars: number;
  lastOndataavailableTime: number;
  bufferedTextCount: number;
}

interface QueuedChunk {
  blob: Blob;
  index: number;
  capturedAt: number;
  retryCount: number;
}

export class SimpleIOSTranscriber {
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private isRecording = false;
  
  // Upload queue for individual blobs (NOT combined)
  private queue: QueuedChunk[] = [];
  private uploadInFlight = false;
  private capturedBlobCount = 0;
  private uploadedChunkCount = 0;
  private totalTranscribedChars = 0;
  private lastUploadStatus: IOSTranscriberStats['lastUploadStatus'] = 'idle';
  private lastTextLength = 0;
  private lastOndataavailableTime = 0;
  
  // TEXT buffering (not audio buffering!)
  private pendingTexts: string[] = [];
  private pendingConfidences: number[] = [];
  private lastEmitTime = 0;
  private readonly TEXT_EMIT_INTERVAL_MS = 12000; // Emit merged text every ~12s
  
  // Smart merge: accumulated transcript for de-duplication
  private finalTranscript = '';
  private lastTranscriptTail = '';
  private readonly PROMPT_TAIL_LENGTH = 200;
  
  // MediaRecorder timeslice
  private readonly BLOB_TIMESLICE_MS = 5000; // 5-second blobs
  
  // Web Worker-based heartbeat (resistant to background throttling)
  private heartbeatWorker: Worker | null = null;
  private heartbeatWorkerBlobUrl: string | null = null;
  private readonly HEARTBEAT_INTERVAL_MS = 8000;
  
  // Meeting context
  private meetingId: string | null = null;
  private sessionId: string | null = null;
  
  // Device selection
  private selectedDeviceId: string | null = null;
  
  // Visibility handler for tab switching
  private visibilityHandler: (() => void) | null = null;

  constructor(
    private callbacks: IOSTranscriberCallbacks,
    meetingId?: string,
    selectedDeviceId?: string | null
  ) {
    this.meetingId = meetingId || null;
    this.sessionId = meetingId || crypto.randomUUID();
    this.selectedDeviceId = selectedDeviceId || null;
  }

  public setMeetingId(id: string) {
    this.meetingId = id;
    this.sessionId = this.sessionId || id;
  }

  /**
   * Start recording and transcription
   */
  async start(): Promise<void> {
    if (this.isRecording) {
      console.log('📱 FixedIOS: Already recording');
      return;
    }

    try {
      this.callbacks.onStatusChange('Starting iOS transcription...');
      console.log('📱 FixedIOS: Starting with individual blob uploads (no audio combining)...');

      // Get microphone stream
      const constraints: MediaStreamConstraints = {
        audio: this.selectedDeviceId 
          ? { deviceId: { exact: this.selectedDeviceId } }
          : { 
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            }
      };

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('📱 FixedIOS: Got microphone stream');

      // Determine MIME type (iOS prefers audio/mp4)
      const mimeType = MediaRecorder.isTypeSupported('audio/mp4') 
        ? 'audio/mp4' 
        : MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm';

      console.log('📱 FixedIOS: Using MIME type:', mimeType);

      // Create MediaRecorder with timeslice for automatic blob emission
      this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.handleDataAvailable(event.data);
        }
      };

      this.mediaRecorder.onerror = (event: any) => {
        console.error('📱 FixedIOS: MediaRecorder error:', event.error);
        this.callbacks.onError(`Recording error: ${event.error?.message || 'Unknown'}`);
      };

      this.mediaRecorder.onstop = () => {
        console.log('📱 FixedIOS: MediaRecorder stopped');
      };

      // Reset state
      this.queue = [];
      this.uploadInFlight = false;
      this.capturedBlobCount = 0;
      this.uploadedChunkCount = 0;
      this.totalTranscribedChars = 0;
      this.lastUploadStatus = 'idle';
      this.lastTextLength = 0;
      this.lastTranscriptTail = '';
      this.finalTranscript = '';
      this.pendingTexts = [];
      this.pendingConfidences = [];
      this.lastEmitTime = Date.now();
      this.lastOndataavailableTime = Date.now();

      // Start recording with timeslice
      this.mediaRecorder.start(this.BLOB_TIMESLICE_MS);
      this.isRecording = true;

      // Start heartbeat to force requestData if needed (uses Web Worker)
      this.startHeartbeat();
      
      // Add visibility handler for tab switching recovery
      this.setupVisibilityHandler();

      this.callbacks.onStatusChange('Recording...');
      this.emitStats();
      console.log('📱 FixedIOS: Recording started - uploading individual 5s blobs');

    } catch (error: any) {
      console.error('📱 FixedIOS: Failed to start:', error);
      this.callbacks.onError(`Failed to start: ${error.message}`);
      throw error;
    }
  }

  /**
   * Stop recording and process remaining audio
   */
  async stop(): Promise<void> {
    if (!this.isRecording) {
      return;
    }

    console.log('📱 FixedIOS: Stopping transcription...');
    this.callbacks.onStatusChange('Processing final audio...');

    this.isRecording = false;
    this.stopHeartbeat();
    this.removeVisibilityHandler();

    // Stop MediaRecorder (triggers final ondataavailable)
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }

    // Stop stream
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    // Wait a moment for final blob to be queued
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Process any remaining queue
    while (this.queue.length > 0 || this.uploadInFlight) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Emit any remaining buffered text
    if (this.pendingTexts.length > 0) {
      this.emitBufferedText(true);
    }

    this.callbacks.onStatusChange('Recording stopped');
    this.emitStats();
    console.log('📱 FixedIOS: Stopped. Total transcribed chars:', this.totalTranscribedChars);
  }

  /**
   * Handle incoming audio blob from MediaRecorder
   * NOW: Queue each individual blob for upload (no combining!)
   */
  private handleDataAvailable(blob: Blob): void {
    this.capturedBlobCount++;
    this.lastOndataavailableTime = Date.now();

    console.log(`📱 FixedIOS: Received blob #${this.capturedBlobCount} (${(blob.size / 1024).toFixed(1)}KB)`);

    // Queue for immediate individual upload (no combining!)
    const queuedChunk: QueuedChunk = {
      blob,
      index: this.capturedBlobCount,
      capturedAt: Date.now(),
      retryCount: 0
    };

    this.queue.push(queuedChunk);
    this.emitStats();

    // Trigger queue drain
    this.drainQueue();
  }

  /**
   * Serial queue drain - upload one blob at a time
   */
  private async drainQueue(): Promise<void> {
    if (this.uploadInFlight || this.queue.length === 0) {
      return;
    }

    this.uploadInFlight = true;
    const item = this.queue.shift()!;
    
    try {
      this.lastUploadStatus = 'uploading';
      this.emitStats();

      const result = await this.uploadChunk(item);
      
      this.uploadedChunkCount++;
      this.lastUploadStatus = 'success';
      
      if (result.text && result.text.trim().length > 0) {
        const cleanText = result.text.trim();
        
        // Quality filtering: hallucination detection
        if (this.isLikelyRepetitiveNoise(cleanText, result.confidence)) {
          console.log(`📱 FixedIOS: Filtered hallucination: "${cleanText.substring(0, 50)}..."`);
        } else if (result.noSpeechProb && result.noSpeechProb > 0.85) {
          console.log(`📱 FixedIOS: Filtered high no_speech_prob (${(result.noSpeechProb * 100).toFixed(1)}%)`);
        } else if (result.confidence !== undefined && result.confidence < 0.12) {
          console.log(`📱 FixedIOS: Filtered low confidence (${(result.confidence * 100).toFixed(1)}%)`);
        } else {
          // Buffer this text for later emission
          this.pendingTexts.push(cleanText);
          this.pendingConfidences.push(result.confidence || 0.8);
          
          this.lastTextLength = cleanText.length;
          this.totalTranscribedChars += cleanText.length;
          
          // Update prompt tail for next chunk
          this.lastTranscriptTail = cleanText.slice(-this.PROMPT_TAIL_LENGTH);
          
          console.log(`📱 FixedIOS: Buffered text from chunk #${item.index}: "${cleanText.slice(0, 50)}..."`);
          
          // Check if we should emit accumulated text
          const timeSinceLastEmit = Date.now() - this.lastEmitTime;
          if (timeSinceLastEmit >= this.TEXT_EMIT_INTERVAL_MS || this.pendingTexts.length >= 3) {
            this.emitBufferedText(false);
          }
        }
      } else {
        console.log(`📱 FixedIOS: Chunk #${item.index} returned empty/silent`);
      }

    } catch (error: any) {
      console.error(`📱 FixedIOS: Upload failed for chunk #${item.index}:`, error);
      
      // Retry logic
      if (item.retryCount < 2) {
        item.retryCount++;
        this.lastUploadStatus = 'retrying';
        this.queue.unshift(item);
        console.log(`📱 FixedIOS: Retrying chunk #${item.index} (attempt ${item.retryCount + 1})`);
      } else {
        this.lastUploadStatus = 'failed';
        console.error(`📱 FixedIOS: Giving up on chunk #${item.index} after 3 attempts`);
      }
    } finally {
      this.uploadInFlight = false;
      this.emitStats();
      
      // Continue draining if more items
      if (this.queue.length > 0) {
        setTimeout(() => this.drainQueue(), 100);
      }
    }
  }

  /**
   * Emit buffered text with smart merge de-duplication
   */
  private emitBufferedText(isFinal: boolean): void {
    if (this.pendingTexts.length === 0) {
      return;
    }

    console.log(`📱 FixedIOS: Emitting ${this.pendingTexts.length} buffered texts`);

    // Merge all pending texts together with de-duplication
    let mergedText = '';
    for (const text of this.pendingTexts) {
      mergedText = this.smartMerge(mergedText, text);
    }

    // Now merge into final transcript
    this.finalTranscript = this.smartMerge(this.finalTranscript, mergedText);

    // Calculate average confidence
    const avgConfidence = this.pendingConfidences.reduce((a, b) => a + b, 0) / this.pendingConfidences.length;

    // Emit to UI
    this.callbacks.onTranscription(mergedText, isFinal, avgConfidence);
    console.log(`📱 FixedIOS: Emitted merged text (${mergedText.length} chars, ${(avgConfidence * 100).toFixed(0)}% conf)`);

    // Clear buffers
    this.pendingTexts = [];
    this.pendingConfidences = [];
    this.lastEmitTime = Date.now();
  }

  /**
   * Upload a single blob via multipart/form-data
   */
  private async uploadChunk(item: QueuedChunk): Promise<{ 
    text: string; 
    confidence?: number;
    noSpeechProb?: number;
    avgLogprob?: number;
  }> {
    const formData = new FormData();
    
    // Determine file extension based on MIME type
    const mimeType = item.blob.type || 'audio/mp4';
    const extension = mimeType.includes('mp4') || mimeType.includes('m4a') ? 'm4a' 
                    : mimeType.includes('webm') ? 'webm' 
                    : 'mp4';
    
    formData.append('file', item.blob, `chunk_${item.index}.${extension}`);
    formData.append('chunkIndex', String(item.index));
    formData.append('isFinal', 'false');
    formData.append('language', 'en');
    
    // Pass prompt for continuity (previous transcript tail)
    if (this.lastTranscriptTail) {
      formData.append('prompt', this.lastTranscriptTail);
    }
    
    if (this.meetingId) {
      formData.append('meetingId', this.meetingId);
    }
    if (this.sessionId) {
      formData.append('sessionId', this.sessionId);
    }

    console.log(`📱 FixedIOS: Uploading blob #${item.index} (${(item.blob.size / 1024).toFixed(1)}KB, ${extension})`);

    const { data, error } = await supabase.functions.invoke('speech-to-text-chunked', {
      body: formData
    });

    if (error) {
      throw error;
    }

    return {
      text: data?.data?.text || '',
      confidence: data?.confidence,
      noSpeechProb: data?.no_speech_prob,
      avgLogprob: data?.avg_logprob
    };
  }

  // ========== SMART MERGE DE-DUPLICATION ==========

  /**
   * Smart merge with de-duplication - removes overlapping words at chunk boundaries
   */
  private smartMerge(oldText: string, newText: string): string {
    if (!oldText) return newText;
    if (!newText) return oldText;
    
    const oldWords = oldText.trim().split(/\s+/);
    const newWords = newText.trim().split(/\s+/);
    
    // Look for overlap of last N words from old text in beginning of new text
    const checkLength = Math.min(15, oldWords.length, newWords.length);
    
    for (let i = checkLength; i >= 2; i--) {
      const lastOldWords = oldWords.slice(-i).join(' ').toLowerCase();
      const firstNewWords = newWords.slice(0, i).join(' ').toLowerCase();
      
      const similarity = this.calculateSimilarity(lastOldWords, firstNewWords);
      if (similarity > 0.7) {
        console.log(`📱 FixedIOS: De-dup found ${(similarity * 100).toFixed(0)}% match, removing ${i} overlapping words`);
        return oldText + " " + newWords.slice(i).join(' ');
      }
    }
    
    return oldText + " " + newText;
  }

  /**
   * Calculate similarity using Levenshtein distance
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Levenshtein distance calculation
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + cost
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  // ========== HALLUCINATION DETECTION ==========

  /**
   * Check if text is likely hallucinated/repetitive noise
   */
  private isLikelyRepetitiveNoise(text: string, confidence?: number): boolean {
    const result = isLikelyHallucination(text, confidence, {
      checkPhrases: true,
      checkRepetition: true,
      checkUrls: true,
      checkLaughter: true,
      confidenceThreshold: 0.15
    });
    
    if (result.isHallucination) {
      console.log(`📱 FixedIOS: Hallucination detected: ${result.reason}`);
    }
    
    return result.isHallucination;
  }

  // ========== HEARTBEAT & VISIBILITY ==========

  /**
   * Heartbeat: force requestData if no ondataavailable recently
   * Uses Web Worker to resist browser background throttling
   */
  private startHeartbeat(): void {
    const workerCode = `
      let intervalId = null;
      
      self.onmessage = (event) => {
        const { type, intervalMs } = event.data;
        
        if (type === 'start') {
          if (intervalId) clearInterval(intervalId);
          intervalId = setInterval(() => {
            self.postMessage({ type: 'tick', timestamp: Date.now() });
          }, intervalMs);
          self.postMessage({ type: 'tick', timestamp: Date.now(), isInitial: true });
        } else if (type === 'stop') {
          if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
          }
        }
      };
    `;
    
    try {
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      this.heartbeatWorkerBlobUrl = URL.createObjectURL(blob);
      this.heartbeatWorker = new Worker(this.heartbeatWorkerBlobUrl);
      
      this.heartbeatWorker.onmessage = (event) => {
        if (event.data.type === 'tick') {
          this.handleHeartbeatTick();
        }
      };
      
      this.heartbeatWorker.postMessage({ 
        type: 'start', 
        intervalMs: this.HEARTBEAT_INTERVAL_MS 
      });
      
      console.log('📱 FixedIOS: Web Worker heartbeat started');
    } catch (error) {
      console.warn('📱 FixedIOS: Web Worker failed, using setInterval fallback:', error);
      this.startHeartbeatFallback();
    }
  }
  
  private startHeartbeatFallback(): void {
    setInterval(() => {
      if (this.isRecording) {
        this.handleHeartbeatTick();
      }
    }, this.HEARTBEAT_INTERVAL_MS);
  }
  
  private handleHeartbeatTick(): void {
    if (!this.isRecording || !this.mediaRecorder) return;

    const timeSinceLastData = Date.now() - this.lastOndataavailableTime;
    
    if (timeSinceLastData > this.HEARTBEAT_INTERVAL_MS) {
      console.log(`📱 FixedIOS: Heartbeat - forcing requestData (${Math.round(timeSinceLastData / 1000)}s since last)`);
      
      if (this.mediaRecorder.state === 'recording') {
        try {
          this.mediaRecorder.requestData();
        } catch (e) {
          console.warn('📱 FixedIOS: requestData failed:', e);
        }
      }
    }
    
    // Also check if we should emit buffered text
    const timeSinceLastEmit = Date.now() - this.lastEmitTime;
    if (this.pendingTexts.length > 0 && timeSinceLastEmit >= this.TEXT_EMIT_INTERVAL_MS) {
      this.emitBufferedText(false);
    }
  }

  private stopHeartbeat(): void {
    if (this.heartbeatWorker) {
      this.heartbeatWorker.postMessage({ type: 'stop' });
      this.heartbeatWorker.terminate();
      this.heartbeatWorker = null;
    }
    if (this.heartbeatWorkerBlobUrl) {
      URL.revokeObjectURL(this.heartbeatWorkerBlobUrl);
      this.heartbeatWorkerBlobUrl = null;
    }
  }
  
  /**
   * Setup visibility handler to recover when tab becomes visible
   */
  private setupVisibilityHandler(): void {
    this.visibilityHandler = () => {
      if (document.visibilityState === 'visible' && this.isRecording) {
        console.log('📱 FixedIOS: Tab visible - forcing immediate data request');
        
        if (this.mediaRecorder?.state === 'recording') {
          try {
            this.mediaRecorder.requestData();
          } catch (e) {
            console.warn('📱 FixedIOS: requestData on visibility failed:', e);
          }
        }
        
        if (this.queue.length > 0 && !this.uploadInFlight) {
          this.drainQueue();
        }
      }
    };
    
    document.addEventListener('visibilitychange', this.visibilityHandler);
  }
  
  private removeVisibilityHandler(): void {
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
  }

  /**
   * Emit stats update for UI
   */
  private emitStats(): void {
    const stats: IOSTranscriberStats = {
      capturedBlobs: this.capturedBlobCount,
      queueLength: this.queue.length,
      uploadedChunks: this.uploadedChunkCount,
      lastUploadStatus: this.lastUploadStatus,
      lastTextLength: this.lastTextLength,
      isRecording: this.isRecording,
      totalTranscribedChars: this.totalTranscribedChars,
      lastOndataavailableTime: this.lastOndataavailableTime,
      bufferedTextCount: this.pendingTexts.length
    };

    this.callbacks.onStatsUpdate?.(stats);
  }

  /**
   * Get current stats
   */
  public getStats(): IOSTranscriberStats {
    return {
      capturedBlobs: this.capturedBlobCount,
      queueLength: this.queue.length,
      uploadedChunks: this.uploadedChunkCount,
      lastUploadStatus: this.lastUploadStatus,
      lastTextLength: this.lastTextLength,
      isRecording: this.isRecording,
      totalTranscribedChars: this.totalTranscribedChars,
      lastOndataavailableTime: this.lastOndataavailableTime,
      bufferedTextCount: this.pendingTexts.length
    };
  }

  /**
   * Check if recording
   */
  public isActive(): boolean {
    return this.isRecording;
  }
}
