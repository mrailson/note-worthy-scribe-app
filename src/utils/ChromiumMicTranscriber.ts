/**
 * Chromium Microphone Pipeline for Desktop Chrome/Edge
 * 
 * This transcriber is specifically designed for desktop Chromium browsers
 * (Chrome/Edge) and is guarded by the USE_CHROMIUM_MIC_PIPELINE feature flag.
 * 
 * IMPORTANT: This must NOT be used for Teams/system audio capture.
 * This is for microphone input only on desktop Chromium browsers.
 * 
 * Features:
 * - Optimized getUserMedia constraints for Chromium
 * - Proper MIME type selection (prefers Opus in WebM)
 * - Small, reliable chunks (1s) to reduce backpressure
 * - Async upload queue with graceful degradation
 * - Comprehensive telemetry and error handling
 */

import { supabase } from '@/integrations/supabase/client';
import { hasAudioActivity, getOptimalChunkInterval, OPTIMAL_CHUNK_DURATION } from './audioLevelDetection';
import { meetsConfidenceThreshold, withDefaultThresholds, type MeetingSettingsWithThresholds } from './confidenceGating';

export interface ChromiumTranscriptData {
  text: string;
  is_final: boolean;
  confidence: number;
  start?: number;
  end?: number;
  speaker?: string;
}

interface QueuedChunk {
  blob: Blob;
  timestamp: number;
  chunkId: string;
}

export class ChromiumMicTranscriber {
  private mediaRecorder: MediaRecorder | null = null;
  private audioStream: MediaStream | null = null;
  private uploadQueue: QueuedChunk[] = [];
  private isUploading = false;
  private isActive = false;
  private chunkCounter = 0;
  private sessionId: string;
  private lastErrorTime = 0;
  private errorCount = 0;
  private meetingSettings: MeetingSettingsWithThresholds;
  
  // Constants - Phase 2: Optimized for 20-30s chunks  
  private readonly CHUNK_MS = OPTIMAL_CHUNK_DURATION.PREFERRED_MS; // 25 second chunks
  private readonly MAX_QUEUE_SIZE = 10; // Max 10 chunks in queue
  private readonly UPLOAD_TIMEOUT_MS = 5000; // 5 second upload timeout
  private readonly ERROR_COOLDOWN_MS = 60000; // 1 minute between auto-restarts
  private readonly MAX_RETRIES = 3;
  
  // Track health monitoring and recovery
  private trackHealthInterval: NodeJS.Timeout | null = null;
  private recoveryInProgress = false;
  
  // Wake Lock
  private wakeLockSentinel: WakeLockSentinel | null = null;
  
  // Visibility handler
  private visibilityHandler: (() => void) | null = null;

