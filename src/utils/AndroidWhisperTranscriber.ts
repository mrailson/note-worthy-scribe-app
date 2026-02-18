/**
 * Android Whisper Transcriber
 * 
 * Optimised transcription for Android devices (Samsung, Pixel, etc.)
 * Based on iPhoneWhisperTranscriber but with Android-specific adjustments:
 * 
 * - Prioritises WebM/Opus format (well-supported on Android Chrome)
 * - MP4 fallback for Samsung Internet browser
 * - More aggressive health monitoring for Samsung's aggressive throttling
 * - 16kHz sample rate for mobile optimisation
 * - Audio keep-alive to prevent context suspension
 */

import { supabase } from "@/integrations/supabase/client";
import { meetsConfidenceThreshold, withDefaultThresholds, type MeetingSettingsWithThresholds } from './confidenceGating';
import { isLikelyHallucination, isRepetitiveContent } from './whisperHallucinationPatterns';
import { AndroidChunkManager, type ProcessableChunk } from './AndroidChunkManager';
import { androidAudioKeepAlive } from './androidAudioKeepAlive';

export interface TranscriptData {
  text: string;
  is_final: boolean;
  confidence: number;
  speaker: string;
}

export class AndroidWhisperTranscriber {
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private isRecording = false;
  private recordingStartTime = 0;
  private meetingId: string | null = null;
  private sessionId: string | null = null;
  private chunkCounter = 0;
  private totalWordCount = 0;
  private meetingSettings: MeetingSettingsWithThresholds;
  private finalTranscript = '';

  // Audio monitoring
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private activityCheckInterval: NodeJS.Timeout | null = null;
  
  // VAD-based silence detection
  private silenceTimer: NodeJS.Timeout | null = null;
  private lastSpeechTime = 0;
  private isSpeaking = false;
  private readonly SILENCE_THRESHOLD = 0.015;
  private readonly SILENCE_DURATION_MS = 1500;

  private selectedMimeType: string = 'audio/webm;codecs=opus';

  // Auto-recovery for Android background throttling
  private lastSuccessfulTranscriptionTime = 0;
  private autoRecoveryAttempts = 0;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private readonly AUTO_RECOVERY_THRESHOLD_MS = 75000;
  private readonly MAX_AUTO_RECOVERY_ATTEMPTS = 5;
  private onRecoveryAttempt?: () => void;

  // Watchdog hooks
  private onChunkProcessed?: () => void;
  private onChunkFiltered?: () => void;

  // Chunk manager for sliding window approach
  private chunkManager: AndroidChunkManager;
  
  // Web Worker for reliable timing
  private timerWorker: Worker | null = null;
  private workerSupported = false;
  private workerBlobUrl: string | null = null;
  private lastWorkerTick = 0;
  
  // Visibility change handling
  private visibilityHandler: (() => void) | null = null;
  
  // Processing state
  private isProcessing = false;
  private consecutiveFailures = 0;
  private pendingTick = false;
  
  // Backup timer
  private backupTimerInterval: NodeJS.Timeout | null = null;
  private chunkTimeout: ReturnType<typeof setTimeout> | null = null;
  
  // Track last ondataavailable time
  private lastDataAvailableTime = 0;

  // Track health monitoring & recovery
  private trackHealthInterval: ReturnType<typeof setInterval> | null = null;
  private interruptedByCall = false;
  private micRecoveryAttempts = 0;
  private readonly MAX_MIC_RECOVERY_ATTEMPTS = 3;
  private wakeLockSentinel: WakeLockSentinel | null = null;

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
    
    // Initialize chunk manager with Android-optimised settings (Option A: 90s chunks)
    this.chunkManager = new AndroidChunkManager({
      maxBufferDurationMs: 120000,   // 120s buffer max (to accommodate 90s chunks)
      targetChunkDurationMs: 90000,  // 90s chunks (Option A configuration)
      overlapDurationMs: 3000,       // 3s overlap
      minChunkDurationMs: 10000      // Minimum 10s
    });
    
