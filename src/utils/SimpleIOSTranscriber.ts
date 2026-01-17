/**
 * Enhanced iOS Transcriber - Desktop-Quality Approach for iOS
 * 
 * Now uses the same quality features as DesktopWhisperTranscriber:
 * - Audio buffering to 20 seconds (not 5s blobs)
 * - Smart merge de-duplication using Levenshtein distance
 * - Hallucination/noise filtering
 * - Confidence gating
 * - Serial queue upload with retry
 * 
 * Key principles:
 * - MediaRecorder emits 5s blobs, but we accumulate to 20s before uploading
 * - Each accumulated chunk is queued and uploaded serially (max 1 inflight)
 * - Multipart/form-data upload (no base64 conversion)
 * - Smart merge removes overlapping words at chunk boundaries
 * - Hallucination patterns are filtered out
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
  bufferedDurationMs: number; // NEW: Track buffered audio duration
}

interface QueuedChunk {
  blob: Blob;
  index: number;
  capturedAt: number;
  retryCount: number;
  durationMs: number;
}

export class SimpleIOSTranscriber {
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private isRecording = false;
  
  // Audio buffering - accumulate 5s blobs until we have ~20s of audio
  private audioBuffer: Blob[] = [];
  private bufferedDurationMs = 0;
  private readonly TARGET_CHUNK_DURATION_MS = 20000; // 20 seconds (matching desktop)
  private readonly MIN_CHUNK_DURATION_MS = 8000; // Minimum 8s before allowing upload
  private readonly BLOB_TIMESLICE_MS = 5000; // MediaRecorder emits every 5s
  
  // Serial upload queue
  private queue: QueuedChunk[] = [];
  private uploadInFlight = false;
  private capturedBlobCount = 0;
  private uploadedChunkCount = 0;
  private totalTranscribedChars = 0;
  private lastUploadStatus: IOSTranscriberStats['lastUploadStatus'] = 'idle';
  private lastTextLength = 0;
  private lastOndataavailableTime = 0;
  
  // Smart merge: accumulated transcript for de-duplication
  private finalTranscript = '';
  private lastTranscriptTail = '';
  private readonly PROMPT_TAIL_LENGTH = 200;
  
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
      console.log('📱 EnhancedIOS: Already recording');
      return;
    }

    try {
      this.callbacks.onStatusChange('Starting iOS transcription...');
      console.log('📱 EnhancedIOS: Starting transcription with desktop-quality features...');

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
      console.log('📱 EnhancedIOS: Got microphone stream');

      // Determine MIME type (iOS prefers audio/mp4)
      const mimeType = MediaRecorder.isTypeSupported('audio/mp4') 
        ? 'audio/mp4' 
        : MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm';

      console.log('📱 EnhancedIOS: Using MIME type:', mimeType);

      // Create MediaRecorder with timeslice for automatic blob emission
      this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.handleDataAvailable(event.data);
        }
      };

      this.mediaRecorder.onerror = (event: any) => {
        console.error('📱 EnhancedIOS: MediaRecorder error:', event.error);
        this.callbacks.onError(`Recording error: ${event.error?.message || 'Unknown'}`);
      };

      this.mediaRecorder.onstop = () => {
        console.log('📱 EnhancedIOS: MediaRecorder stopped');
      };

      // Reset state
      this.audioBuffer = [];
      this.bufferedDurationMs = 0;
      this.queue = [];
      this.uploadInFlight = false;
      this.capturedBlobCount = 0;
      this.uploadedChunkCount = 0;
      this.totalTranscribedChars = 0;
      this.lastUploadStatus = 'idle';
      this.lastTextLength = 0;
      this.lastTranscriptTail = '';
      this.finalTranscript = '';
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
      console.log('📱 EnhancedIOS: Recording started with 20s buffering (5s blobs)');

    } catch (error: any) {
      console.error('📱 EnhancedIOS: Failed to start:', error);
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

    console.log('📱 EnhancedIOS: Stopping transcription...');
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
    
    // Flush any remaining buffered audio (even if < 20s)
    if (this.audioBuffer.length > 0) {
      console.log(`📱 EnhancedIOS: Flushing final ${this.bufferedDurationMs}ms of buffered audio`);
      this.flushAudioBuffer(true);
    }
    
    // Process any remaining queue
    while (this.queue.length > 0 || this.uploadInFlight) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    this.callbacks.onStatusChange('Recording stopped');
    this.emitStats();
    console.log('📱 EnhancedIOS: Stopped. Total transcribed chars:', this.totalTranscribedChars);
  }

  /**
   * Handle incoming audio blob from MediaRecorder
   * Now buffers blobs until we have ~20s of audio
   */
  private handleDataAvailable(blob: Blob): void {
    this.capturedBlobCount++;
    this.lastOndataavailableTime = Date.now();

    // Add to buffer
    this.audioBuffer.push(blob);
    this.bufferedDurationMs += this.BLOB_TIMESLICE_MS;

    console.log(`📱 EnhancedIOS: Buffered blob #${this.capturedBlobCount} (${(blob.size / 1024).toFixed(1)}KB) - Total buffer: ${this.bufferedDurationMs}ms`);
    this.emitStats();

    // Check if we've accumulated enough audio
    if (this.bufferedDurationMs >= this.TARGET_CHUNK_DURATION_MS) {
      console.log(`📱 EnhancedIOS: Buffer reached ${this.bufferedDurationMs}ms - flushing for transcription`);
      this.flushAudioBuffer(false);
    }
  }

  /**
   * Flush accumulated audio buffer into a single chunk for upload
   */
  private flushAudioBuffer(isFinal: boolean): void {
    if (this.audioBuffer.length === 0) {
      return;
    }

    // Don't flush if below minimum duration (unless final)
    if (!isFinal && this.bufferedDurationMs < this.MIN_CHUNK_DURATION_MS) {
      console.log(`📱 EnhancedIOS: Skipping flush - only ${this.bufferedDurationMs}ms (min: ${this.MIN_CHUNK_DURATION_MS}ms)`);
      return;
    }

    // Combine all buffered blobs into one
    const combinedBlob = new Blob(this.audioBuffer, { type: this.audioBuffer[0].type });
    const durationMs = this.bufferedDurationMs;
    
    console.log(`📱 EnhancedIOS: Created ${(combinedBlob.size / 1024).toFixed(1)}KB chunk from ${this.audioBuffer.length} blobs (${durationMs}ms)`);

    // Queue for upload
    const queuedChunk: QueuedChunk = {
      blob: combinedBlob,
      index: this.uploadedChunkCount + this.queue.length + 1,
      capturedAt: Date.now(),
      retryCount: 0,
      durationMs
    };

    this.queue.push(queuedChunk);
    
    // Clear buffer
    this.audioBuffer = [];
    this.bufferedDurationMs = 0;
    
    this.emitStats();

    // Trigger queue drain
    this.drainQueue();
  }

  /**
   * Serial queue drain - upload one chunk at a time
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
          console.log(`📱 EnhancedIOS: Filtered hallucination: "${cleanText.substring(0, 50)}..."`);
        } else if (result.noSpeechProb && result.noSpeechProb > 0.85) {
          // High no_speech_prob - likely silence
          console.log(`📱 EnhancedIOS: Filtered high no_speech_prob (${(result.noSpeechProb * 100).toFixed(1)}%)`);
        } else if (result.confidence !== undefined && result.confidence < 0.12) {
          // Extremely low confidence
          console.log(`📱 EnhancedIOS: Filtered low confidence (${(result.confidence * 100).toFixed(1)}%)`);
        } else {
          // Smart merge de-duplication
          this.finalTranscript = this.smartMerge(this.finalTranscript, cleanText);
          
          this.lastTextLength = cleanText.length;
          this.totalTranscribedChars += cleanText.length;
          
          // Update prompt tail for next chunk
          this.lastTranscriptTail = cleanText.slice(-this.PROMPT_TAIL_LENGTH);
          
          // Emit transcription
          this.callbacks.onTranscription(cleanText, true, result.confidence || 0.8);
          console.log(`📱 EnhancedIOS: Transcribed chunk #${item.index}: "${cleanText.slice(0, 50)}..."`);
        }
      } else {
        console.log(`📱 EnhancedIOS: Chunk #${item.index} returned empty/silent`);
      }

    } catch (error: any) {
      console.error(`📱 EnhancedIOS: Upload failed for chunk #${item.index}:`, error);
      
      // Retry logic
      if (item.retryCount < 2) {
        item.retryCount++;
        this.lastUploadStatus = 'retrying';
        this.queue.unshift(item); // Re-add to front of queue
        console.log(`📱 EnhancedIOS: Retrying chunk #${item.index} (attempt ${item.retryCount + 1})`);
      } else {
        this.lastUploadStatus = 'failed';
        console.error(`📱 EnhancedIOS: Giving up on chunk #${item.index} after 3 attempts`);
      }
    } finally {
      this.uploadInFlight = false;
      this.emitStats();
      
      // Continue draining if more items
      if (this.queue.length > 0) {
        // Small delay between uploads to avoid overwhelming
        setTimeout(() => this.drainQueue(), 100);
      }
    }
  }

  /**
   * Upload a single chunk via multipart/form-data
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

    console.log(`📱 EnhancedIOS: Uploading chunk #${item.index} (${(item.blob.size / 1024).toFixed(1)}KB, ${item.durationMs}ms, ${extension})`);

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

  // ========== SMART MERGE DE-DUPLICATION (ported from DesktopWhisperTranscriber) ==========

  /**
   * Smart merge with de-duplication - removes overlapping words at chunk boundaries
   */
  private smartMerge(oldText: string, newText: string): string {
    if (!oldText) return newText;
    if (!newText) return oldText;
    
    // Drop leading tokens in new chunk that appear at end of previous
    const oldWords = oldText.trim().split(/\s+/);
    const newWords = newText.trim().split(/\s+/);
    
    // Look for fuzzy match of last 12-20 words from old text in beginning of new text
    const checkLength = Math.min(20, oldWords.length, newWords.length);
    
    for (let i = checkLength; i >= 3; i--) { // At least 3 words to be meaningful
      const lastOldWords = oldWords.slice(-i).join(' ').toLowerCase();
      const firstNewWords = newWords.slice(0, i).join(' ').toLowerCase();
      
      // Use fuzzy matching to handle slight transcription differences
      const similarity = this.calculateSimilarity(lastOldWords, firstNewWords);
      if (similarity > 0.7) { // 70% similarity threshold
        console.log(`📱 EnhancedIOS: De-duplication found ${(similarity * 100).toFixed(0)}% similarity, removing ${i} overlapping words`);
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
          matrix[j][i - 1] + 1,     // deletion
          matrix[j - 1][i] + 1,     // insertion
          matrix[j - 1][i - 1] + cost // substitution
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  // ========== HALLUCINATION DETECTION (ported from DesktopWhisperTranscriber) ==========

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
      console.log(`📱 EnhancedIOS: Hallucination detected: ${result.reason}`);
    }
    
    return result.isHallucination;
  }

  // ========== HEARTBEAT & VISIBILITY (kept from original) ==========

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
          // Send initial tick
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
      
      console.log('📱 EnhancedIOS: Web Worker heartbeat started');
    } catch (error) {
      // Fallback to setInterval if Web Worker fails
      console.warn('📱 EnhancedIOS: Web Worker failed, using setInterval fallback:', error);
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
      console.log(`📱 EnhancedIOS: Heartbeat - forcing requestData (${Math.round(timeSinceLastData / 1000)}s since last)`);
      
      if (this.mediaRecorder.state === 'recording') {
        try {
          this.mediaRecorder.requestData();
        } catch (e) {
          console.warn('📱 EnhancedIOS: requestData failed:', e);
        }
      }
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
        console.log('📱 EnhancedIOS: Tab visible - forcing immediate data request');
        
        // Force request current data when returning to tab
        if (this.mediaRecorder?.state === 'recording') {
          try {
            this.mediaRecorder.requestData();
          } catch (e) {
            console.warn('📱 EnhancedIOS: requestData on visibility failed:', e);
          }
        }
        
        // Process any queued chunks immediately
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
      bufferedDurationMs: this.bufferedDurationMs
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
      bufferedDurationMs: this.bufferedDurationMs
    };
  }

  /**
   * Check if recording
   */
  public isActive(): boolean {
    return this.isRecording;
  }
}
