/**
 * Simple iOS Transcriber - Serial Queue-Based Approach
 * 
 * Replaces the complex iPhoneChunkManager/iPhoneWhisperTranscriber with a simple,
 * observable, serial transcription pipeline that works reliably on iOS Safari.
 * 
 * Key principles:
 * - MediaRecorder emits independent blobs (no concatenation)
 * - Each blob is queued and uploaded serially (max 1 inflight)
 * - Multipart/form-data upload (no base64 conversion)
 * - Continuity via prompt text, not overlapping audio
 * - Simple, observable state for debugging
 */

import { supabase } from "@/integrations/supabase/client";

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
}

interface QueuedBlob {
  blob: Blob;
  index: number;
  capturedAt: number;
  retryCount: number;
}

export class SimpleIOSTranscriber {
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private isRecording = false;
  
  // Serial upload queue
  private queue: QueuedBlob[] = [];
  private uploadInFlight = false;
  private capturedBlobCount = 0;
  private uploadedChunkCount = 0;
  private totalTranscribedChars = 0;
  private lastUploadStatus: IOSTranscriberStats['lastUploadStatus'] = 'idle';
  private lastTextLength = 0;
  private lastOndataavailableTime = 0;
  
  // Continuity: pass last transcript tail as prompt
  private lastTranscriptTail = '';
  private readonly PROMPT_TAIL_LENGTH = 200;
  