    this.workerSupported = typeof Worker !== 'undefined';
  }

  public setRecoveryCallback(callback: () => void) {
    this.onRecoveryAttempt = callback;
  }

  /**
   * Detect Samsung Internet browser
   */
  private isSamsungBrowser(): boolean {
    return /SamsungBrowser/.test(navigator.userAgent);
  }

  /**
   * Initialize Web Worker for reliable background timing
   */
  private initializeWorker(): void {
    if (!this.workerSupported) {
      console.log('🤖 Android: Web Workers not supported, using main thread timers');
      return;
    }

    try {
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
      this.workerBlobUrl = workerUrl;
      
      this.timerWorker.onmessage = async (event) => {
        const { type, isForced } = event.data;
        
        if (type === 'tick' && this.isRecording) {
          this.lastWorkerTick = Date.now();
          if (this.isProcessing) {
            console.log('⏰ Android Worker tick - queuing (processing in progress)');
            this.pendingTick = true;
          } else {
            console.log(`⏰ Android Worker tick (forced: ${isForced || false})`);
            await this.processChunkFromManager();
          }
        }
      };
      
      this.timerWorker.onerror = (error) => {
        console.error('🤖 Android: Worker error:', error);
        this.workerSupported = false;
        this.timerWorker = null;
      };
      
      console.log('🤖 Android: Web Worker initialized for reliable timing');
      
    } catch (error) {
      console.warn('🤖 Android: Failed to create Web Worker:', error);
      this.workerSupported = false;
    }
  }

  /**
   * Set up visibility change handler for background recovery
   */
  private setupVisibilityHandler(): void {
    this.visibilityHandler = async () => {
      if (document.visibilityState === 'visible' && this.isRecording) {
        console.log('👁️ Android: Visibility restored, running full recovery checklist...');
        
        // 1. Force-resume AudioContext
        await androidAudioKeepAlive.forceResume();
        if (this.audioContext?.state === 'suspended') {
          try {
            await this.audioContext.resume();
            console.log('👁️ Android: AudioContext resumed');
          } catch (e) {
            console.warn('👁️ Android: Failed to resume AudioContext:', e);
          }
        }
        
        // 2. Check track health & recover mic if needed
        const trackRecovered = await this.checkAndRecoverTracks();
        
        // 3. Check MediaRecorder state & restart if stopped
        if (this.mediaRecorder && this.mediaRecorder.state === 'inactive') {
          console.warn('👁️ Android: MediaRecorder was stopped by OS, restarting...');
          await this.restartMediaRecorder();
        }
        
        // 4. Re-acquire Wake Lock
        await this.acquireWakeLock();
        
        // 5. Process any buffered audio chunks
        const stats = this.chunkManager.getStats();
        if (stats.bufferDurationMs > 0) {
          console.log(`👁️ Android: Found ${(stats.bufferDurationMs / 1000).toFixed(1)}s of unprocessed audio`);
          this.onStatusChange('Catching up on audio...');
          await this.processChunkFromManager();
        }
        
        // 6. Show recovery notification if was interrupted
        if (this.interruptedByCall || trackRecovered) {
          this.interruptedByCall = false;
          this.onStatusChange('Recording recovered after interruption');
          console.log('✅ Android: Recording recovered after interruption');
        }
        
        if (this.timerWorker) {
          this.timerWorker.postMessage({ type: 'forceProcess' });
        }
      }
    };
    
    document.addEventListener('visibilitychange', this.visibilityHandler);
    console.log('👁️ Android: Visibility handler registered');
  }

  /**
   * Acquire Wake Lock to prevent screen dimming
   */
  private async acquireWakeLock(): Promise<void> {
    if (!('wakeLock' in navigator)) return;
    
    try {
      // Release existing sentinel first
      if (this.wakeLockSentinel) {
        try { await this.wakeLockSentinel.release(); } catch {}
        this.wakeLockSentinel = null;
      }
      
      this.wakeLockSentinel = await navigator.wakeLock.request('screen');
      this.wakeLockSentinel.addEventListener('release', () => {
        console.log('🔓 Android Transcriber: Wake Lock released by system');
        this.wakeLockSentinel = null;
      });
      console.log('🔒 Android Transcriber: Wake Lock acquired');
    } catch (e) {
      console.warn('⚠️ Android Transcriber: Wake Lock request failed:', e);
    }
  }

  /**
   * Release Wake Lock
   */
  private async releaseWakeLock(): Promise<void> {
    if (this.wakeLockSentinel) {
      try {
        await this.wakeLockSentinel.release();
        console.log('🔓 Android Transcriber: Wake Lock released');
      } catch {}
      this.wakeLockSentinel = null;
    }
  }

  /**
   * Start monitoring MediaStream track health every 2 seconds.
   * Detects when the OS kills the mic (e.g. phone call) and triggers recovery.
   */
  private startTrackHealthMonitor(): void {
    if (this.trackHealthInterval) {
      clearInterval(this.trackHealthInterval);
    }
    
    this.micRecoveryAttempts = 0;
    
    this.trackHealthInterval = setInterval(async () => {
      if (!this.isRecording || !this.stream) return;
      
      await this.checkAndRecoverTracks();
    }, 2000);
    
    console.log('🩺 Android: Track health monitor started (2s interval)');
  }

  /**
   * Stop the track health monitor
   */
  private stopTrackHealthMonitor(): void {
    if (this.trackHealthInterval) {
      clearInterval(this.trackHealthInterval);
      this.trackHealthInterval = null;
    }
  }

  /**
   * Check track health and attempt recovery if needed.
   * Returns true if recovery was performed.
   */
  private async checkAndRecoverTracks(): Promise<boolean> {
    if (!this.stream) return false;
    
    const tracks = this.stream.getAudioTracks();
    const hasDeadTrack = tracks.length === 0 || tracks.some(t => t.readyState === 'ended' || !t.enabled);
    
    if (!hasDeadTrack) return false;
    
    console.warn('⚠️ Android: Dead audio track detected - attempting microphone recovery');
    this.onStatusChange('Microphone interrupted - recovering...');
    
    return await this.recoverMicrophone();
  }

  /**
   * Attempt to re-acquire the microphone and reconnect everything.
   */
  private async recoverMicrophone(): Promise<boolean> {
    if (this.micRecoveryAttempts >= this.MAX_MIC_RECOVERY_ATTEMPTS) {
      console.error('❌ Android: Max mic recovery attempts reached');
      this.onError('Microphone lost - tap to retry');
      return false;
    }
    
    this.micRecoveryAttempts++;
    console.log(`🔄 Android: Mic recovery attempt ${this.micRecoveryAttempts}/${this.MAX_MIC_RECOVERY_ATTEMPTS}`);
    
    try {
      // Re-acquire microphone
      const audioConstraints: MediaTrackConstraints = {
        sampleRate: 16000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      };
      
      if (this.selectedDeviceId) {
        audioConstraints.deviceId = { exact: this.selectedDeviceId };
      }
      
      const newStream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
      
      // Stop old tracks
      if (this.stream) {
        this.stream.getTracks().forEach(t => { try { t.stop(); } catch {} });
      }
      
      this.stream = newStream;
      
      // Set up inactive listener on the new stream
      this.setupStreamInactiveListener();
      
      // Reconnect AudioContext source
      if (this.audioContext && this.analyser) {
        try {
          const newSource = this.audioContext.createMediaStreamSource(newStream);
          newSource.connect(this.analyser);
        } catch (e) {
          console.warn('⚠️ Android: Failed to reconnect AudioContext source:', e);
        }
      }
      
      // Restart MediaRecorder with new stream
      await this.restartMediaRecorder();
      
      this.micRecoveryAttempts = 0;
      this.onStatusChange('Recording resumed - microphone recovered');
      console.log('✅ Android: Microphone recovered successfully');
      return true;
      
    } catch (error) {
      console.error(`❌ Android: Mic recovery attempt ${this.micRecoveryAttempts} failed:`, error);
      
      if (this.micRecoveryAttempts < this.MAX_MIC_RECOVERY_ATTEMPTS) {
        // Schedule retry
        setTimeout(() => this.recoverMicrophone(), 2000);
      } else {
        this.onError('Microphone lost - tap to retry');
      }
      return false;
    }
  }

  /**
   * Restart MediaRecorder with the current stream, preserving chunk manager state.
   */
  private async restartMediaRecorder(): Promise<void> {
    if (!this.stream) return;
    
    // Stop old recorder if it exists
    if (this.mediaRecorder) {
      try {
        if (this.mediaRecorder.state === 'recording' || this.mediaRecorder.state === 'paused') {
          this.mediaRecorder.stop();
        }
      } catch {}
    }
    
    // Create fresh MediaRecorder
    this.mediaRecorder = new MediaRecorder(this.stream, {
      mimeType: this.selectedMimeType,
      audioBitsPerSecond: 64000
    });
    
    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        const now = Date.now();
        let estimatedDurationMs = 5000;
        if (this.lastDataAvailableTime > 0) {
          estimatedDurationMs = Math.min(Math.max(now - this.lastDataAvailableTime, 1000), 30000);
        }
        this.lastDataAvailableTime = now;
        this.chunkManager.addChunk(event.data, estimatedDurationMs);
      }
    };
    
    this.mediaRecorder.onerror = (event) => {
      console.error('🤖 MediaRecorder error (recovered instance):', event);
    };
    
    this.lastDataAvailableTime = Date.now();
    this.mediaRecorder.start(5000);
    console.log('🤖 Android: MediaRecorder restarted with new stream');
  }

  /**
   * Set up inactive listener on the MediaStream for immediate call detection
   */
  private setupStreamInactiveListener(): void {
    if (!this.stream) return;
    
    this.stream.addEventListener('inactive', () => {
      if (!this.isRecording) return;
      console.warn('📵 Android: Stream inactive - likely phone call or OS interruption');
      this.interruptedByCall = true;
      this.onStatusChange('Recording paused - call detected');
    });
    
    // Also listen for individual track ended events
    this.stream.getAudioTracks().forEach(track => {
      track.addEventListener('ended', () => {
        if (!this.isRecording) return;
        console.warn('📵 Android: Audio track ended - OS may have seized microphone');
        this.interruptedByCall = true;
        this.onStatusChange('Recording paused - microphone interrupted');
      });
    });
  }

  private startHealthMonitoring() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.lastSuccessfulTranscriptionTime = Date.now();
    this.autoRecoveryAttempts = 0;

    // Check every 10 seconds
    this.healthCheckInterval = setInterval(async () => {
      if (!this.isRecording) {
        this.stopHealthMonitoring();
        return;
      }

      const timeSinceLastTranscription = Date.now() - this.lastSuccessfulTranscriptionTime;
      
      if (timeSinceLastTranscription > this.AUTO_RECOVERY_THRESHOLD_MS) {
        console.warn(`⚠️ Android: No transcription for ${Math.round(timeSinceLastTranscription / 1000)}s - attempting recovery`);
        await this.attemptAutoRecovery();
      }
    }, 10000);

    console.log('🏥 Android: Health monitoring started (10s interval, 75s threshold)');
  }

  private stopHealthMonitoring() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    console.log('🏥 Android: Health monitoring stopped');
  }

  private async attemptAutoRecovery() {
    if (this.autoRecoveryAttempts >= this.MAX_AUTO_RECOVERY_ATTEMPTS) {
      console.error('❌ Android: Max auto-recovery attempts reached');
      this.onError('Transcription stalled - tap to retry');
      return;
    }

    this.autoRecoveryAttempts++;
    console.log(`🔄 Android: Auto-recovery attempt ${this.autoRecoveryAttempts}/${this.MAX_AUTO_RECOVERY_ATTEMPTS}`);
    this.onStatusChange(`Recovering (${this.autoRecoveryAttempts}/${this.MAX_AUTO_RECOVERY_ATTEMPTS})...`);

    this.onRecoveryAttempt?.();

    try {
      await androidAudioKeepAlive.forceResume();
      await this.processChunkFromManager();
      this.onStatusChange('Recording...');
    } catch (error) {
      console.error('❌ Android: Auto-recovery failed:', error);
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
    console.log('📎 AndroidTranscriber linked to meeting/session:', id);
  }

  public setSessionId(id: string) {
    this.sessionId = id;
    console.log('📎 AndroidTranscriber session set:', id);
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
      
      if (timeSinceLastSpeech >= this.SILENCE_DURATION_MS && this.isRecording) {
        console.log(`🔇 Android: Silence detected - processing early`);
        if (this.chunkManager.hasEnoughForChunk()) {
          await this.processChunkFromManager();
        }
      }
      
      this.silenceTimer = null;
    }, this.SILENCE_DURATION_MS);
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
      this.onStatusChange('Starting Android transcription...');
      console.log('🤖 Starting Android Whisper transcription');
      console.log('🤖 Samsung Browser:', this.isSamsungBrowser());
      console.log('🤖 User Agent:', navigator.userAgent.substring(0, 100));

      // Initialize session
      try {
        if (!this.sessionId) {
          const existing = sessionStorage.getItem('currentSessionId');
          this.sessionId = existing || crypto.randomUUID();
          sessionStorage.setItem('currentSessionId', this.sessionId);
        }
        if (!this.meetingId) this.meetingId = this.sessionId;
      } catch (e) {
        console.warn('Could not initialize session/meeting id', e);
      }

      // Request microphone with Android-optimised settings
      const audioConstraints: MediaTrackConstraints = {
        sampleRate: 16000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true, // Enable for variable Android mic quality
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
      
      // Start audio keep-alive
      await androidAudioKeepAlive.start(this.audioContext);
      
      // Start VAD monitoring
      this.startActivityMonitoring();

      // Check supported MIME types - prioritise WebM for Android
      const mimeTypes = this.isSamsungBrowser()
        ? [
            'audio/mp4;codecs=mp4a.40.2',
            'audio/mp4',
            'audio/webm;codecs=opus',
            'audio/webm'
          ]
        : [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/mp4;codecs=mp4a.40.2',
            'audio/mp4'
          ];

      this.selectedMimeType = 'audio/webm';
      for (const mimeType of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          this.selectedMimeType = mimeType;
          console.log('🤖 Using MIME type:', mimeType);
          break;
        }
      }

      // Log all supported MIME types for debugging
      console.log('🤖 MIME type support:', {
        webmOpus: MediaRecorder.isTypeSupported('audio/webm;codecs=opus'),
        webm: MediaRecorder.isTypeSupported('audio/webm'),
        mp4: MediaRecorder.isTypeSupported('audio/mp4'),
        aac: MediaRecorder.isTypeSupported('audio/aac')
      });

      // Initialize chunk manager
      this.chunkManager.initialize(this.selectedMimeType);

      // Create MediaRecorder with lower bitrate for faster uploads
      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: this.selectedMimeType,
        audioBitsPerSecond: 64000  // 64kbps
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          const now = Date.now();
          
          let estimatedDurationMs = 5000;
          if (this.lastDataAvailableTime > 0) {
            estimatedDurationMs = Math.min(Math.max(now - this.lastDataAvailableTime, 1000), 30000);
          }
          this.lastDataAvailableTime = now;
          
          console.log(`📦 Android ondataavailable: ${event.data.size} bytes, ~${(estimatedDurationMs / 1000).toFixed(1)}s`);
          
          this.chunkManager.addChunk(event.data, estimatedDurationMs);
        }
      };

      this.mediaRecorder.onerror = (event) => {
        console.error('🤖 MediaRecorder error:', event);
        this.onError('Recording error occurred');
      };

      console.log('✅ Created Android MediaRecorder with MIME type:', this.selectedMimeType);

      await new Promise(resolve => setTimeout(resolve, 200));

      // Set up visibility handler
      this.setupVisibilityHandler();
      
      // Set up stream inactive listener for call detection
      this.setupStreamInactiveListener();

      // Initialize and start Web Worker
      this.initializeWorker();
      if (this.timerWorker) {
        this.timerWorker.postMessage({ type: 'start', intervalMs: 90000 }); // 90s interval (Option A)
        this.lastWorkerTick = Date.now();
      }

      // Start recording
      this.isRecording = true;
      this.startChunkedRecording();
      
      // Start health monitoring
      this.startHealthMonitoring();
      
      // Start track health monitor for call/interruption detection
      this.startTrackHealthMonitor();
      
      // Acquire Wake Lock
      await this.acquireWakeLock();
      
      // Start backup timer
      this.startBackupTimer();
      
      this.onStatusChange('Recording...');
      console.log('✅ Android transcription started');

    } catch (error: any) {
      console.error('❌ Failed to start Android transcription:', error);
      this.onError(`Failed to start recording: ${error.message}`);
    }
  }

  private startChunkedRecording() {
    if (!this.isRecording || !this.mediaRecorder) return;

    this.recordingStartTime = Date.now();
    this.lastSpeechTime = Date.now();
    this.lastDataAvailableTime = Date.now();
    
    // Use 5s timeslice
    this.mediaRecorder.start(5000);
    
    console.log('🤖 Android MediaRecorder started with 5s timeslice');

    // First transcription after 12 seconds
    this.chunkTimeout = setTimeout(async () => {
      if (this.isRecording) {
        console.log('📤 Processing FIRST audio chunk...');
        await this.processChunkFromManager();
        console.log('✅ First chunk processed');
      }
    }, 12000);
  }

  private startBackupTimer() {
    // Safety net timer in case worker fails
    this.backupTimerInterval = setInterval(async () => {
      if (!this.isRecording) return;
      
      // Only use backup if worker hasn't ticked recently
      if (this.timerWorker && Date.now() - this.lastWorkerTick < 15000) {
        return;
      }
      
      console.log('⏰ Android: Backup timer triggered');
      if (!this.isProcessing) {
        await this.processChunkFromManager();
      }
    }, 20000);
  }

  /**
   * Process chunk using the chunk manager
   */
  private async processChunkFromManager(): Promise<void> {
    if (this.isProcessing) {
      console.log('🤖 Android: Skipping process - already processing');
      return;
    }
    
    this.isProcessing = true;
    
    try {
      const chunk = this.chunkManager.getChunkForProcessing();
      if (!chunk) {
        this.isProcessing = false;
        return;
      }
      
      console.log(`📤 Android: Processing chunk #${chunk.chunkIndex} (${(chunk.blob.size / 1024).toFixed(1)}KB)`);
      
      const success = await this.sendChunkToWhisper(chunk);
      
      if (success) {
        this.chunkManager.markChunkProcessed();
        this.markSuccessfulTranscription();
      } else {
        this.chunkManager.markChunkFailed();
        this.consecutiveFailures++;
        console.warn(`⚠️ Android: Chunk failed, consecutive failures: ${this.consecutiveFailures}`);
      }
      
    } catch (error) {
      console.error('❌ Android: processChunkFromManager error:', error);
      this.consecutiveFailures++;
    } finally {
      this.isProcessing = false;
      
      // Process any pending tick
      if (this.pendingTick && this.isRecording) {
        this.pendingTick = false;
        console.log('⏰ Processing queued tick...');
        setTimeout(() => this.processChunkFromManager(), 100);
      }
    }
  }

  private readonly API_TIMEOUT_MS = 30000;

  /**
   * Send a chunk to the Whisper API
   */
  private async sendChunkToWhisper(chunk: ProcessableChunk): Promise<boolean> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      console.warn('⏱️ Android: Whisper API request timed out after 30s');
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

      const apiPromise = supabase.functions.invoke('speech-to-text', {
        body: {
          audio: base64Audio,
          mimeType: chunk.blob.type,
          fileName: 'android-audio.webm',
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
        return true;
      }

      // Extract new text
      const newText = this.extractNewText(fullTranscribedText);
      
      if (newText && newText.length > 0) {
        const confidence = data.confidence ?? 0.8;
        
        if (meetsConfidenceThreshold(confidence, this.meetingSettings)) {
          this.chunkCounter++;
          this.totalWordCount += newText.split(/\s+/).length;
          
          this.onTranscription({
            text: newText,
            is_final: true,
            confidence,
            speaker: 'Speaker'
          });
          
          this.finalTranscript = fullTranscribedText;
          this.onChunkProcessed?.();
          
          console.log(`✅ Android: Transcribed chunk #${chunk.chunkIndex}: "${newText.substring(0, 50)}..."`);
        } else {
          console.log(`⚠️ Android: Chunk below confidence threshold (${confidence})`);
          this.onChunkFiltered?.();
        }
      }

      return true;

    } catch (error: any) {
      clearTimeout(timeoutId);
      
      if (error.message === 'API_TIMEOUT') {
        console.error('⏱️ Android: API call timed out');
      } else {
        console.error('❌ Android: sendChunkToWhisper error:', error);
      }
      
      return false;
    }
  }

  private extractNewText(fullText: string): string {
    if (!this.finalTranscript) {
      return fullText;
    }
    
    // Simple diff: find where new text starts
    const previousWords = this.finalTranscript.toLowerCase().split(/\s+/);
    const currentWords = fullText.split(/\s+/);
    
    // Find overlap point
    let overlapEnd = 0;
    for (let i = Math.max(0, previousWords.length - 20); i < previousWords.length; i++) {
      const remainingPrevious = previousWords.slice(i).join(' ');
      const currentStart = currentWords.slice(0, previousWords.length - i).join(' ').toLowerCase();
      
      if (remainingPrevious === currentStart) {
        overlapEnd = previousWords.length - i;
        break;
      }
    }
    
    const newWords = currentWords.slice(overlapEnd);
    return newWords.join(' ').trim();
  }

  private isHallucination(text: string): boolean {
    const normalized = text.toLowerCase().trim();
    
    // Common Whisper hallucinations
    const hallucinations = [
      'thank you',
      'thanks for watching',
      'subscribe',
      'like and subscribe',
      'see you in the next',
      'bye bye',
      'music',
      '[music]',
      '♪',
      'applause',
      '[applause]'
    ];
    
    for (const h of hallucinations) {
      if (normalized === h || normalized === h + '.') {
        return true;
      }
    }
    
    // Check with existing patterns
    if (isLikelyHallucination(text)) return true;
    if (isRepetitiveContent(text)) return true;
    
    return false;
  }

  async stopTranscription() {
    console.log('🛑 Stopping Android transcription...');
    this.isRecording = false;
    
    // Stop worker
    if (this.timerWorker) {
      this.timerWorker.postMessage({ type: 'stop' });
      this.timerWorker.terminate();
      this.timerWorker = null;
    }
    
    if (this.workerBlobUrl) {
      URL.revokeObjectURL(this.workerBlobUrl);
      this.workerBlobUrl = null;
    }
    
    // Stop timers
    if (this.chunkTimeout) {
      clearTimeout(this.chunkTimeout);
      this.chunkTimeout = null;
    }
    
    if (this.backupTimerInterval) {
      clearInterval(this.backupTimerInterval);
      this.backupTimerInterval = null;
    }
    
    // Remove visibility handler
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
    
    // Stop health monitoring
    this.stopHealthMonitoring();
    
    // Stop track health monitor
    this.stopTrackHealthMonitor();
    
    // Stop activity monitoring
    this.stopActivityMonitoring();
    
    // Release Wake Lock
    await this.releaseWakeLock();
    
    // Stop keep-alive
    androidAudioKeepAlive.stop();
    
    // Process final chunk
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
      
      // Wait and process final chunk
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const finalChunk = this.chunkManager.getFinalChunk();
      if (finalChunk) {
        console.log('📤 Processing final chunk...');
        await this.sendChunkToWhisper(finalChunk);
        this.chunkManager.markChunkProcessed();
      }
    }
    
    // Stop stream
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    
    // Reset chunk manager
    this.chunkManager.reset();
    
    this.onStatusChange('Stopped');
    console.log('✅ Android transcription stopped');
  }

  isRecordingActive(): boolean {
    return this.isRecording;
  }

  public async processPendingChunks(): Promise<number> {
    const stats = this.chunkManager.getStats();
    if (stats.bufferDurationMs > 0) {
      await this.processChunkFromManager();
      return 1;
    }
    return 0;
  }

  getTranscript(): string {
    return this.finalTranscript;
  }

  getTotalWordCount(): number {
    return this.totalWordCount;
  }
}
