import { supabase } from "@/integrations/supabase/client";
import { hasAudioActivity, getOptimalChunkInterval, OPTIMAL_CHUNK_DURATION } from './audioLevelDetection';
import { meetsConfidenceThreshold, withDefaultThresholds, type MeetingSettingsWithThresholds } from './confidenceGating';
import { isLikelyHallucination, isRepetitiveContent } from './whisperHallucinationPatterns';
import { iPhoneChunkManager, type ProcessableChunk } from './iPhoneChunkManager';
import { iOSAudioKeepAlive } from './iOSAudioKeepAlive';

export interface TranscriptData {
  text: string;
  is_final: boolean;
  confidence: number;
  speaker: string;
}

// Feature flag for new chunking strategy
const USE_NEW_IPHONE_CHUNKING = true;

export class iPhoneWhisperTranscriber {
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private isRecording = false;
  private audioChunks: Blob[] = [];
  private fullRecordingChunks: Blob[] = [];
  private transcriptionInterval: NodeJS.Timeout | null = null;
  private chunkTimeout: ReturnType<typeof setTimeout> | null = null;
  private recordingStartTime = 0;
  private lastIntervalMs = 0;
  private meetingId: string | null = null;
  private sessionId: string | null = null;
  private chunkCounter = 0;
  private totalWordCount = 0;
  private meetingSettings: MeetingSettingsWithThresholds;
  private lastSegmentEndTime = 0;
  private totalProcessedDuration = 0;
  private finalTranscript = '';
  private lastProcessedChunkIndex = 0;
  private backupChunkCounter = 0;
  private headerChunk: Blob | null = null;

  // Audio activity monitoring
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private activityCheckInterval: NodeJS.Timeout | null = null;
  
  // VAD-based silence detection
  private silenceTimer: NodeJS.Timeout | null = null;
  private lastSpeechTime = 0;
  private isSpeaking = false;
  private chunkStartTime = 0;
  private readonly SILENCE_THRESHOLD = 0.015;
  private readonly SILENCE_DURATION_MS = 1500;
  private readonly MIN_CHUNK_DURATION_MS = 2000;

  private selectedMimeType: string = 'audio/webm';

  // Auto-recovery for iOS background throttling
  private lastSuccessfulTranscriptionTime = 0;
  private autoRecoveryAttempts = 0;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private readonly AUTO_RECOVERY_THRESHOLD_MS = 75000; // 75 seconds - allows 3 chunk cycles + API latency
  private readonly MAX_AUTO_RECOVERY_ATTEMPTS = 5; // Increased attempts
  private onRecoveryAttempt?: () => void;

  // NEW: Watchdog hooks (MeetingRecorder uses these to avoid false stall alarms)
  private onChunkProcessed?: () => void;
  private onChunkFiltered?: () => void;

  // NEW: Chunk manager for sliding window approach
  private chunkManager: iPhoneChunkManager | null = null;
  
  // NEW: Web Worker for reliable timing
  private timerWorker: Worker | null = null;
  private workerSupported = false;
  
  // NEW: Visibility change handling
  private visibilityHandler: (() => void) | null = null;
  
  // NEW: Retry queue for failed API calls
  private retryQueue: { chunk: ProcessableChunk; attempts: number }[] = [];
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private isProcessing = false;
  
  // NEW: Track consecutive failures for backoff
  private consecutiveFailures = 0;
  private lastApiCallTime = 0;
  
  // NEW: Pending tick flag - prevents missed chunks when processing
  private pendingTick = false;
  
  // NEW: Worker blob URL - don't revoke until worker is destroyed
  private workerBlobUrl: string | null = null;
  
  // NEW: Worker heartbeat tracking
  private lastWorkerTick = 0;
  private workerWatchdogInterval: NodeJS.Timeout | null = null;
  
  // NEW: Backup timer interval
  private backupTimerInterval: NodeJS.Timeout | null = null;
  
  // NEW: Track last ondataavailable time for accurate duration estimation
  private lastDataAvailableTime = 0;
  
  // NEW: Force requestData interval for iOS Safari
  private requestDataInterval: NodeJS.Timeout | null = null;

  constructor(
    private onTranscription: (data: TranscriptData) => void,
    private onError: (error: string) => void,
    private onStatusChange: (status: string) => void,
    meetingSettings?: any,
    meetingId?: string,
    private onAudioActivity?: (hasActivity: boolean) => void,
    private selectedDeviceId?: string | null,
    onChunkProcessed?: () => void,
    onChunkFiltered?: () => void,
    onRecoveryAttempt?: () => void
  ) {
    this.meetingSettings = withDefaultThresholds(meetingSettings);
    this.onChunkProcessed = onChunkProcessed;
    this.onChunkFiltered = onChunkFiltered;
    this.onRecoveryAttempt = onRecoveryAttempt;
    if (meetingId) {
      this.meetingId = meetingId;
      this.sessionId = meetingId;
    }
    
    // Initialize chunk manager if using new strategy
    if (USE_NEW_IPHONE_CHUNKING) {
      this.chunkManager = new iPhoneChunkManager({
        maxBufferDurationMs: 120000,   // 120s buffer max (to accommodate 90s chunks)
        targetChunkDurationMs: 90000,  // 90s chunks (Option A configuration)
        overlapDurationMs: 3000,       // 3s overlap
        minChunkDurationMs: 10000      // Minimum 10s before processing
      });
    }
    
    // Check for Web Worker support
    this.workerSupported = typeof Worker !== 'undefined';
  }