  // Web Worker-based heartbeat (resistant to background throttling)
  private heartbeatWorker: Worker | null = null;
  private heartbeatWorkerBlobUrl: string | null = null;
  private readonly HEARTBEAT_INTERVAL_MS = 8000;
  private readonly TIMESLICE_MS = 5000; // 5 second blobs
  
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
      console.log('📱 SimpleIOS: Already recording');
      return;
    }

    try {
      this.callbacks.onStatusChange('Starting iOS transcription...');
      console.log('📱 SimpleIOS: Starting transcription...');

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
      console.log('📱 SimpleIOS: Got microphone stream');

      // Determine MIME type (iOS prefers audio/mp4)
      const mimeType = MediaRecorder.isTypeSupported('audio/mp4') 
        ? 'audio/mp4' 
        : MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm';

      console.log('📱 SimpleIOS: Using MIME type:', mimeType);

      // Create MediaRecorder with timeslice for automatic blob emission
      this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.handleDataAvailable(event.data);
        }
      };

      this.mediaRecorder.onerror = (event: any) => {
        console.error('📱 SimpleIOS: MediaRecorder error:', event.error);
        this.callbacks.onError(`Recording error: ${event.error?.message || 'Unknown'}`);
      };

      this.mediaRecorder.onstop = () => {
        console.log('📱 SimpleIOS: MediaRecorder stopped');
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
      this.lastOndataavailableTime = Date.now();

      // Start recording with timeslice
      this.mediaRecorder.start(this.TIMESLICE_MS);
      this.isRecording = true;

      // Start heartbeat to force requestData if needed (uses Web Worker)
      this.startHeartbeat();
      
      // Add visibility handler for tab switching recovery
      this.setupVisibilityHandler();

      this.callbacks.onStatusChange('Recording...');
      this.emitStats();
      console.log('📱 SimpleIOS: Recording started with timeslice:', this.TIMESLICE_MS);

    } catch (error: any) {
      console.error('📱 SimpleIOS: Failed to start:', error);
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

    console.log('📱 SimpleIOS: Stopping transcription...');
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

    // Wait a moment for final blob to be queued, then drain
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Process any remaining queue
    while (this.queue.length > 0 || this.uploadInFlight) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    this.callbacks.onStatusChange('Recording stopped');
    this.emitStats();
    console.log('📱 SimpleIOS: Stopped. Total transcribed chars:', this.totalTranscribedChars);
  }

  /**
   * Handle incoming audio blob from MediaRecorder
   */
  private handleDataAvailable(blob: Blob): void {
    this.capturedBlobCount++;
    this.lastOndataavailableTime = Date.now();

    console.log(`📱 SimpleIOS: Captured blob #${this.capturedBlobCount} (${(blob.size / 1024).toFixed(1)}KB)`);

    const queuedBlob: QueuedBlob = {
      blob,
      index: this.capturedBlobCount,
      capturedAt: Date.now(),
      retryCount: 0
    };

    this.queue.push(queuedBlob);
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

      const result = await this.uploadBlob(item);
      
      this.uploadedChunkCount++;
      this.lastUploadStatus = 'success';
      
      if (result.text && result.text.trim().length > 0) {
        const text = result.text.trim();
        this.lastTextLength = text.length;
        this.totalTranscribedChars += text.length;
        
        // Update prompt tail for next chunk
        this.lastTranscriptTail = text.slice(-this.PROMPT_TAIL_LENGTH);
        
        // Emit transcription
        this.callbacks.onTranscription(text, true, result.confidence || 0.8);
        console.log(`📱 SimpleIOS: Transcribed chunk #${item.index}: "${text.slice(0, 50)}..."`);
      } else {
        console.log(`📱 SimpleIOS: Chunk #${item.index} returned empty/silent`);
      }

    } catch (error: any) {
      console.error(`📱 SimpleIOS: Upload failed for chunk #${item.index}:`, error);
      
      // Retry logic
      if (item.retryCount < 2) {
        item.retryCount++;
        this.lastUploadStatus = 'retrying';
        this.queue.unshift(item); // Re-add to front of queue
        console.log(`📱 SimpleIOS: Retrying chunk #${item.index} (attempt ${item.retryCount + 1})`);
      } else {
        this.lastUploadStatus = 'failed';
        console.error(`📱 SimpleIOS: Giving up on chunk #${item.index} after 3 attempts`);
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
   * Upload a single blob via multipart/form-data
   */
  private async uploadBlob(item: QueuedBlob): Promise<{ text: string; confidence?: number }> {
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

    console.log(`📱 SimpleIOS: Uploading chunk #${item.index} (${(item.blob.size / 1024).toFixed(1)}KB, ${extension})`);

    const { data, error } = await supabase.functions.invoke('speech-to-text-chunked', {
      body: formData
    });

    if (error) {
      throw error;
    }

    return {
      text: data?.data?.text || '',
      confidence: data?.confidence
    };
  }

  /**
   * Heartbeat: force requestData if no ondataavailable recently
   * Uses Web Worker to resist browser background throttling
   */
  private startHeartbeat(): void {
    // Create inline Web Worker for background-resistant timing
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
      
      console.log('📱 SimpleIOS: Web Worker heartbeat started');
    } catch (error) {
      // Fallback to setInterval if Web Worker fails
      console.warn('📱 SimpleIOS: Web Worker failed, using setInterval fallback:', error);
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
      console.log(`📱 SimpleIOS: Heartbeat - forcing requestData (${Math.round(timeSinceLastData / 1000)}s since last)`);
      
      if (this.mediaRecorder.state === 'recording') {
        try {
          this.mediaRecorder.requestData();
        } catch (e) {
          console.warn('📱 SimpleIOS: requestData failed:', e);
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
        console.log('📱 SimpleIOS: Tab visible - forcing immediate data request');
        
        // Force request current data when returning to tab
        if (this.mediaRecorder?.state === 'recording') {
          try {
            this.mediaRecorder.requestData();
          } catch (e) {
            console.warn('📱 SimpleIOS: requestData on visibility failed:', e);
          }
        }
        
        // Process any queued blobs immediately
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
      lastOndataavailableTime: this.lastOndataavailableTime
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
      lastOndataavailableTime: this.lastOndataavailableTime
    };
  }

  /**
   * Check if recording
   */
  public isActive(): boolean {
    return this.isRecording;
  }
}