  constructor(
    private onTranscription: (data: ChromiumTranscriptData) => void,
    private onError: (error: string) => void,
    private onStatusChange: (status: string) => void,
    meetingSettings?: any,
    private selectedDeviceId?: string | null
  ) {
    this.sessionId = `chromium_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.meetingSettings = withDefaultThresholds(meetingSettings);
    this.logEvent('chromium_mic.init', { sessionId: this.sessionId });
  }

  async startTranscription(): Promise<void> {
    try {
      this.logEvent('chromium_mic.start_attempt');
      this.onStatusChange('Initializing microphone...');

      // Get optimized audio stream for Chromium
      // Use selected device if provided
      const audioConstraints: MediaTrackConstraints = {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 44100
      };
      
      if (this.selectedDeviceId) {
        audioConstraints.deviceId = { exact: this.selectedDeviceId };
        this.logEvent('chromium_mic.using_selected_device', { deviceId: this.selectedDeviceId });
      }
      
      this.audioStream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints
      });

      // Select optimal MIME type for Chromium
      let mimeType: string;
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        mimeType = 'audio/webm';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      } else {
        mimeType = '';
      }

      this.logEvent('chromium_mic.mime_selected', { mimeType });

      // Create MediaRecorder with selected MIME type
      this.mediaRecorder = new MediaRecorder(
        this.audioStream,
        mimeType ? { mimeType } : undefined
      );

      // Set up event handlers
      this.setupRecorderEventHandlers();

      // Start recording with small chunks
      this.mediaRecorder.start(this.CHUNK_MS);
      this.isActive = true;
      this.chunkCounter = 0;
      this.uploadQueue = [];

      // Setup track health monitoring
      this.setupTrackMonitoring();
      
      // Setup visibility handler
      this.setupVisibilityHandler();
      
      // Acquire Wake Lock
      await this.acquireWakeLock();

      this.onStatusChange('Recording active');
      this.logEvent('chromium_mic.start', { 
        mimeType, 
        chunkMs: this.CHUNK_MS,
        sessionId: this.sessionId 
      });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logEvent('chromium_mic.start_error', { error: errorMsg });
      this.onError(`Failed to start Chromium mic: ${errorMsg}`);
      throw error;
    }
  }

  stopTranscription(): void {
    try {
      this.logEvent('chromium_mic.stop_attempt');
      this.isActive = false;

      // Stop track health monitoring
      this.stopTrackMonitoring();
      
      // Remove visibility handler
      this.removeVisibilityHandler();
      
      // Release Wake Lock
      this.releaseWakeLock();

      if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
        this.mediaRecorder.stop();
      }

      if (this.audioStream) {
        this.audioStream.getTracks().forEach(track => {
          track.stop();
          this.logEvent('chromium_mic.track_stopped', { trackId: track.id });
        });
        this.audioStream = null;
      }

      // Flush remaining queue with timeout
      this.flushQueueWithTimeout();

      this.onStatusChange('Stopped');
      this.logEvent('chromium_mic.stop', { 
        sessionId: this.sessionId,
        finalChunkCount: this.chunkCounter,
        remainingQueueSize: this.uploadQueue.length
      });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logEvent('chromium_mic.stop_error', { error: errorMsg });
    }
  }

  isRecording(): boolean {
    return this.isActive;
  }

  private setupRecorderEventHandlers(): void {
    if (!this.mediaRecorder) return;

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.handleAudioChunk(event.data);
      }
    };

    this.mediaRecorder.onerror = (event) => {
      const errorEvent = event as ErrorEvent;
      const error = errorEvent.error || new Error('MediaRecorder error');
      this.logEvent('chromium_mic.recorder_error', { 
        error: error.message,
        state: this.mediaRecorder?.state 
      });
      this.handleRecorderError(error.message);
    };

    this.mediaRecorder.onstop = () => {
      this.logEvent('chromium_mic.recorder_stopped');
    };

    // Monitor stream track ended
    if (this.audioStream) {
      this.audioStream.getTracks().forEach(track => {
        track.addEventListener('ended', () => {
          this.logEvent('chromium_mic.track_ended', { trackId: track.id });
          this.handleStreamEnded();
        });
      });
    }
  }

  private handleAudioChunk(blob: Blob): void {
    const chunkId = `chunk_${this.chunkCounter++}`;
    const timestamp = Date.now();

    this.logEvent('chromium_mic.chunk_received', { 
      chunkId, 
      size: blob.size, 
      type: blob.type 
    });

    // Add to queue
    const queuedChunk: QueuedChunk = { blob, timestamp, chunkId };
    
    // Drop oldest if queue is full
    if (this.uploadQueue.length >= this.MAX_QUEUE_SIZE) {
      const dropped = this.uploadQueue.shift();
      this.logEvent('chromium_mic.chunk_drop', { 
        droppedId: dropped?.chunkId,
        queueSize: this.uploadQueue.length
      });
    }

    this.uploadQueue.push(queuedChunk);
    
    // Process queue
    this.processUploadQueue();
  }

  private async processUploadQueue(): Promise<void> {
    if (this.isUploading || this.uploadQueue.length === 0) {
      return;
    }

    this.isUploading = true;

    while (this.uploadQueue.length > 0) {
      const chunk = this.uploadQueue.shift();
      if (!chunk) break;

      try {
        await this.uploadChunk(chunk);
        this.logEvent('chromium_mic.chunk_ok', { 
          chunkId: chunk.chunkId,
          latency: Date.now() - chunk.timestamp
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Upload failed';
        this.logEvent('chromium_mic.upload_err', { 
          chunkId: chunk.chunkId,
          error: errorMsg 
        });
        
        // Don't retry individual chunks to avoid blocking the queue
        console.warn(`Failed to upload chunk ${chunk.chunkId}:`, errorMsg);
      }
    }

    this.isUploading = false;
  }

  private async uploadChunk(chunk: QueuedChunk): Promise<void> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.UPLOAD_TIMEOUT_MS);

    try {
      // Convert blob to base64
      const arrayBuffer = await chunk.blob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // Phase 2: Check audio activity before transcription
      if (!hasAudioActivity(uint8Array, 0.01)) {
        console.log(`🔇 Skipping chunk ${chunk.chunkId} due to low audio activity`);
        return; // Skip transcription for silent chunks
      }
      
      // Convert to base64 in chunks to prevent memory issues
      let binary = '';
      const chunkSize = 0x8000; // 32KB chunks
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const subChunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
        binary += String.fromCharCode.apply(null, Array.from(subChunk));
      }
      const base64Audio = btoa(binary);

      // Send to existing speech-to-text function
      const { data, error } = await supabase.functions.invoke('speech-to-text', {
        body: { 
          audio: base64Audio,
          sessionId: this.sessionId,
          chunkId: chunk.chunkId
        }
      });

      clearTimeout(timeoutId);

      if (error) {
        throw new Error(`STT API error: ${error.message || 'Unknown error'}`);
      }

      if (data?.text && data.text.trim()) {
        const transcriptData: ChromiumTranscriptData = {
          text: data.text.trim(),
          is_final: true,
          confidence: data.confidence || 0.8,
          speaker: 'Speaker'
        };

        // Log quality for analysis but don't block - always show to user
        if (!meetsConfidenceThreshold(transcriptData.confidence, this.meetingSettings)) {
          this.logEvent('chromium_mic.low_confidence', {
            confidence: transcriptData.confidence,
            threshold: this.meetingSettings.transcriberThresholds[this.meetingSettings.transcriberService],
            text: transcriptData.text.substring(0, 50)
          });
        }
        
        this.onTranscription(transcriptData);
        this.logEvent('chromium_mic.transcription', {
          text: transcriptData.text.substring(0, 50),
          confidence: transcriptData.confidence
        });
      }

    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  private handleRecorderError(errorMessage: string): void {
    this.errorCount++;
    const now = Date.now();

    this.logEvent('chromium_mic.error_handled', { 
      errorMessage,
      errorCount: this.errorCount,
      timeSinceLastError: now - this.lastErrorTime
    });

    this.onError(`Recording error: ${errorMessage}`);

    // Auto-restart logic with cooldown
    if (this.errorCount <= this.MAX_RETRIES && 
        (now - this.lastErrorTime) > this.ERROR_COOLDOWN_MS) {
      
      this.lastErrorTime = now;
      
      setTimeout(() => {
        if (this.isActive) {
          this.logEvent('chromium_mic.auto_restart_attempt');
          this.restartRecording();
        }
      }, 1000);
    } else {
      this.onError('Too many errors, recording stopped');
      this.stopTranscription();
    }
  }

  private handleStreamEnded(): void {
    this.logEvent('chromium_mic.stream_ended');
    this.onStatusChange('Recording paused - audio device lost');
    
    if (this.isActive && !this.recoveryInProgress) {
      this.restartRecording(0);
    }
  }

  private async restartRecording(attempt = 0): Promise<void> {
    if (this.recoveryInProgress && attempt === 0) return;
    this.recoveryInProgress = true;
    
    try {
      this.logEvent('chromium_mic.restart_attempt', { attempt: attempt + 1 });
      
      // Clean up current state
      if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
        try { this.mediaRecorder.stop(); } catch {}
      }
      
      if (this.audioStream) {
        this.audioStream.getTracks().forEach(track => track.stop());
      }

      // Wait a moment then restart
      await new Promise(resolve => setTimeout(resolve, 500));
      
      if (this.isActive) {
        // Re-acquire stream
        const audioConstraints: MediaTrackConstraints = {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        };
        if (this.selectedDeviceId) {
          audioConstraints.deviceId = { exact: this.selectedDeviceId };
        }
        
        this.audioStream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
        
        // Select MIME type
        let mimeType = '';
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = 'audio/webm';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        }
        
        this.mediaRecorder = new MediaRecorder(
          this.audioStream,
          mimeType ? { mimeType } : undefined
        );
        
        this.setupRecorderEventHandlers();
        this.mediaRecorder.start(this.CHUNK_MS);
        
        // Re-setup monitoring
        this.stopTrackMonitoring();
        this.setupTrackMonitoring();
        
        // Re-acquire Wake Lock
        await this.acquireWakeLock();
        
        this.recoveryInProgress = false;
        this.onStatusChange('Recording resumed');
        this.logEvent('chromium_mic.restart_success');
      } else {
        this.recoveryInProgress = false;
      }

    } catch (error) {
      this.recoveryInProgress = false;
      this.logEvent('chromium_mic.restart_failed', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        attempt: attempt + 1
      });
      
      if (attempt < 2) {
        setTimeout(() => this.restartRecording(attempt + 1), 2000);
      } else {
        this.onError('Recording could not recover - please restart');
        this.stopTranscription();
      }
    }
  }
  
  /**
   * Track health monitoring - polls track state to detect device disconnects
   */
  private setupTrackMonitoring(): void {
    if (!this.audioStream) return;
    
    // stream.oninactive for immediate detection
    (this.audioStream as any).oninactive = () => {
      this.logEvent('chromium_mic.stream_inactive');
      if (this.isActive && !this.recoveryInProgress) {
        this.handleStreamEnded();
      }
    };
    
    // Poll every 2 seconds
    this.trackHealthInterval = setInterval(() => {
      if (!this.isActive || this.recoveryInProgress) return;
      
      const tracks = this.audioStream?.getAudioTracks() || [];
      const unhealthy = tracks.some(t => t.readyState === 'ended' || !t.enabled) || tracks.length === 0;
      
      if (unhealthy) {
        this.logEvent('chromium_mic.track_health_failed');
        this.handleStreamEnded();
      }
    }, 2000);
  }
  
  private stopTrackMonitoring(): void {
    if (this.trackHealthInterval) {
      clearInterval(this.trackHealthInterval);
      this.trackHealthInterval = null;
    }
  }
  
  /**
   * Wake Lock management
   */
  private async acquireWakeLock(): Promise<void> {
    if (!('wakeLock' in navigator)) return;
    
    try {
      this.wakeLockSentinel = await navigator.wakeLock.request('screen');
      this.wakeLockSentinel.addEventListener('release', () => {
        this.logEvent('chromium_mic.wakelock_released');
        this.wakeLockSentinel = null;
      });
      this.logEvent('chromium_mic.wakelock_acquired');
    } catch (err) {
      this.logEvent('chromium_mic.wakelock_failed', { error: String(err) });
    }
  }
  
  private async releaseWakeLock(): Promise<void> {
    if (this.wakeLockSentinel) {
      try { await this.wakeLockSentinel.release(); } catch {}
      this.wakeLockSentinel = null;
    }
  }
  
  /**
   * Visibility handler - checks track health when tab becomes visible
   */
  private setupVisibilityHandler(): void {
    this.visibilityHandler = () => {
      if (document.visibilityState === 'visible' && this.isActive) {
        this.logEvent('chromium_mic.tab_visible');
        
        // Check track health
        const tracks = this.audioStream?.getAudioTracks() || [];
        const unhealthy = tracks.some(t => t.readyState === 'ended' || !t.enabled) || tracks.length === 0;
        
        if (unhealthy && !this.recoveryInProgress) {
          this.logEvent('chromium_mic.tab_visible_recovery');
          this.restartRecording(0);
        } else {
          // Re-acquire Wake Lock
          this.acquireWakeLock();
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

  private async flushQueueWithTimeout(): Promise<void> {
    const flushTimeout = 2000; // 2 second timeout
    const startTime = Date.now();

    while (this.uploadQueue.length > 0 && (Date.now() - startTime) < flushTimeout) {
      await this.processUploadQueue();
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (this.uploadQueue.length > 0) {
      this.logEvent('chromium_mic.flush_timeout', { 
        remainingChunks: this.uploadQueue.length 
      });
    }
  }

  private logEvent(eventType: string, data?: Record<string, any>): void {
    const logData = {
      event: eventType,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      userAgent: navigator.userAgent,
      ...data
    };

    console.log(`[ChromiumMic] ${eventType}:`, logData);
    
    // In production, this could be sent to a logging service
    // For now, we'll store in sessionStorage for debugging
    try {
      const existingLogs = JSON.parse(sessionStorage.getItem('chromium_mic_logs') || '[]');
      existingLogs.push(logData);
      
      // Keep only last 100 entries
      if (existingLogs.length > 100) {
        existingLogs.splice(0, existingLogs.length - 100);
      }
      
      sessionStorage.setItem('chromium_mic_logs', JSON.stringify(existingLogs));
    } catch (error) {
      console.warn('Failed to store log entry:', error);
    }
  }

  // Utility method to export logs for support
  static exportLogs(): string {
    try {
      const logs = sessionStorage.getItem('chromium_mic_logs') || '[]';
      return logs;
    } catch (error) {
      console.error('Failed to export logs:', error);
      return '[]';
    }
  }

  // Clear logs
  static clearLogs(): void {
    try {
      sessionStorage.removeItem('chromium_mic_logs');
    } catch (error) {
      console.warn('Failed to clear logs:', error);
    }
  }
}