  public setRecoveryCallback(callback: () => void) {
    this.onRecoveryAttempt = callback;
  }

  /**
   * Initialize Web Worker for reliable background timing
   */
  private initializeWorker(): void {
    if (!this.workerSupported) {
      console.log('📱 iPhone: Web Workers not supported, using main thread timers');
      return;
    }

    try {
      // Create worker from inline code to avoid separate file issues
      const workerCode = `
        let intervalId = null;
        let tickCount = 0;
        
        self.onmessage = (event) => {
          const { type, intervalMs } = event.data;
          
          switch (type) {
            case 'start':
              if (intervalId) clearInterval(intervalId);
              tickCount = 0;
              const interval = intervalMs || 15000;
              intervalId = setInterval(() => {
                tickCount++;
                self.postMessage({ type: 'tick', timestamp: Date.now(), tickCount });
              }, interval);
              self.postMessage({ type: 'tick', timestamp: Date.now(), tickCount: 0, isInitial: true });
              break;
            case 'stop':
              if (intervalId) { clearInterval(intervalId); intervalId = null; }
              tickCount = 0;
              break;
            case 'forceProcess':
              self.postMessage({ type: 'tick', timestamp: Date.now(), tickCount: ++tickCount, isForced: true });
              break;
          }
        };
        self.postMessage({ type: 'ready' });
      `;
      
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(blob);
      this.timerWorker = new Worker(workerUrl);
      
      this.timerWorker.onmessage = async (event) => {
        const { type, isForced } = event.data;
        
        if (type === 'tick' && this.isRecording) {
          this.lastWorkerTick = Date.now(); // Update heartbeat
          if (this.isProcessing) {
            // Don't skip the tick - queue it for later processing
            console.log('⏰ Worker tick - queuing (processing in progress)');
            this.pendingTick = true;
          } else {
            console.log(`⏰ Worker tick (forced: ${isForced || false})`);
            await this.processChunkFromManager();
          }
        }
      };
      
      this.timerWorker.onerror = (error) => {
        console.error('📱 iPhone: Worker error:', error);
        this.workerSupported = false;
        this.timerWorker = null;
      };
      
      console.log('📱 iPhone: Web Worker initialized for reliable timing');
      
      // Store blob URL - DON'T revoke here! iOS Safari kills worker if URL is revoked
      this.workerBlobUrl = workerUrl;
      
    } catch (error) {
      console.warn('📱 iPhone: Failed to create Web Worker:', error);
      this.workerSupported = false;
    }
  }

  /**
   * Set up visibility change handler for background recovery
   */
  private setupVisibilityHandler(): void {
    this.visibilityHandler = async () => {
      if (document.visibilityState === 'visible' && this.isRecording) {
        console.log('👁️ iPhone: Visibility restored, processing any pending audio...');
        
        // Resume AudioContext if suspended
        await iOSAudioKeepAlive.forceResume();
        
        // Force immediate processing when page becomes visible
        if (this.chunkManager && USE_NEW_IPHONE_CHUNKING) {
          const stats = this.chunkManager.getStats();
          if (stats.bufferDurationMs > 0) {
            console.log(`👁️ iPhone: Found ${(stats.bufferDurationMs / 1000).toFixed(1)}s of unprocessed audio`);
            this.onStatusChange('Catching up on audio...');
            await this.processChunkFromManager();
          }
        } else {
          await this.processPendingChunks();
        }
        
        // Trigger worker to process if available
        if (this.timerWorker) {
          this.timerWorker.postMessage({ type: 'forceProcess' });
        }
      }
    };
    
    document.addEventListener('visibilitychange', this.visibilityHandler);
    console.log('👁️ iPhone: Visibility handler registered');
  }

  private startHealthMonitoring() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.lastSuccessfulTranscriptionTime = Date.now();
    this.autoRecoveryAttempts = 0;

    // Check every 10 seconds (reduced from 15)
    this.healthCheckInterval = setInterval(async () => {
      if (!this.isRecording) {
        this.stopHealthMonitoring();
        return;
      }

      const timeSinceLastTranscription = Date.now() - this.lastSuccessfulTranscriptionTime;
      
      if (timeSinceLastTranscription > this.AUTO_RECOVERY_THRESHOLD_MS) {
        console.warn(`⚠️ iPhone: No transcription for ${Math.round(timeSinceLastTranscription / 1000)}s - attempting recovery`);
        await this.attemptAutoRecovery();
      }
    }, 10000);

    console.log('🏥 iPhone: Health monitoring started (10s interval, 75s threshold)');
  }

  private stopHealthMonitoring() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    console.log('🏥 iPhone: Health monitoring stopped');
  }

  private async attemptAutoRecovery() {
    if (this.autoRecoveryAttempts >= this.MAX_AUTO_RECOVERY_ATTEMPTS) {
      console.error('❌ iPhone: Max auto-recovery attempts reached');
      this.onError('Transcription stalled - tap to retry');
      return;
    }

    this.autoRecoveryAttempts++;
    console.log(`🔄 iPhone: Auto-recovery attempt ${this.autoRecoveryAttempts}/${this.MAX_AUTO_RECOVERY_ATTEMPTS}`);
    this.onStatusChange(`Recovering (${this.autoRecoveryAttempts}/${this.MAX_AUTO_RECOVERY_ATTEMPTS})...`);

    this.onRecoveryAttempt?.();

    try {
      // Resume AudioContext if suspended
      await iOSAudioKeepAlive.forceResume();
      
      // Force process any pending audio
      if (USE_NEW_IPHONE_CHUNKING && this.chunkManager) {
        await this.processChunkFromManager();
      } else if (this.fullRecordingChunks.length > this.lastProcessedChunkIndex) {
        await this.processNewAudioChunks();
      }
      
      this.onStatusChange('Recording...');
    } catch (error) {
      console.error('❌ iPhone: Auto-recovery failed:', error);
    }
  }

  public async processPendingChunks(): Promise<number> {
    if (USE_NEW_IPHONE_CHUNKING && this.chunkManager) {
      const stats = this.chunkManager.getStats();
      if (stats.bufferDurationMs > 0) {
        await this.processChunkFromManager();
        return 1;
      }
      return 0;
    }
    
    const pendingCount = this.fullRecordingChunks.length - this.lastProcessedChunkIndex;
    
    if (pendingCount <= 0) {
      console.log('📱 iPhone: No pending chunks to process');
      return 0;
    }

    console.log(`📱 iPhone: Processing ${pendingCount} pending chunks`);
    this.onStatusChange(`Processing ${pendingCount} pending chunks...`);

    try {
      await this.processNewAudioChunks();
      this.onStatusChange('Recording...');
      return pendingCount;
    } catch (error) {
      console.error('❌ iPhone: Failed to process pending chunks:', error);
      this.onError('Failed to catch up - some audio may be lost');
      return 0;
    }
  }

  private markSuccessfulTranscription() {
    this.lastSuccessfulTranscriptionTime = Date.now();
    this.autoRecoveryAttempts = 0;
    this.consecutiveFailures = 0;
  }

  public setMeetingId(id: string) {
    this.meetingId = id;
    this.sessionId = this.sessionId || id;
    console.log('📎 iPhoneTranscriber linked to meeting/session:', id);
  }

  public setSessionId(id: string) {
    this.sessionId = id;
    console.log('📎 iPhoneTranscriber session set:', id);
  }
  
  private startActivityMonitoring() {
    if (!this.analyser) return;
    
    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    this.activityCheckInterval = setInterval(() => {
      if (!this.analyser || !this.isRecording) return;
      
      this.analyser.getByteTimeDomainData(dataArray);
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        const normalized = (dataArray[i] - 128) / 128;
        sum += normalized * normalized;
      }
      const rms = Math.sqrt(sum / bufferLength);
      
      const wasSpeaking = this.isSpeaking;
      this.isSpeaking = rms > this.SILENCE_THRESHOLD;
      
      if (this.isSpeaking) {
        this.lastSpeechTime = Date.now();
        if (this.silenceTimer) {
          clearTimeout(this.silenceTimer);
          this.silenceTimer = null;
        }
      } else if (wasSpeaking && !this.isSpeaking) {
        this.scheduleSilenceFlush();
      }
      
      if (this.onAudioActivity) {
        this.onAudioActivity(this.isSpeaking);
      }
    }, 100);
  }
  
  private scheduleSilenceFlush() {
    if (this.silenceTimer) return;
    
    this.silenceTimer = setTimeout(async () => {
      const timeSinceLastSpeech = Date.now() - this.lastSpeechTime;
      const chunkDuration = Date.now() - this.chunkStartTime;
      
      if (timeSinceLastSpeech >= this.SILENCE_DURATION_MS && 
          chunkDuration >= this.MIN_CHUNK_DURATION_MS &&
          this.isRecording) {
        console.log(`🔇 iPhone: Silence detected - processing early`);
        await this.flushCurrentChunk();
      }
      
      this.silenceTimer = null;
    }, this.SILENCE_DURATION_MS);
  }
  
  private async flushCurrentChunk() {
    if (this.chunkTimeout) {
      clearTimeout(this.chunkTimeout);
      this.chunkTimeout = null;
    }
    
    if (USE_NEW_IPHONE_CHUNKING && this.chunkManager && this.isRecording) {
      if (this.chunkManager.hasEnoughForChunk()) {
        await this.processChunkFromManager();
        this.chunkStartTime = Date.now();
        this.lastSpeechTime = Date.now();
      }
    } else if (this.fullRecordingChunks.length > this.lastProcessedChunkIndex && this.isRecording) {
      console.log(`📤 iPhone: Early flush (${this.fullRecordingChunks.length - this.lastProcessedChunkIndex} chunks)`);
      await this.processNewAudioChunks();
      this.chunkStartTime = Date.now();
      this.lastSpeechTime = Date.now();
      this.scheduleNextProcessing();
    }
  }
  
  private scheduleNextProcessing() {
    if (!this.isRecording) return;
    
    // Only use main thread timer as fallback if worker not available
    if (!this.timerWorker) {
      this.chunkTimeout = setTimeout(async () => {
        if (this.isRecording) {
          if (USE_NEW_IPHONE_CHUNKING && this.chunkManager) {
            await this.processChunkFromManager();
          } else if (this.fullRecordingChunks.length > this.lastProcessedChunkIndex) {
            await this.processNewAudioChunks();
          }
          this.chunkStartTime = Date.now();
          this.lastSpeechTime = Date.now();
          this.scheduleNextProcessing();
        }
      }, 30000); // Fallback: 30 second interval
    }
  }
  
  private stopActivityMonitoring() {
    if (this.activityCheckInterval) {
      clearInterval(this.activityCheckInterval);
      this.activityCheckInterval = null;
    }
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }

  
  async startTranscription() {
    try {
      this.onStatusChange('Starting iPhone transcription...');
      console.log('📱 Starting iPhone Whisper transcription (new chunking: ' + USE_NEW_IPHONE_CHUNKING + ')');

      // Initialize session/meeting IDs
      try {
        if (!this.sessionId) {
          const existing = sessionStorage.getItem('currentSessionId');
          this.sessionId = existing || crypto.randomUUID();
          sessionStorage.setItem('currentSessionId', this.sessionId);
        }
        if (!this.meetingId) this.meetingId = this.sessionId;
        console.log('🔗 iPhone session initialized', { sessionId: this.sessionId, meetingId: this.meetingId });
      } catch (e) {
        console.warn('Could not initialize session/meeting id', e);
      }

      // Request microphone with iPhone-optimized settings
      const audioConstraints: MediaTrackConstraints = {
        sampleRate: 16000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: false,
      };
      
      if (this.selectedDeviceId) {
        audioConstraints.deviceId = { exact: this.selectedDeviceId };
        console.log('🎤 Using selected microphone device:', this.selectedDeviceId);
      }
      
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints
      });
      
      // Set up audio context for VAD
      this.audioContext = new AudioContext({ sampleRate: 16000 });
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      
      const source = this.audioContext.createMediaStreamSource(this.stream);
      source.connect(this.analyser);
      
      // Start audio keep-alive to prevent context suspension
      await iOSAudioKeepAlive.start(this.audioContext);
      
      // Start VAD monitoring
      this.startActivityMonitoring();

      // Check supported MIME types
      const mimeTypes = [
        'audio/mp4;codecs=mp4a.40.2',
        'audio/mp4',
        'audio/aac',
        'audio/webm;codecs=opus',
        'audio/webm'
      ];

      this.selectedMimeType = 'audio/webm';
      for (const mimeType of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          this.selectedMimeType = mimeType;
          console.log('📱 Using MIME type:', mimeType);
          break;
        }
      }

      // Initialize chunk manager with selected MIME type
      if (USE_NEW_IPHONE_CHUNKING && this.chunkManager) {
        this.chunkManager.initialize(this.selectedMimeType);
      }

      // Create MediaRecorder with lower bitrate for smaller files
      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: this.selectedMimeType,
        audioBitsPerSecond: 64000  // 64kbps - plenty for speech, faster uploads
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          const now = Date.now();
          
          // Calculate REAL duration since last ondataavailable (not hardcoded 5000ms)
          let estimatedDurationMs = 5000; // default fallback
          if (this.lastDataAvailableTime > 0) {
            estimatedDurationMs = Math.min(Math.max(now - this.lastDataAvailableTime, 1000), 30000);
          }
          this.lastDataAvailableTime = now;
          
          if (!this.headerChunk) {
            this.headerChunk = event.data;
            console.log(`📦 iPhone: Captured M4A header (${event.data.size} bytes)`);
          }
          
          console.log(`📦 iPhone ondataavailable: ${event.data.size} bytes, estimated ${(estimatedDurationMs / 1000).toFixed(1)}s since last`);
          
          // Add to chunk manager if using new strategy - with REAL duration
          if (USE_NEW_IPHONE_CHUNKING && this.chunkManager) {
            this.chunkManager.addChunk(event.data, estimatedDurationMs);
          }
          
          // Also maintain legacy arrays for fallback
          this.audioChunks.push(event.data);
          this.fullRecordingChunks.push(event.data);
        }
      };

      this.mediaRecorder.onerror = (event) => {
        console.error('📱 MediaRecorder error:', event);
        this.onError('Recording error occurred');
      };

      console.log('✅ Created iPhone MediaRecorder with MIME type:', this.selectedMimeType);

      // Wait for stream to initialize
      await new Promise(resolve => setTimeout(resolve, 200));

      // Set up visibility handler for background recovery
      this.setupVisibilityHandler();

      // Initialize and start Web Worker for reliable timing
      this.initializeWorker();
      if (this.timerWorker) {
        this.timerWorker.postMessage({ type: 'start', intervalMs: 90000 }); // 90s interval (Option A)
        this.lastWorkerTick = Date.now(); // Initialize heartbeat
      }

      // Start recording
      this.isRecording = true;
      this.startChunkedRecording();
      
      // Start health monitoring
      this.startHealthMonitoring();
      
      // Start worker watchdog - detects if worker dies
      this.startWorkerWatchdog();
      
      // Start backup timer - safety net in case worker fails
      this.startBackupTimer();
      
      this.onStatusChange('Recording...');
      console.log('✅ iPhone transcription started');

    } catch (error: any) {
      console.error('❌ Failed to start iPhone transcription:', error);
      this.onError(`Failed to start recording: ${error.message}`);
    }
  }

  private startChunkedRecording() {
    if (!this.isRecording || !this.mediaRecorder) return;

    this.recordingStartTime = Date.now();
    this.chunkStartTime = Date.now();
    this.lastSpeechTime = Date.now();
    this.lastDataAvailableTime = Date.now(); // Initialize for accurate duration tracking
    
    // Use 5s timeslice for regular ondataavailable events
    this.mediaRecorder.start(5000);
    
    console.log('📱 iPhone MediaRecorder started with 5s timeslice');
    
    // iOS Safari fallback: force requestData() if ondataavailable is infrequent
    this.startRequestDataFallback();

    // First transcription after 12 seconds for quick feedback
    const FIRST_PROCESS_INTERVAL = 12000;
    
    this.chunkTimeout = setTimeout(async () => {
      if (this.isRecording) {
        console.log('📤 Processing FIRST audio chunk...');
        if (USE_NEW_IPHONE_CHUNKING && this.chunkManager) {
          await this.processChunkFromManager();
        } else if (this.fullRecordingChunks.length > this.lastProcessedChunkIndex) {
          await this.processNewAudioChunks();
        }
        this.chunkStartTime = Date.now();
        this.lastSpeechTime = Date.now();
        console.log('✅ First chunk processed, VAD or worker will trigger subsequent');
        
        // Schedule backup processing if worker not available
        if (!this.timerWorker) {
          this.scheduleNextProcessing();
        }
      }
    }, FIRST_PROCESS_INTERVAL);
  }

  /**
   * NEW: Process chunk using the chunk manager (sliding window approach)
   */
  private async processChunkFromManager(): Promise<void> {
    if (!this.chunkManager || this.isProcessing) {
      console.log('📱 iPhone: Skipping process - manager null or already processing');
      return;
    }
    
    this.isProcessing = true;
    
    try {
      // NOTE: Removed blocking backoff logic - it was causing processing to stall completely
      // Instead, we only apply a small delay between RETRY attempts (handled in chunk manager)
      // Fresh chunks always process immediately regardless of previous failures
      if (this.consecutiveFailures > 0) {
        console.log(`📱 iPhone: Processing despite ${this.consecutiveFailures} consecutive failures (not blocking)`);
      }
      
      const chunk = this.chunkManager.getChunkForProcessing();
      if (!chunk) {
        this.isProcessing = false;
        return;
      }
      
      console.log(`📤 iPhone: Processing chunk #${chunk.chunkIndex} (${(chunk.blob.size / 1024).toFixed(1)}KB)`);
      this.lastApiCallTime = Date.now();
      
      const success = await this.sendChunkToWhisper(chunk);
      
      if (success) {
        this.chunkManager.markChunkProcessed();
        this.markSuccessfulTranscription();
        
        // Upload backup periodically
        if (this.chunkCounter % 3 === 0) {
          await this.uploadBackup(chunk.blob);
        }
      } else {
        this.chunkManager.markChunkFailed();
        this.consecutiveFailures++;
        console.warn(`⚠️ iPhone: Chunk failed, consecutive failures: ${this.consecutiveFailures}`);
      }
      
    } catch (error) {
      console.error('❌ iPhone: processChunkFromManager error:', error);
      this.consecutiveFailures++;
    } finally {
      this.isProcessing = false;
      
      // Process any pending tick that arrived while we were busy
      if (this.pendingTick && this.isRecording) {
        this.pendingTick = false;
        console.log('⏰ Processing queued tick...');
        setTimeout(() => this.processChunkFromManager(), 100);
      }
    }
  }
  
  /**
   * Calculate exponential backoff delay based on consecutive failures
   */
  private calculateBackoff(): number {
    if (this.consecutiveFailures === 0) return 0;
    // Backoff: 2s, 4s, 8s, max 16s
    return Math.min(2000 * Math.pow(2, this.consecutiveFailures - 1), 16000);
  }
  
  // Hard timeout for API calls - prevents hung requests from blocking processing
  private readonly API_TIMEOUT_MS = 30000; // 30 seconds max per request

  /**
   * Send a chunk to the Whisper API and process the result
   * Now includes a hard timeout to prevent hung requests
   */
  private async sendChunkToWhisper(chunk: ProcessableChunk): Promise<boolean> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      console.warn('⏱️ iPhone: Whisper API request timed out after 30s');
    }, this.API_TIMEOUT_MS);

    try {
      // Convert to base64
      const arrayBuffer = await chunk.blob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      let binary = '';
      const chunkSize = 4096;
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const segment = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
        for (let j = 0; j < segment.length; j++) {
          binary += String.fromCharCode(segment[j]);
        }
      }
      const base64Audio = btoa(binary);

      console.log('📡 Sending chunk to Whisper API...');

      // Use Promise.race to enforce timeout on the entire operation
      const apiPromise = supabase.functions.invoke('speech-to-text', {
        body: {
          audio: base64Audio,
          mimeType: chunk.blob.type,
          fileName: 'iphone-audio.m4a',
          language: 'en',
          temperature: 0,
          condition_on_previous_text: false
        }
      });

      const timeoutPromise = new Promise<never>((_, reject) => {
        controller.signal.addEventListener('abort', () => {
          reject(new Error('API_TIMEOUT'));
        });
      });

      const { data, error } = await Promise.race([apiPromise, timeoutPromise]);
      clearTimeout(timeoutId);

      if (error || !data?.text) {
        console.error('❌ Whisper API error:', error);
        return false;
      }

      const fullTranscribedText = data.text.trim();
      
      // Check for hallucination
      if (this.isHallucination(fullTranscribedText)) {
        console.warn('⚠️ Hallucination detected, skipping');
        this.onChunkFiltered?.();
        return true; // Mark as processed (don't retry hallucinations)
      }
      
      // Extract only NEW text
      const newText = this.extractNewText(fullTranscribedText, this.finalTranscript);
      
      if (newText) {
        console.log(`📝 NEW text (${newText.split(/\s+/).length} words): "${newText.substring(0, 80)}..."`);
        
        this.finalTranscript = fullTranscribedText;
        
        const transcriptData: TranscriptData = {
          text: newText,
          is_final: true,
          confidence: data.confidence || 0.9,
          speaker: 'Speaker'
        };
        
        // This will also reset the watchdog via MeetingRecorder's handleBrowserTranscript
        this.onChunkProcessed?.();
        this.onTranscription(transcriptData);
        
        // Update word count
        const newWordCount = newText.split(/\s+/).filter(Boolean).length;
        this.totalWordCount += newWordCount;
        console.log(`📊 Word count: +${newWordCount} (total: ${this.totalWordCount})`);
        
        // Store in database
        await this.storeTranscriptionChunk(newText, data.confidence || 0.9);
      } else {
        console.log('ℹ️ No new text in this chunk');
        this.onChunkFiltered?.();
      }
      
      return true;
      
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.message === 'API_TIMEOUT') {
        console.error('❌ iPhone: API request timed out - will retry with next chunk');
      } else {
        console.error('❌ sendChunkToWhisper error:', error);
      }
      return false;
    }
  }
  
  /**
   * Store transcription chunk in database
   */
  private async storeTranscriptionChunk(text: string, confidence: number): Promise<void> {
    try {
      this.chunkCounter++;
      const user = (await supabase.auth.getUser()).data.user?.id;
      
      if (this.meetingId && this.sessionId && user) {
        const segments = [{
          start: this.lastSegmentEndTime,
          end: this.lastSegmentEndTime + 25, // Approximate
          text
        }];
        
        const { error } = await supabase
          .from('meeting_transcription_chunks')
          .insert({
            meeting_id: this.meetingId,
            session_id: this.sessionId,
            chunk_number: this.chunkCounter,
            transcription_text: JSON.stringify(segments),
            confidence,
            is_final: true,
            user_id: user,
            merge_rejection_reason: null
          });
        
        if (error) {
          console.warn('⚠️ Failed to store chunk:', error);
        } else {
          this.lastSegmentEndTime += 25;
          console.log(`💾 Stored chunk #${this.chunkCounter}`);
        }
      }
    } catch (e) {
      console.warn('⚠️ Error storing chunk:', e);
    }
  }
  
  /**
   * Upload backup audio to storage
   */
  private async uploadBackup(blob: Blob): Promise<void> {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId || !this.meetingId) return;
    
    this.backupChunkCounter++;
    const ext = this.selectedMimeType.includes('mp4') ? 'm4a' : 'webm';
    const fileName = `${userId}/${this.meetingId}_chunk_${String(this.backupChunkCounter).padStart(3, '0')}.${ext}`;
    
    const { error } = await supabase.storage
      .from('meeting-audio-backups')
      .upload(fileName, blob, { contentType: this.selectedMimeType });
    
    if (!error) {
      console.log(`📤 Uploaded backup #${this.backupChunkCounter}`);
    }
  }

  // Legacy method for fallback
  private async processNewAudioChunks() {
    const newChunks = this.fullRecordingChunks.slice(this.lastProcessedChunkIndex);
    if (newChunks.length === 0) return;

    try {
      const allChunks = this.fullRecordingChunks;
      const chunksToProcess = this.headerChunk 
        ? [this.headerChunk, ...allChunks.filter(c => c !== this.headerChunk)]
        : allChunks;
      
      const audioBlob = new Blob(chunksToProcess, { 
        type: this.selectedMimeType || 'audio/mp4' 
      });
      
      console.log(`📏 Full audio blob: ${audioBlob.size} bytes from ${allChunks.length} chunks`);

      const arrayBuffer = await audioBlob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      let binary = '';
      const chunkSize = 4096;
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
        let segment = '';
        for (let j = 0; j < chunk.length; j++) {
          segment += String.fromCharCode(chunk[j]);
        }
        binary += segment;
      }
      const base64Audio = btoa(binary);

      const { data, error } = await supabase.functions.invoke('speech-to-text', {
        body: {
          audio: base64Audio,
          mimeType: audioBlob.type,
          fileName: 'iphone-audio.m4a',
          language: 'en',
          temperature: 0,
          condition_on_previous_text: false
        }
      });

      if (error || !data.text) {
        console.error('❌ Whisper API error:', error);
        this.onError('Transcription failed');
        return;
      }

      const fullTranscribedText = data.text.trim();
      
      if (this.isHallucination(fullTranscribedText)) {
        console.warn('⚠️ Hallucination detected, skipping');
        this.lastProcessedChunkIndex = this.fullRecordingChunks.length;
        return;
      }
      
      const newText = this.extractNewText(fullTranscribedText, this.finalTranscript);
      
      if (newText) {
        this.finalTranscript = fullTranscribedText;
        
        const transcriptData: TranscriptData = {
          text: newText,
          is_final: true,
          confidence: data.confidence || 0.9,
          speaker: 'Speaker'
        };
        
        this.onTranscription(transcriptData);
        this.markSuccessfulTranscription();
        
        const newWordCount = newText.split(/\s+/).filter(Boolean).length;
        this.totalWordCount += newWordCount;
        
        await this.storeTranscriptionChunk(newText, data.confidence || 0.9);
      }
      
      this.lastProcessedChunkIndex = this.fullRecordingChunks.length;
      
      if (this.fullRecordingChunks.length > 0 && this.chunkCounter % 3 === 0) {
        await this.uploadAndClearProcessedChunks([...this.fullRecordingChunks]);
      }
      
    } catch (error) {
      console.error('❌ processNewAudioChunks error:', error);
      this.onError('Failed to process audio');
    }
  }
  
  private extractNewText(fullText: string, previousText: string): string {
    if (!previousText) return fullText;
    if (!fullText) return '';
    
    const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
    
    const fullNorm = normalise(fullText);
    const prevNorm = normalise(previousText);
    
    if (fullNorm.startsWith(prevNorm)) {
      const prevWords = previousText.split(/\s+/).filter(Boolean);
      const fullWords = fullText.split(/\s+/).filter(Boolean);
      
      let matchEnd = 0;
      for (let i = 0; i < Math.min(prevWords.length, fullWords.length); i++) {
        if (normalise(prevWords[i]) === normalise(fullWords[i])) {
          matchEnd = i + 1;
        } else {
          break;
        }
      }
      
      if (matchEnd > 0 && matchEnd < fullWords.length) {
        return fullWords.slice(matchEnd).join(' ');
      }
    }
    
    const prevWords = previousText.split(/\s+/).filter(Boolean);
    const fullWords = fullText.split(/\s+/).filter(Boolean);
    
    for (let overlapLen = Math.min(prevWords.length, 20); overlapLen >= 3; overlapLen--) {
      const suffix = prevWords.slice(-overlapLen).map(w => normalise(w)).join(' ');
      
      for (let i = 0; i <= fullWords.length - overlapLen; i++) {
        const segment = fullWords.slice(i, i + overlapLen).map(w => normalise(w)).join(' ');
        if (segment === suffix) {
          const newContent = fullWords.slice(i + overlapLen).join(' ');
          if (newContent) {
            console.log(`🔍 Found overlap at word ${i + overlapLen}, extracting ${fullWords.length - i - overlapLen} new words`);
            return newContent;
          }
        }
      }
    }
    
    if (fullWords.length > prevWords.length + 3) {
      return fullWords.slice(prevWords.length).join(' ');
    }
    
    return '';
  }

  private isHallucination(text: string, confidence?: number): boolean {
    const result = isLikelyHallucination(text, confidence, {
      checkPhrases: true,
      checkRepetition: true,
      checkUrls: true,
      checkLaughter: true,
      confidenceThreshold: 0.15
    });
    
    if (result.isHallucination) {
      console.warn(`🚨 iPhone hallucination: ${result.reason}`);
    }
    
    return result.isHallucination;
  }

  private async uploadAndClearProcessedChunks(processedChunks: Blob[]) {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId || !this.meetingId || processedChunks.length === 0) return;
    
    this.backupChunkCounter++;
    const chunkBlob = new Blob(processedChunks, { type: this.selectedMimeType });
    const ext = this.selectedMimeType.includes('mp4') ? 'm4a' : 'webm';
    const fileName = `${userId}/${this.meetingId}_chunk_${String(this.backupChunkCounter).padStart(3, '0')}.${ext}`;
    
    const { error } = await supabase.storage
      .from('meeting-audio-backups')
      .upload(fileName, chunkBlob, { contentType: this.selectedMimeType });
    
    if (!error) {
      console.log(`📤 Uploaded backup chunk #${this.backupChunkCounter}`);
    }
  }

  /**
   * Worker heartbeat watchdog - detects if worker dies and restarts it
   */
  private startWorkerWatchdog(): void {
    this.workerWatchdogInterval = setInterval(() => {
      if (this.isRecording && this.timerWorker) {
        const timeSinceLastTick = Date.now() - this.lastWorkerTick;
        if (timeSinceLastTick > 25000) {
          console.warn(`⚠️ Worker appears dead (${Math.round(timeSinceLastTick / 1000)}s since last tick) - forcing process and reinitializing`);
          
          // Force process any pending audio
          this.processChunkFromManager();
          
          // Terminate dead worker
          this.timerWorker.terminate();
          this.timerWorker = null;
          
          // Clean up old blob URL
          if (this.workerBlobUrl) {
            URL.revokeObjectURL(this.workerBlobUrl);
            this.workerBlobUrl = null;
          }
          
          // Reinitialize worker
          this.initializeWorker();
          if (this.timerWorker) {
            this.timerWorker.postMessage({ type: 'start', intervalMs: 10000 });
            this.lastWorkerTick = Date.now();
            console.log('✅ Worker reinitialized');
          }
        }
      }
    }, 10000);
  }
  
  /**
   * Backup timer - safety net that processes audio even if worker fails
   * NEW: Now triggers based on time since last process, not just buffer size
   */
  private startBackupTimer(): void {
    this.backupTimerInterval = setInterval(() => {
      if (this.isRecording && !this.isProcessing) {
        const stats = this.chunkManager?.getStats();
        if (stats) {
          // Trigger if: enough buffer OR too long since last process
          const shouldTrigger = stats.bufferDurationMs >= 5000 || stats.timeSinceLastProcessMs > 20000;
          if (shouldTrigger) {
            console.log(`⏰ Backup timer triggered - buffer: ${Math.round(stats.bufferDurationMs / 1000)}s, time since last: ${Math.round(stats.timeSinceLastProcessMs / 1000)}s`);
            this.processChunkFromManager();
          }
        }
      }
    }, 15000); // Run every 15s instead of 20s
  }
  
  /**
   * iOS Safari fallback - force requestData() if ondataavailable is infrequent
   * Some iOS Safari versions ignore the timeslice parameter entirely
   */
  private startRequestDataFallback(): void {
    this.requestDataInterval = setInterval(() => {
      if (this.isRecording && this.mediaRecorder && this.mediaRecorder.state === 'recording') {
        const timeSinceLastData = Date.now() - this.lastDataAvailableTime;
        if (timeSinceLastData > 8000) {
          console.log(`📱 iOS fallback: Forcing requestData() (${Math.round(timeSinceLastData / 1000)}s since last ondataavailable)`);
          try {
            this.mediaRecorder.requestData();
          } catch (e) {
            console.warn('📱 requestData() failed:', e);
          }
        }
      }
    }, 5000); // Check every 5 seconds
  }

  async stopTranscription() {
    console.log('🛑 Stopping iPhone transcription...');
    
    this.isRecording = false;
    this.onStatusChange('Processing final transcript...');
    
    // Stop worker
    if (this.timerWorker) {
      this.timerWorker.postMessage({ type: 'stop' });
      this.timerWorker.terminate();
      this.timerWorker = null;
    }
    
    // Clean up worker blob URL
    if (this.workerBlobUrl) {
      URL.revokeObjectURL(this.workerBlobUrl);
      this.workerBlobUrl = null;
    }
    
    // Stop worker watchdog
    if (this.workerWatchdogInterval) {
      clearInterval(this.workerWatchdogInterval);
      this.workerWatchdogInterval = null;
    }
    
    // Stop backup timer
    if (this.backupTimerInterval) {
      clearInterval(this.backupTimerInterval);
      this.backupTimerInterval = null;
    }
    
    // Stop requestData fallback
    if (this.requestDataInterval) {
      clearInterval(this.requestDataInterval);
      this.requestDataInterval = null;
    }
    
    // Remove visibility handler
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
    
    // Stop audio keep-alive
    iOSAudioKeepAlive.stop();
    
    // Stop monitoring
    this.stopHealthMonitoring();
    this.stopActivityMonitoring();

    if (this.transcriptionInterval) {
      clearInterval(this.transcriptionInterval);
      this.transcriptionInterval = null;
    }
    if (this.chunkTimeout) {
      clearTimeout(this.chunkTimeout);
      this.chunkTimeout = null;
    }

    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      console.log('🔄 Stopping MediaRecorder...');
      // Mirror of online Patch A: the previous 3s Promise.race timeout was
      // shorter than a typical Whisper call on a 90s final chunk (which
      // takes 5-10s plus any retry), so the closing audio was lost. We now
      // allow up to 30s for the final ondataavailable + downstream chunk
      // processing to complete. Bounded so a hung API cannot freeze the UI.
      const stopPromise = new Promise<void>((resolve) => {
        const recorder = this.mediaRecorder!;
        const originalOnStop = recorder.onstop;
        recorder.onstop = (event) => {
          try {
            if (originalOnStop && typeof originalOnStop === 'function') {
              originalOnStop.call(recorder, event);
            }
          } finally {
            resolve();
          }
        };
      });

      this.mediaRecorder.stop();

      await Promise.race([
        stopPromise,
        new Promise(resolve => setTimeout(resolve, 30000))
      ]);

      // Brief settle-time for state writes triggered by the final
      // transcription callback. Reduced from 1s now the race is realistic.
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Process final chunks
      if (USE_NEW_IPHONE_CHUNKING && this.chunkManager) {
        const finalChunk = this.chunkManager.getFinalChunk();
        if (finalChunk) {
          console.log('🔄 Processing final chunk...');
          await this.sendChunkToWhisper(finalChunk);
          this.chunkManager.markChunkProcessed();
        }
      } else if (this.fullRecordingChunks.length > this.lastProcessedChunkIndex) {
        console.log('🔄 Processing final audio chunks...');
        await this.processNewAudioChunks();
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    // Reset chunk manager
    if (this.chunkManager) {
      this.chunkManager.reset();
    }

    this.mediaRecorder = null;
    this.audioChunks = [];
    this.fullRecordingChunks = [];
    this.headerChunk = null;
    this.finalTranscript = '';
    this.lastProcessedChunkIndex = 0;
    this.consecutiveFailures = 0;

    console.log(`✅ iPhone transcription stopped. ${this.backupChunkCounter} backups uploaded.`);
    this.onStatusChange('Stopped');
  }

  isActive(): boolean {
    return this.isRecording;
  }
}
