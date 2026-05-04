import { supabase } from "@/integrations/supabase/client";
import { hasAudioActivity, getOptimalChunkInterval, OPTIMAL_CHUNK_DURATION } from './audioLevelDetection';
import { meetsConfidenceThreshold, withDefaultThresholds, type MeetingSettingsWithThresholds } from './confidenceGating';
import { isLikelyHallucination, isLaughterNoise } from './whisperHallucinationPatterns';
import { cleanWhisperResponse } from './whisper-chunk-cleaner';

export interface TranscriptData {
  text: string;
  is_final: boolean;
  confidence: number;
  speaker: string;
}

export interface ChunkMetadata {
  text?: string;
  confidence?: number;
  noSpeechProb?: number;
  avgLogprob?: number;
  reason?: string;
  audioSizeBytes?: number;
  processingTimeMs?: number;
  speaker?: string;
  // New fields for timing and format
  startTimeSeconds?: number;
  endTimeSeconds?: number;
  mimeType?: string;
}

export class DesktopWhisperTranscriber {
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;

  /** Expose the active audio stream for backup recording */
  getStream(): MediaStream | null {
    return this.stream;
  }
  private isRecording = false;
  private stopped = false; // Guard: prevents DB writes after stopTranscription() is called
  private audioChunks: Blob[] = [];
  private transcriptionTimeout: NodeJS.Timeout | null = null;
  private overlapBuffer: Blob[] = [];
  private chunkCount = 0;
  private allTranscriptions: string[] = []; // Store all transcriptions directly
  private sessionId: string; // Unique session ID for this recording
  private meetingId: string | null = null; // Meeting ID to associate chunks
  private finalTranscript = ''; // Accumulated final transcript with smart merging
  private lastSegmentEndTime = 0; // Track the last segment end time to avoid duplicates
  private totalProcessedDuration = 0; // Track cumulative audio duration for time offset
  
  // Early transcription mode for first minute
  private earlyTranscriptionMode = true;
  private recordingStartTime = 0;
  private firstTranscriptionSent = false;
  
  private chunkIntervalMs: number;
  private totalWordCount = 0;
  private chunkCounter = 0;
  private meetingSettings: MeetingSettingsWithThresholds;
  
  // Audio activity monitoring
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private activityCheckInterval: NodeJS.Timeout | null = null;
  
  // VAD-based silence detection for smoother real-time experience
  private silenceTimer: NodeJS.Timeout | null = null;
  private lastSpeechTime = 0;
  private isSpeaking = false;
  private chunkStartTime = 0;
  private readonly SILENCE_THRESHOLD = 0.015; // RMS threshold for speech detection
  private readonly SILENCE_DURATION_MS = 5000; // 5 seconds of silence triggers flush
  private readonly MIN_CHUNK_DURATION_MS = 60000; // Minimum 60s before silence-based flushing (Option A: 90s chunks)
  
  // Extended silence detection for auto-stop (90 minutes of no speech activity)
  private readonly SILENCE_AUTO_STOP_MS = 90 * 60 * 1000; // 90 minutes
  private extendedSilenceCheckInterval: NodeJS.Timeout | null = null;
  private lastTranscriptActivityTime = 0;
  public onSilenceAutoStop?: () => void;
  
  // Web Worker-based chunk timing (resistant to background throttling)
  private chunkTimerWorker: Worker | null = null;
  private chunkTimerWorkerBlobUrl: string | null = null;
  
  // Visibility handler for tab switching
  private visibilityHandler: (() => void) | null = null;
  
  // Track health monitoring and recovery
  private trackHealthInterval: NodeJS.Timeout | null = null;
  private recoveryInProgress = false;
  private interruptedByDevice = false;
  
  // Wake Lock
  private wakeLockSentinel: WakeLockSentinel | null = null;
  
  // Chunk delivery watchdog — detects stalls from Edge sleeping tabs
  private lastChunkDeliveredAt = 0;
  private chunkWatchdogInterval: NodeJS.Timeout | null = null;
  private chunkWatchdogRecoveryAttempts = 0;
  private readonly CHUNK_WATCHDOG_CHECK_MS = 60000; // Check every 60s
  private readonly CHUNK_STALL_THRESHOLD_MS = 180000; // 3 minutes = stall
  private readonly MAX_WATCHDOG_RECOVERY_ATTEMPTS = 2;
  
  // Page Lifecycle API (Edge freeze/resume)
  private freezeHandler: (() => void) | null = null;
  private resumeHandler: (() => void) | null = null;
  private frozenAt = 0;
  
  // Callback for chunk stall events (consumed by health monitor)
  public onChunkStall?: (info: { stalledSeconds: number; recoveryAttempt: number }) => void;

  constructor(
    private onTranscription: (data: TranscriptData) => void,
    private onError: (error: string) => void,
    private onStatusChange: (status: string) => void,
    meetingSettings?: any,
    meetingId?: string,
    private onAudioActivity?: (hasActivity: boolean) => void,
    private onChunkProcessed?: (metadata: ChunkMetadata) => void,
    private onChunkFiltered?: (metadata: ChunkMetadata) => void,
    private selectedDeviceId?: string | null,
    private externalStream?: MediaStream | null, // Allow passing pre-configured stream (e.g., mixed mic + browser audio)
    private audioFormat?: 'webm' | 'mp3',
    private customChunkDurationMs?: number
  ) {
    this.sessionId = meetingId || this.generateSessionId();
    this.meetingId = meetingId || null;
    // Use custom chunk duration if provided, otherwise default to 90s (Option A)
    this.chunkIntervalMs = customChunkDurationMs || 90000;
    this.meetingSettings = withDefaultThresholds(meetingSettings);
    console.log(`🎙️ DesktopWhisperTranscriber initialized with audioFormat: ${audioFormat || 'webm'}, chunkDuration: ${this.chunkIntervalMs}ms`);
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private startActivityMonitoring() {
    if (!this.analyser) return;
    
    // Initialize transcript activity time
    this.lastTranscriptActivityTime = Date.now();
    
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
      
      // Track speech activity for VAD-based flushing
      const wasSpeaking = this.isSpeaking;
      this.isSpeaking = rms > this.SILENCE_THRESHOLD;
      
      if (this.isSpeaking) {
        // Speech detected - record timestamp and clear silence timer
        this.lastSpeechTime = Date.now();
        if (this.silenceTimer) {
          clearTimeout(this.silenceTimer);
          this.silenceTimer = null;
        }
      } else if (wasSpeaking && !this.isSpeaking) {
        // Transition from speaking to silence - schedule early flush
        this.scheduleSilenceFlush();
      }
      
      // Call callback with activity status
      if (this.onAudioActivity) {
        this.onAudioActivity(this.isSpeaking);
      }
    }, 100); // Check every 100ms
    
    // Start extended silence check for auto-stop (checks every 60 seconds)
    this.extendedSilenceCheckInterval = setInterval(() => {
      if (!this.isRecording) return;
      
      const silenceDuration = Date.now() - this.lastTranscriptActivityTime;
      if (silenceDuration > this.SILENCE_AUTO_STOP_MS) {
        console.warn(`⚠️ 90 minutes of inactivity detected (${Math.round(silenceDuration / 60000)} min) - triggering auto-stop`);
        if (this.onSilenceAutoStop) {
          this.onSilenceAutoStop();
        }
      }
    }, 60000); // Check every minute
  }
  
  /**
   * Schedule an early chunk flush when silence is detected
   * This provides smoother real-time feedback to clinicians
   */
  private scheduleSilenceFlush() {
    if (this.silenceTimer) return; // Already scheduled
    
    this.silenceTimer = setTimeout(() => {
      const timeSinceLastSpeech = Date.now() - this.lastSpeechTime;
      const chunkDuration = Date.now() - this.chunkStartTime;
      
      // Only flush if we have enough audio and silence has been maintained
      if (timeSinceLastSpeech >= this.SILENCE_DURATION_MS && 
          chunkDuration >= this.MIN_CHUNK_DURATION_MS &&
          this.audioChunks.length > 0 &&
          this.isRecording) {
        console.log(`🔇 Silence detected for ${(timeSinceLastSpeech/1000).toFixed(1)}s after ${(chunkDuration/1000).toFixed(1)}s of audio - flushing chunk early`);
        this.flushCurrentChunk();
      }
      
      this.silenceTimer = null;
    }, this.SILENCE_DURATION_MS);
  }
  
  /**
   * Flush current audio chunk early (triggered by silence detection)
   * Stops and restarts the MediaRecorder to send current audio for transcription
   */
  private flushCurrentChunk() {
    // Cancel the scheduled timer-based chunk
    if (this.transcriptionTimeout) {
      clearTimeout(this.transcriptionTimeout);
      this.transcriptionTimeout = null;
    }
    
    // Stop and restart the recorder to trigger ondataavailable
    if (this.mediaRecorder?.state === 'recording' && this.isRecording) {
      this.mediaRecorder.stop();
      
      // Restart recording after brief pause
      setTimeout(() => {
        if (this.mediaRecorder && this.isRecording) {
          this.chunkStartTime = Date.now();
          this.mediaRecorder.start();
          this.scheduleNextChunk();
        }
      }, 100);
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
    if (this.extendedSilenceCheckInterval) {
      clearInterval(this.extendedSilenceCheckInterval);
      this.extendedSilenceCheckInterval = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }

  private smartMerge(oldText: string, newText: string): string {
    if (!oldText) return newText;
    if (!newText) return oldText;
    
    // ChatGPT recommended de-duplication: drop leading tokens in new chunk that appear at end of previous
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
        console.log(`🔄 De-duplication: Found ${similarity.toFixed(2)} similarity, removing ${i} overlapping words`);
        return oldText + " " + newWords.slice(i).join(' ');
      }
    }
    
    return oldText + " " + newText;
  }

  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

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

  /**
   * Check if text is likely hallucinated/repetitive noise using comprehensive patterns
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
      console.log(`🚫 Hallucination detected: ${result.reason}`);
    }
    
    return result.isHallucination;
  }

  private checkAudioQuality(audioData: Uint8Array): boolean {
    // Simple RMS calculation for noise detection
    let sum = 0;
    let min = 0;
    let max = 0;
    
    for (let i = 0; i < audioData.length; i += 2) {
      const sample = (audioData[i + 1] << 8) | audioData[i];
      const normalized = sample / 32768;
      sum += normalized * normalized;
      min = Math.min(min, normalized);
      max = Math.max(max, normalized);
    }
    
    const rms = Math.sqrt(sum / (audioData.length / 2));
    const dynamicRange = max - min;
    
    // Much more permissive thresholds to avoid dropping quiet speech
    // We still filter absolute silence / flat-line noise, but accept almost all voice
    const isNonSilent = rms >= 0.000001; // effectively "any real signal"
    const hasSomeVariation = dynamicRange >= 0.0005;
    
    if (!isNonSilent || !hasSomeVariation) {
      console.log(`🔇 Mic chunk filtered (rms=${rms.toFixed(6)}, range=${dynamicRange.toFixed(6)})`);
    }
    
    return isNonSilent && hasSomeVariation;
  }

  setMeetingId(meetingId: string): void {
    this.meetingId = meetingId;
    // Use the meeting ID as the session ID to ensure consistency
    this.sessionId = meetingId;
    console.log(`📋 Set meeting ID: ${meetingId} and session ID: ${this.sessionId}`);
  }

  async startTranscription() {
    try {
      this.recordingStartTime = Date.now();
      this.earlyTranscriptionMode = true;
      this.firstTranscriptionSent = false;
      
      console.log('🚀 Starting Desktop Whisper with EARLY MODE for fast initial response');
      this.onStatusChange('Ready for immediate transcription...');
      console.log('🖥️ Starting Desktop Whisper transcription...');

      // Use external stream if provided (e.g., pre-mixed mic + browser audio)
      if (this.externalStream) {
        console.log('🔊 Using external pre-configured audio stream (mic + browser audio)');
        this.stream = this.externalStream;
      } else {
        // Request microphone access with ChatGPT recommended settings
        // Use selected device if provided
        const audioConstraints: MediaTrackConstraints = {
          sampleRate: 48000, // 48kHz - Chrome native, avoid resampling artifacts
          channelCount: 1,
          echoCancellation: false, // Disabled - can create artifacts
          noiseSuppression: false, // Disabled - can create artifacts  
          autoGainControl: false,  // Disabled - can create artifacts
        };
        
        if (this.selectedDeviceId) {
          audioConstraints.deviceId = { exact: this.selectedDeviceId };
          console.log('🎤 Using selected microphone device:', this.selectedDeviceId);
        }
        
        this.stream = await navigator.mediaDevices.getUserMedia({
          audio: audioConstraints
        });
      }
      
      // Set up audio activity monitoring for VAD-based silence detection
      // This is always enabled for smoother real-time transcription experience
      this.audioContext = new AudioContext({ sampleRate: 48000 });
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      
      const source = this.audioContext.createMediaStreamSource(this.stream);
      source.connect(this.analyser);
      
      // Start checking for audio activity (VAD + optional callback)
      this.startActivityMonitoring();

      // Check supported MIME types for desktop based on user preference
      let mimeTypes: string[];
      
      if (this.audioFormat === 'mp3') {
        // MP3 preferred - try MP3/MPEG formats first
        mimeTypes = [
          'audio/mp3',
          'audio/mpeg',
          'audio/webm;codecs=opus',
          'audio/webm',
          'audio/mp4',
          'audio/mp4;codecs=mp4a.40.2'
        ];
        console.log('🎵 User preference: MP3 format');
      } else {
        // WebM preferred (default) — audio-only MIME, no video containers
        mimeTypes = [
          'audio/webm;codecs=opus',
          'audio/webm',
          'audio/ogg;codecs=opus'
        ];
        console.log('🎵 User preference: WebM format');
      }

      let selectedMimeType = 'audio/webm'; // fallback
      for (const mimeType of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType;
          console.log('🖥️ Using MIME type:', mimeType);
          break;
        }
      }
      
      // Warn if preferred format wasn't available
      if (this.audioFormat === 'mp3' && !selectedMimeType.includes('mp3') && !selectedMimeType.includes('mpeg')) {
        console.warn('⚠️ MP3 format not supported by browser, falling back to:', selectedMimeType);
      }

      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: selectedMimeType,
        audioBitsPerSecond: 128000 // Higher bitrate for desktop
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = async () => {
        if (this.audioChunks.length > 0) {
          // Increment chunk count BEFORE processing to ensure unique numbering
          const currentChunk = this.chunkCount++;
          console.log(`🔍 DEBUG: Processing scheduled chunk ${currentChunk}, next will be ${this.chunkCount}`);
          await this.processAudioChunks(currentChunk);
        }
      };

      this.mediaRecorder.onerror = (event) => {
        console.error('🖥️ MediaRecorder error:', event);
        this.onError('Recording error occurred');
      };

      // Start recording and schedule first chunk
      this.isRecording = true;
      this.chunkCount = 0;
      this.startChunkedRecording();
      
      // Setup visibility handler for tab switching recovery
      this.setupVisibilityHandler();
      
      // Setup track health monitoring for device disconnect detection
      this.setupTrackMonitoring();
      
      // Setup chunk delivery watchdog (detects Edge sleeping tab stalls)
      this.setupChunkWatchdog();
      
      // Setup Page Lifecycle API listeners (Edge freeze/resume)
      this.setupPageLifecycleListeners();
      
      // Acquire Wake Lock to prevent screen dimming during recording
      await this.acquireWakeLock();
      
      this.onStatusChange('Recording...');
      console.log('✅ Desktop Whisper transcription started');

    } catch (error) {
      console.error('❌ Failed to start desktop Whisper transcription:', error);
      this.onError(`Failed to start recording: ${error.message}`);
    }
  }

  private startChunkedRecording() {
    if (!this.mediaRecorder || !this.isRecording) return;

    // Track when this chunk started for VAD minimum duration
    this.chunkStartTime = Date.now();
    this.lastSpeechTime = Date.now(); // Assume starting with speech
    
    // Start recording
    this.mediaRecorder.start();
    
    // Schedule next chunk based on timing requirements
    this.scheduleNextChunk();
  }

  private scheduleNextChunk() {
    if (!this.isRecording) return;

    // Check if we should exit early transcription mode (after 60 seconds)
    const elapsed = Date.now() - this.recordingStartTime;
    if (this.earlyTranscriptionMode && elapsed > 60000) {
      console.log('📊 Exiting EARLY MODE after 60 seconds - switching to optimal intervals');
      this.earlyTranscriptionMode = false;
    }

    // Phase 2: Use optimal chunk intervals for better Whisper performance
    const nextInterval = getOptimalChunkInterval(elapsed, this.earlyTranscriptionMode);
    
    console.log(`⚡ Chunk interval: ${nextInterval/1000}s (elapsed: ${elapsed/1000}s, early: ${this.earlyTranscriptionMode})`);
    console.log(`🖥️ Scheduling chunk ${this.chunkCount + 1} in ${nextInterval/1000} seconds`);

    // Use Web Worker for background-resistant timing
    this.scheduleChunkWithWorker(nextInterval);
  }
  
  /**
   * Schedule chunk processing using Web Worker (resistant to browser throttling)
   */
  private scheduleChunkWithWorker(intervalMs: number): void {
    // Clean up any existing worker
    this.cleanupChunkTimerWorker();
    
    const workerCode = `
      let timeoutId = null;
      
      self.onmessage = (event) => {
        const { type, delayMs } = event.data;
        
        if (type === 'schedule') {
          if (timeoutId) clearTimeout(timeoutId);
          timeoutId = setTimeout(() => {
            self.postMessage({ type: 'tick', timestamp: Date.now() });
          }, delayMs);
        } else if (type === 'cancel') {
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }
        }
      };
    `;
    
    try {
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      this.chunkTimerWorkerBlobUrl = URL.createObjectURL(blob);
      this.chunkTimerWorker = new Worker(this.chunkTimerWorkerBlobUrl);
      
      this.chunkTimerWorker.onmessage = (event) => {
        if (event.data.type === 'tick' && this.isRecording) {
          this.handleChunkTick();
        }
      };
      
      this.chunkTimerWorker.postMessage({ type: 'schedule', delayMs: intervalMs });
      console.log(`🖥️ Web Worker chunk timer scheduled for ${intervalMs}ms`);
    } catch (error) {
      // Fallback to setTimeout if Web Worker fails
      console.warn('🖥️ Web Worker failed, using setTimeout fallback:', error);
      this.scheduleChunkFallback(intervalMs);
    }
  }
  
  private scheduleChunkFallback(intervalMs: number): void {
    if (this.transcriptionTimeout) {
      clearTimeout(this.transcriptionTimeout);
    }
    
    this.transcriptionTimeout = setTimeout(() => {
      if (this.isRecording) {
        this.handleChunkTick();
      }
    }, intervalMs);
  }
  
  private handleChunkTick(): void {
    if (this.mediaRecorder && this.isRecording && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
      
      // Start new recording immediately after a brief pause
      setTimeout(() => {
        if (this.mediaRecorder && this.isRecording) {
          this.chunkStartTime = Date.now(); // Reset chunk start time
          this.lastSpeechTime = Date.now(); // Reset speech time
          this.mediaRecorder.start();
          this.scheduleNextChunk();
        }
      }, 100);
    }
  }
  
  private cleanupChunkTimerWorker(): void {
    if (this.chunkTimerWorker) {
      this.chunkTimerWorker.postMessage({ type: 'cancel' });
      this.chunkTimerWorker.terminate();
      this.chunkTimerWorker = null;
    }
    if (this.chunkTimerWorkerBlobUrl) {
      URL.revokeObjectURL(this.chunkTimerWorkerBlobUrl);
      this.chunkTimerWorkerBlobUrl = null;
    }
  }
  
  /**
   * Setup track health monitoring - polls track state to detect device disconnects
   */
  private setupTrackMonitoring(): void {
    if (!this.stream) return;
    
    // Add stream.oninactive for immediate Bluetooth/device disconnect detection
    (this.stream as any).oninactive = () => {
      console.log('🔌 Desktop: Stream inactive - device disconnected');
      this.interruptedByDevice = true;
      if (this.isRecording && !this.recoveryInProgress) {
        this.recoverMicrophone();
      }
    };
    
    // Add track.onended listeners
    this.stream.getAudioTracks().forEach(track => {
      track.onended = () => {
        console.log('🔌 Desktop: Track ended -', track.label);
        this.interruptedByDevice = true;
        if (this.isRecording && !this.recoveryInProgress) {
          this.recoverMicrophone();
        }
      };
    });
    
    // Poll track health every 3 seconds
    this.trackHealthInterval = setInterval(() => {
      if (!this.isRecording || this.recoveryInProgress) return;
      
      const tracks = this.stream?.getAudioTracks() || [];
      const unhealthy = tracks.some(t => t.readyState === 'ended' || !t.enabled);
      
      if (unhealthy || tracks.length === 0) {
        console.log('⚠️ Desktop: Track health check failed - attempting recovery');
        this.interruptedByDevice = true;
        this.recoverMicrophone();
      }
    }, 3000);
  }
  
  private stopTrackMonitoring(): void {
    if (this.trackHealthInterval) {
      clearInterval(this.trackHealthInterval);
      this.trackHealthInterval = null;
    }
  }
  
  /**
   * Recover microphone after device disconnect or interruption
   */
  private async recoverMicrophone(attempt = 0): Promise<void> {
    if (this.recoveryInProgress && attempt === 0) return;
    this.recoveryInProgress = true;
    
    this.onStatusChange('Recording paused - audio device lost');
    console.log(`🔄 Desktop: Attempting microphone recovery (attempt ${attempt + 1}/3)`);
    
    try {
      // Stop old MediaRecorder
      if (this.mediaRecorder?.state === 'recording') {
        try { this.mediaRecorder.stop(); } catch {}
      }
      
      // Stop old stream tracks
      this.stream?.getTracks().forEach(t => { try { t.stop(); } catch {} });
      
      // Re-acquire getUserMedia with same constraints
      const audioConstraints: MediaTrackConstraints = {
        sampleRate: 48000,
        channelCount: 1,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      };
      if (this.selectedDeviceId) {
        audioConstraints.deviceId = { exact: this.selectedDeviceId };
      }
      
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
      
      // Close and recreate AudioContext + analyser
      this.stopActivityMonitoring();
      this.audioContext = new AudioContext({ sampleRate: 48000 });
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      const source = this.audioContext.createMediaStreamSource(this.stream);
      source.connect(this.analyser);
      this.startActivityMonitoring();
      
      // Select MIME type (same logic as startTranscription)
      let mimeTypes: string[];
      if (this.audioFormat === 'mp3') {
        mimeTypes = ['audio/mp3', 'audio/mpeg', 'audio/webm;codecs=opus', 'audio/webm'];
      } else {
        mimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
      }
      let selectedMimeType = 'audio/webm';
      for (const mt of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mt)) { selectedMimeType = mt; break; }
      }
      
      // Create new MediaRecorder
      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: selectedMimeType,
        audioBitsPerSecond: 128000
      });
      
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) this.audioChunks.push(event.data);
      };
      this.mediaRecorder.onstop = async () => {
        if (this.audioChunks.length > 0) {
          const currentChunk = this.chunkCount++;
          await this.processAudioChunks(currentChunk);
        }
      };
      this.mediaRecorder.onerror = (event) => {
        console.error('🖥️ MediaRecorder error:', event);
        this.onError('Recording error occurred');
      };
      
      // Restart chunked recording (preserves chunkCount, finalTranscript etc.)
      this.startChunkedRecording();
      
      // Re-setup track monitoring on new stream
      this.stopTrackMonitoring();
      this.setupTrackMonitoring();
      
      // Re-acquire Wake Lock
      await this.acquireWakeLock();
      
      this.interruptedByDevice = false;
      this.recoveryInProgress = false;
      this.onStatusChange('Recording resumed - microphone recovered');
      console.log('✅ Desktop: Microphone recovered successfully');
      
    } catch (err) {
      this.recoveryInProgress = false;
      console.warn(`⚠️ Desktop: Recovery attempt ${attempt + 1} failed:`, err);
      
      if (attempt < 2) {
        setTimeout(() => this.recoverMicrophone(attempt + 1), 2000);
      } else {
        this.onError('Microphone lost - please check your audio device');
      }
    }
  }
  
  /**
   * Wake Lock management - prevents screen dimming during recording
   */
  private async acquireWakeLock(): Promise<void> {
    if (!('wakeLock' in navigator)) return;
    
    try {
      this.wakeLockSentinel = await navigator.wakeLock.request('screen');
      this.wakeLockSentinel.addEventListener('release', () => {
        console.log('🔓 Desktop: Wake Lock released');
        this.wakeLockSentinel = null;
      });
      console.log('🔒 Desktop: Wake Lock acquired');
    } catch (err) {
      console.warn('⚠️ Desktop: Wake Lock request failed (non-fatal):', err);
    }
  }
  
  private async releaseWakeLock(): Promise<void> {
    if (this.wakeLockSentinel) {
      try {
        await this.wakeLockSentinel.release();
        console.log('🔓 Desktop: Wake Lock manually released');
      } catch {}
      this.wakeLockSentinel = null;
    }
  }
  
  /**
   * Setup visibility handler to recover when tab becomes visible
   */
  private setupVisibilityHandler(): void {
    this.visibilityHandler = () => {
      if (document.visibilityState === 'visible' && this.isRecording) {
        console.log('🖥️ Desktop: Tab visible - checking recording health');
        
        // 1. Force-resume AudioContext if suspended
        if (this.audioContext?.state === 'suspended') {
          console.log('🖥️ Desktop: Resuming suspended AudioContext');
          this.audioContext.resume().catch(err => console.warn('AudioContext resume failed:', err));
        }
        
        // 2. Check track health and trigger recovery if needed
        const tracks = this.stream?.getAudioTracks() || [];
        const unhealthy = tracks.some(t => t.readyState === 'ended' || !t.enabled) || tracks.length === 0;
        
        if (unhealthy && !this.recoveryInProgress) {
          console.log('🖥️ Desktop: Track unhealthy after tab restore - recovering');
          this.recoverMicrophone();
          return; // Recovery will handle everything
        }
        
        // 3. Re-acquire Wake Lock
        this.acquireWakeLock();
        
        // 4. Flush buffered audio (existing behaviour)
        if (this.audioChunks.length > 0 && this.mediaRecorder?.state === 'recording') {
          console.log('🖥️ Desktop: Flushing buffered audio after tab switch');
          this.flushCurrentChunk();
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
   * Chunk delivery watchdog — detects when chunks stop arriving (Edge sleeping tabs)
   */
  private setupChunkWatchdog(): void {
    this.lastChunkDeliveredAt = Date.now();
    this.chunkWatchdogRecoveryAttempts = 0;
    
    this.chunkWatchdogInterval = setInterval(() => {
      if (!this.isRecording) return;
      
      const stalledMs = Date.now() - this.lastChunkDeliveredAt;
      
      if (stalledMs > this.CHUNK_STALL_THRESHOLD_MS) {
        const stalledSecs = Math.round(stalledMs / 1000);
        console.warn(`🐕 CHUNK_WATCHDOG: No chunk delivered for ${stalledSecs}s — possible Edge sleeping tab`);
        
        // Diagnostic log
        console.warn(`🐕 CHUNK_WATCHDOG_DIAG: MediaRecorder.state=${this.mediaRecorder?.state}, tracks=${this.stream?.getAudioTracks().map(t => t.readyState).join(',')}, AudioContext.state=${this.audioContext?.state}`);
        
        this.onChunkStall?.({ stalledSeconds: stalledSecs, recoveryAttempt: this.chunkWatchdogRecoveryAttempts + 1 });
        
        if (this.chunkWatchdogRecoveryAttempts < this.MAX_WATCHDOG_RECOVERY_ATTEMPTS) {
          this.chunkWatchdogRecoveryAttempts++;
          console.log(`🔄 CHUNK_WATCHDOG: Recovery attempt ${this.chunkWatchdogRecoveryAttempts}/${this.MAX_WATCHDOG_RECOVERY_ATTEMPTS} — restarting MediaRecorder`);
          this.attemptMediaRecorderRestart();
        } else {
          console.error(`🛑 CHUNK_WATCHDOG: ${this.MAX_WATCHDOG_RECOVERY_ATTEMPTS} recovery attempts failed — recording likely dead`);
        }
      }
    }, this.CHUNK_WATCHDOG_CHECK_MS);
  }
  
  private stopChunkWatchdog(): void {
    if (this.chunkWatchdogInterval) {
      clearInterval(this.chunkWatchdogInterval);
      this.chunkWatchdogInterval = null;
    }
  }
  
  /**
   * Attempt to restart MediaRecorder after a detected stall
   */
  private attemptMediaRecorderRestart(): void {
    try {
      // Stop current MediaRecorder
      if (this.mediaRecorder?.state === 'recording') {
        this.mediaRecorder.stop();
      }
      
      // Restart after a brief pause
      setTimeout(() => {
        if (this.mediaRecorder && this.isRecording) {
          this.chunkStartTime = Date.now();
          this.lastSpeechTime = Date.now();
          try {
            this.mediaRecorder.start();
            this.scheduleNextChunk();
            this.lastChunkDeliveredAt = Date.now(); // Reset watchdog
            console.log('✅ CHUNK_WATCHDOG: MediaRecorder restarted successfully');
          } catch (err) {
            console.error('❌ CHUNK_WATCHDOG: MediaRecorder restart failed:', err);
            // Try full mic recovery
            if (!this.recoveryInProgress) {
              this.recoverMicrophone();
            }
          }
        }
      }, 200);
    } catch (err) {
      console.error('❌ CHUNK_WATCHDOG: Restart attempt error:', err);
    }
  }
  
  /**
   * Page Lifecycle API — detects Edge/Chrome freeze and resume events
   */
  private setupPageLifecycleListeners(): void {
    this.freezeHandler = () => {
      this.frozenAt = Date.now();
      console.warn(`🧊 PAGE_LIFECYCLE: Page frozen at ${new Date().toISOString()}`);
    };
    
    this.resumeHandler = () => {
      const frozenDuration = this.frozenAt ? Date.now() - this.frozenAt : 0;
      console.log(`🔥 PAGE_LIFECYCLE: Page resumed after ${Math.round(frozenDuration / 1000)}s freeze`);
      
      if (this.isRecording && frozenDuration > 30000) {
        console.warn(`🔥 PAGE_LIFECYCLE: Extended freeze (${Math.round(frozenDuration / 1000)}s) — triggering full recovery`);
        
        // Resume AudioContext
        if (this.audioContext?.state === 'suspended') {
          this.audioContext.resume().catch(err => console.warn('AudioContext resume failed:', err));
        }
        
        // Re-acquire wake lock
        this.acquireWakeLock();
        
        // Check if MediaRecorder is still alive
        if (this.mediaRecorder?.state !== 'recording') {
          console.warn('🔥 PAGE_LIFECYCLE: MediaRecorder not recording after freeze — restarting');
          this.attemptMediaRecorderRestart();
        } else {
          // Flush any buffered audio
          if (this.audioChunks.length > 0) {
            this.flushCurrentChunk();
          }
        }
      }
      
      this.frozenAt = 0;
    };
    
    document.addEventListener('freeze', this.freezeHandler);
    document.addEventListener('resume', this.resumeHandler);
  }
  
  private removePageLifecycleListeners(): void {
    if (this.freezeHandler) {
      document.removeEventListener('freeze', this.freezeHandler);
      this.freezeHandler = null;
    }
    if (this.resumeHandler) {
      document.removeEventListener('resume', this.resumeHandler);
      this.resumeHandler = null;
    }
  }

  private async processAudioChunks(chunkNumber?: number) {
    if (this.audioChunks.length === 0) return;

    const chunkProcessingStartTime = Date.now();
    
    // Capture meetingId at start so late-arriving chunks use the correct meeting
    const capturedMeetingId = this.meetingId;

    try {
      const currentChunkNumber = chunkNumber ?? this.chunkCount;
      console.log(`🖥️ Processing audio chunk ${currentChunkNumber} - audioChunks: ${this.audioChunks.length}, meetingId: ${capturedMeetingId}`);
      
      // No overlap buffer - process chunks as-is for timestamp-based deduplication
      const audioBlob = new Blob(this.audioChunks, { type: this.audioChunks[0].type });
      const blobMimeType = audioBlob.type || 'audio/webm';
      const blobSizeBytes = audioBlob.size;
      
      // Calculate chunk timing relative to recording start
      const chunkStartTimeSeconds = Math.round(this.totalProcessedDuration);
      const estimatedChunkDurationSeconds = Math.round(this.chunkIntervalMs / 1000);
      const chunkEndTimeSeconds = chunkStartTimeSeconds + estimatedChunkDurationSeconds;
      
      console.log(`🖥️ Audio blob size: ${blobSizeBytes} bytes, type: ${blobMimeType}`);
      
      // Update activity time when chunks are being sent (not just when results arrive)
      // This prevents false auto-stop when tab is backgrounded but audio is still flowing
      this.lastTranscriptActivityTime = Date.now();
      
      // Update watchdog timestamp — chunk successfully delivered
      this.lastChunkDeliveredAt = Date.now();
      this.chunkWatchdogRecoveryAttempts = 0; // Reset recovery counter on success
      
      // Periodic diagnostic log (every 5th chunk)
      if (this.chunkCounter % 5 === 0) {
        console.log(`📊 DIAG[chunk ${this.chunkCounter}]: MediaRecorder.state=${this.mediaRecorder?.state}, tracks=${this.stream?.getAudioTracks().map(t => t.readyState).join(',')}, AudioContext.state=${this.audioContext?.state}`);
      }
      this.chunkCounter++;
      
      this.audioChunks = []; // Clear current chunks after processing

      // Skip very small audio chunks - but don't increment chunk count
      if (audioBlob.size < 20000) {
        console.log(`🖥️ Skipping small audio chunk (${audioBlob.size} bytes) - no increment`);
        this.onChunkFiltered?.({
          text: '[too small]',
          confidence: 0,
          reason: `Audio too small: ${(blobSizeBytes / 1024).toFixed(1)}KB`,
          audioSizeBytes: blobSizeBytes,
          mimeType: blobMimeType,
          startTimeSeconds: chunkStartTimeSeconds,
          endTimeSeconds: chunkEndTimeSeconds,
          processingTimeMs: Date.now() - chunkProcessingStartTime
        });
        return;
      }

      // Convert blob to base64
      const arrayBuffer = await audioBlob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // Check audio quality before sending
      if (!this.checkAudioQuality(uint8Array)) {
        console.log(`🔇 Skipping low-quality audio chunk ${currentChunkNumber}`);
        this.onChunkFiltered?.({
          text: '[low quality audio]',
          confidence: 0,
          reason: 'Audio quality too low (silence/noise)',
          audioSizeBytes: blobSizeBytes,
          mimeType: blobMimeType,
          startTimeSeconds: chunkStartTimeSeconds,
          endTimeSeconds: chunkEndTimeSeconds,
          processingTimeMs: Date.now() - chunkProcessingStartTime
        });
        return;
      }
      
      // Convert to base64 in chunks to prevent memory issues
      let binary = '';
      const chunkSize = 0x8000;
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
        binary += String.fromCharCode.apply(null, Array.from(chunk));
      }
      const base64Audio = btoa(binary);

      console.log('📡 Sending desktop audio to Whisper API...');

      // Send to Whisper API with ChatGPT recommended parameters
      const { data, error } = await supabase.functions.invoke('speech-to-text', {
        body: { 
          audio: base64Audio,
          // ChatGPT recommended Whisper params
          temperature: 0.0,           // Deterministic
          language: "en",             // Don't auto-detect (UK accents + noisy rooms)
          condition_on_previous_text: false  // Prevent error snowballs
        }
      });

      if (error) {
        console.error('❌ Desktop Whisper API error:', error);
        
        // Provide more detailed error information to user
        let errorMessage = 'Transcription failed';
        if (error.message?.includes('FunctionsHttpError')) {
          errorMessage = 'Speech-to-text service temporarily unavailable. Retrying automatically...';
          console.log('🔄 API error detected, edge function will retry automatically');
        } else if (error.message?.includes('Network')) {
          errorMessage = 'Network connection issue. Please check your internet connection.';
        } else if (error.message?.includes('timeout')) {
          errorMessage = 'Transcription timeout. Please try speaking more clearly.';
        }
        
        this.onError(errorMessage);
        return;
      }

      if (data.text && data.text.trim()) {
        // ── Whisper Chunk Cleaner: strip repetition loops before any merge ──
        const cleanedResponse = cleanWhisperResponse(data);
        if (cleanedResponse.cleaningSummary?.totalWordsRemoved > 0) {
          console.log(`🧹 Desktop chunk ${currentChunkNumber}: cleaner removed ${cleanedResponse.cleaningSummary.totalWordsRemoved} words`);
        }
        // Use cleaned text for all downstream processing
        data.text = cleanedResponse.text;

        // ChatGPT recommended guardrails: check quality metrics
        const avgLogprob = data.avg_logprob ?? -0.3;
        const noSpeechProb = data.no_speech_prob ?? 0.0;
        const chunkConfidence = data.confidence ?? 0.5;
        
        console.log(`📊 Quality metrics - confidence: ${(chunkConfidence * 100).toFixed(1)}%, avg_logprob: ${avgLogprob.toFixed(3)}, no_speech_prob: ${noSpeechProb.toFixed(3)}`);
        
        const cleanText = data.text.trim();
        const chunkWordCount = cleanText.split(/\s+/).filter(w => w.length > 0).length;
        const chunkDurationSec = (chunkStartTimeSeconds !== undefined && chunkEndTimeSeconds !== undefined)
          ? chunkEndTimeSeconds - chunkStartTimeSeconds
          : 0;
        
        // Content-rich chunks (>=120 words or >=30s) are ALWAYS kept - downstream dedup handles repetition
        const isContentRich = chunkWordCount >= 120 || chunkDurationSec >= 30;
        
        if (isContentRich && (chunkConfidence < 0.25 || noSpeechProb > 0.85)) {
          console.log(`✅ Content-rich Whisper chunk retained (${chunkWordCount} words, ${chunkDurationSec.toFixed(1)}s) despite confidence ${(chunkConfidence * 100).toFixed(1)}% - downstream dedup will handle`);
        }
        
        // Hallucination detection based on LEXICAL signals only — confidence is NOT a rejection signal.
        // Low-confidence chunks that are lexically diverse and coherent are always retained.
        
        // Calculate lexical diversity for this chunk
        const chunkWords = cleanText.toLowerCase().split(/\s+/).filter(w => w.length > 0);
        const chunkUniqueWords = new Set(chunkWords).size;
        const chunkUniqueRatio = chunkWords.length > 0 ? chunkUniqueWords / chunkWords.length : 1;
        const isLexicallyDiverse = chunkUniqueRatio >= 0.25 || isContentRich;
        
        // High no_speech_prob: only reject if ALSO not lexically diverse
        if (noSpeechProb > 0.85 && !isLexicallyDiverse) {
          console.log(`🚫 Rejecting chunk: high no_speech_prob (${(noSpeechProb * 100).toFixed(1)}%) AND low lexical diversity (${(chunkUniqueRatio * 100).toFixed(0)}%)`);
          this.onChunkFiltered?.({
            text: cleanText || '[silence/noise]',
            confidence: chunkConfidence,
            noSpeechProb,
            avgLogprob,
            reason: `High no_speech_prob + low lexical diversity (${(chunkUniqueRatio * 100).toFixed(0)}%)`,
            audioSizeBytes: blobSizeBytes,
            mimeType: blobMimeType,
            startTimeSeconds: chunkStartTimeSeconds,
            endTimeSeconds: chunkEndTimeSeconds,
            processingTimeMs: Date.now() - chunkProcessingStartTime
          });
          return;
        }
        
        // Log low confidence as informational only
        if (chunkConfidence < 0.25) {
          console.log(`ℹ️ Low confidence ${(chunkConfidence * 100).toFixed(1)}% but lexical diversity ${(chunkUniqueRatio * 100).toFixed(0)}% — retaining chunk`);
        }
        
        // Use comprehensive hallucination detection (repetition patterns, known phrases)
        // This does NOT use confidence as a gating signal
        if (this.isLikelyRepetitiveNoise(cleanText, chunkConfidence) && !isContentRich) {
          console.log('🚫 Skipping likely hallucinated/repetitive chunk (lexical pattern match)');
          this.onChunkFiltered?.({
            text: cleanText,
            confidence: chunkConfidence,
            noSpeechProb,
            avgLogprob,
            reason: 'Hallucination detected (repetitive/noise pattern)',
            audioSizeBytes: blobSizeBytes,
            mimeType: blobMimeType,
            startTimeSeconds: chunkStartTimeSeconds,
            endTimeSeconds: chunkEndTimeSeconds,
            processingTimeMs: Date.now() - chunkProcessingStartTime
          });
          return;
        }
        
        // Dead-giveaway phrase check — only reject if text contains obvious hallucination phrases
        // AND chunk is not lexically diverse (genuine speech won't have these phrases with diverse content)
        if (!isLexicallyDiverse) {
          const lowerText = cleanText.toLowerCase();
          const deadGiveaways = ['thank you for watching', 'please subscribe', 'like and subscribe',
            'see you in the next video', 'link in the description'];
          const hasDeadGiveaway = deadGiveaways.some(p => lowerText.includes(p));
          if (hasDeadGiveaway) {
            console.log(`🚫 Rejecting chunk with dead-giveaway phrase + low diversity: "${cleanText.substring(0, 50)}..."`);
            this.onChunkFiltered?.({
              text: cleanText,
              confidence: chunkConfidence,
              noSpeechProb,
              avgLogprob,
              reason: `Dead-giveaway hallucination phrase + low lexical diversity`,
              audioSizeBytes: blobSizeBytes,
              mimeType: blobMimeType,
              startTimeSeconds: chunkStartTimeSeconds,
              endTimeSeconds: chunkEndTimeSeconds,
              processingTimeMs: Date.now() - chunkProcessingStartTime
            });
            return;
          }
        }

        // Use smart merge with de-duplication to avoid duplicates
        this.finalTranscript = this.smartMerge(this.finalTranscript, cleanText);
        
        // Store transcription internally
        this.allTranscriptions.push(cleanText);
        console.log(`📝 Stored transcription ${this.allTranscriptions.length}: "${cleanText.substring(0, 100)}..."`);
        console.log(`📝 Final transcript length: ${this.finalTranscript.length} chars`);
        
        // Store in database if meeting ID is set - use timestamp-based segments
        // Guard: skip DB write if transcriber has been stopped (prevents crossover into next meeting)
        if (this.stopped) {
          console.log(`🛑 Skipping DB write for chunk ${currentChunkNumber} -- transcriber stopped (crossover prevention)`);
        } else if (capturedMeetingId) {
          try {
            // DIAGNOSTIC FIX: Create synthetic segment if missing
            if (!data.segments || data.segments.length === 0) {
              console.log('⚠️ No segments from API, creating synthetic segment');
              data.segments = [{
                start: this.lastSegmentEndTime,
                end: this.lastSegmentEndTime + 1,
                text: cleanText
              }];
            }
            
            console.log(`📦 Desktop received ${data.segments.length} segments from API`);
            
            // Calculate time offset - segments from Whisper are relative to the chunk, not the recording
            const timeOffset = this.totalProcessedDuration;
            console.log(`⏰ Applying time offset: ${timeOffset.toFixed(2)}s to ${data.segments.length} segments`);
            
            // Apply time offset to all segments
            const offsetSegments = data.segments.map((seg: any) => ({
              start: seg.start + timeOffset,
              end: seg.end + timeOffset,
              text: seg.text.trim()
            }));
            
            // Filter segments that are after our last stored end time
            // For first chunk (lastSegmentEndTime === 0), accept all segments
            const newSegments = offsetSegments
              .filter((seg: any) => this.lastSegmentEndTime === 0 || seg.end > this.lastSegmentEndTime);
            
            console.log(`⏱️ Desktop chunk ${currentChunkNumber} - offset: ${timeOffset.toFixed(2)}s, lastEndTime: ${this.lastSegmentEndTime.toFixed(2)}s, filtered segments: ${newSegments.length}/${data.segments.length}`);
            
            if (newSegments.length > 0) {
              const { error: dbError } = await supabase
                .from('meeting_transcription_chunks')
                .insert({
                  meeting_id: capturedMeetingId,
                  session_id: this.sessionId,
                  chunk_number: currentChunkNumber,
                  transcription_text: JSON.stringify(newSegments), // Store segments as JSON
                  confidence: data.confidence || 0.9,
                  is_final: true,
                  user_id: (await supabase.auth.getUser()).data.user?.id,
                  transcriber_type: 'whisper', // Explicit type to prevent confusion with legacy
                  merge_rejection_reason: null
                });

              if (dbError) {
                console.error('❌ Failed to store segments in database:', dbError);
              } else {
                // Update last end time to the latest segment
                this.lastSegmentEndTime = Math.max(...newSegments.map((s: any) => s.end));
                // Update total processed duration (add the duration of this chunk)
                const chunkDuration = Math.max(...offsetSegments.map((s: any) => s.end)) - timeOffset;
                this.totalProcessedDuration += chunkDuration;
                console.log(`💾 Stored ${newSegments.length} segments in chunk ${currentChunkNumber}, lastEndTime now: ${this.lastSegmentEndTime.toFixed(2)}s, totalDuration: ${this.totalProcessedDuration.toFixed(2)}s`);
              }
            } else {
              const filteredCount = data.segments.length - newSegments.length;
              const rejectionReason = `All segments already processed (filtered ${filteredCount} duplicate${filteredCount !== 1 ? 's' : ''})`;
              console.log(`⏭️ Chunk ${currentChunkNumber}: ${rejectionReason}`);
              
              // Save the chunk with rejection reason for tracking
              await supabase
                .from('meeting_transcription_chunks')
                .insert({
                  meeting_id: capturedMeetingId,
                  session_id: this.sessionId,
                  chunk_number: currentChunkNumber,
                  transcription_text: JSON.stringify([]), // Empty segments array
                  confidence: data.confidence || 0.9,
                  is_final: true,
                  user_id: (await supabase.auth.getUser()).data.user?.id,
                  transcriber_type: 'whisper', // Explicit type to prevent confusion with legacy
                  merge_rejection_reason: rejectionReason
                });
            }
          } catch (error) {
            console.error('❌ Database storage error:', error);
          }
        }
        
        const transcriptData: TranscriptData = {
          text: cleanText,
          is_final: true,
          confidence: data.confidence || 0.9, // Use actual confidence from API
          speaker: 'Speaker'
        };

        // Phase 3: Apply confidence gating but always send to UI for user feedback
        console.log('📊 Desktop transcription quality check:', {
          text: cleanText.substring(0, 50) + '...',
          confidence: transcriptData.confidence,
          threshold: this.meetingSettings.transcriberThresholds[this.meetingSettings.transcriberService],
          meetsThreshold: meetsConfidenceThreshold(transcriptData.confidence, this.meetingSettings)
        });

        // Always send transcription to UI for better user experience
        console.log('✅ Desktop transcription sent to UI:', cleanText);
        this.onTranscription(transcriptData);
        
        // Update activity timestamp for silence auto-stop detection
        this.lastTranscriptActivityTime = Date.now();
        
        // Notify watchdog that a chunk was successfully processed
        if (this.onChunkProcessed) {
          this.onChunkProcessed({
            text: cleanText,
            confidence: transcriptData.confidence,
            speaker: transcriptData.speaker,
            audioSizeBytes: blobSizeBytes,
            mimeType: blobMimeType,
            startTimeSeconds: chunkStartTimeSeconds,
            endTimeSeconds: chunkEndTimeSeconds,
            processingTimeMs: Date.now() - chunkProcessingStartTime
          });
        }

        // Log quality for analysis but don't block user interface
        if (!meetsConfidenceThreshold(transcriptData.confidence, this.meetingSettings)) {
          console.log(`ℹ️ Low-confidence desktop transcription (still shown to user): ${transcriptData.confidence} < ${this.meetingSettings.transcriberThresholds[this.meetingSettings.transcriberService]}`);
        }
      }

    } catch (error) {
      console.error('❌ Error processing desktop audio:', error);
      this.onError('Failed to process audio');
    }
  }

  async stopTranscription(): Promise<void> {
    console.log('🛑 Stopping desktop Whisper transcription...');
    
    // CRITICAL: Set stopped flag FIRST to prevent late DB writes from bleeding into next meeting
    this.stopped = true;
    
    // CRITICAL: Set isRecording to false FIRST to prevent race conditions
    // This ensures no new chunks are started while we process the final one
    this.isRecording = false;
    this.onStatusChange('Processing final transcript...');
    
    // Stop audio activity monitoring
    this.stopActivityMonitoring();
    
    // Stop track health monitoring
    this.stopTrackMonitoring();
    
    // Stop chunk watchdog and page lifecycle listeners
    this.stopChunkWatchdog();
    this.removePageLifecycleListeners();
    
    // Release Wake Lock
    await this.releaseWakeLock();
    
    // Cleanup Web Worker and visibility handler
    this.cleanupChunkTimerWorker();
    this.removeVisibilityHandler();
    
    if (this.transcriptionTimeout) {
      clearTimeout(this.transcriptionTimeout);
      this.transcriptionTimeout = null;
    }

    // Stop recording and wait for final ondataavailable + processAudioChunks
    // to complete. The original 5s Promise.race timeout was the truncation
    // root cause: a typical 60-90s final audio chunk takes 5-10s for OpenAI
    // Whisper to transcribe (sometimes more on retry), so a 5s race always
    // lost. We now allow up to 60s, which comfortably covers a normal final
    // chunk plus one network retry, and still bounds the total stop time.
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      console.log('🔄 Stopping final recording chunk...');
      
      // Create a promise that resolves only after the original onstop
      // handler has finished its async work (i.e. processAudioChunks has
      // returned, meaning the final transcript callback has fired).
      const stopPromise = new Promise<void>((resolve) => {
        const originalOnStop = this.mediaRecorder!.onstop;
        this.mediaRecorder!.onstop = async (event) => {
          try {
            if (originalOnStop && typeof originalOnStop === 'function') {
              await (originalOnStop as (ev: Event) => Promise<void>)(event);
            }
          } finally {
            resolve();
          }
        };
      });
      
      this.mediaRecorder.stop();
      
      // Wait up to 60s for final chunk to be transcribed and stored.
      // This is bounded so a hung OpenAI call cannot freeze the UI forever.
      await Promise.race([
        stopPromise,
        new Promise(resolve => setTimeout(resolve, 60000))
      ]);
      
      // Brief settle-time for any subsequent state writes triggered by
      // the final transcription callback.
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Force process any remaining audio chunks and wait for completion
    console.log(`🔍 DEBUG: Checking for remaining chunks - audioChunks.length: ${this.audioChunks.length}`);
    if (this.audioChunks.length > 0) {
      // Increment chunk count BEFORE processing to ensure unique numbering
      const finalChunk = this.chunkCount++;
      console.log(`🔄 Processing final audio chunk ${finalChunk} (${this.audioChunks.length} audio chunks)...`);
      this.onStatusChange('Processing final transcript...');
      await this.processAudioChunks(finalChunk);
      console.log(`🔍 DEBUG: Final chunk ${finalChunk} processed and stored`);
      // Wait for transcription callback and database save
      await new Promise(resolve => setTimeout(resolve, 3000));
    } else {
      console.log('🔍 DEBUG: No remaining audio chunks to process');
    }

    // Wait for any pending database operations to complete
    console.log('🔍 DEBUG: Waiting for pending database operations...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    this.mediaRecorder = null;
    this.audioChunks = [];
    this.overlapBuffer = [];
    this.chunkCount = 0;
    this.onStatusChange('Stopped');
    
    console.log('✅ Desktop Whisper transcription fully stopped');
  }

  isActive(): boolean {
    return this.isRecording;
  }

  getCompleteTranscript(): string {
    console.log(`📋 Getting complete transcript from ${this.allTranscriptions.length} chunks`);
    console.log(`📋 Using smart-merged transcript: ${this.finalTranscript.length} characters`);
    
    // Return the smart-merged transcript instead of simple join
    return this.finalTranscript || this.allTranscriptions.join(' ').trim();
  }

  async getCompleteTranscriptFromDatabase(): Promise<string> {
    if (!this.meetingId) {
      console.log('📋 No meeting ID set, falling back to memory transcript');
      return this.getCompleteTranscript();
    }

    try {
      console.log(`📋 Getting complete transcript from database for meeting ${this.meetingId}, session ${this.sessionId}`);
      
      const { data, error } = await supabase
        .from('meeting_transcription_chunks')
        .select('transcription_text, chunk_number')
        .eq('meeting_id', this.meetingId)
        .eq('session_id', this.sessionId)
        .order('chunk_number');

      if (error) {
        console.error('❌ Failed to get transcript from database:', error);
        return this.getCompleteTranscript(); // Fallback to memory
      }

      if (!data || data.length === 0) {
        console.log('📋 No transcript chunks found in database, using memory transcript');
        return this.getCompleteTranscript();
      }

      const completeText = data.map(chunk => chunk.transcription_text).join(' ').trim();
      console.log(`🔍 DEBUG: Database transcript direct query: ${completeText.length} chars, ${data.length} chunks`);
      console.log(`🔍 DEBUG: Chunk details: [${data.map((chunk, i) => `"Chunk ${chunk.chunk_number}: ${chunk.transcription_text.substring(0, 50)}..."`).join(', ')}]`);
      console.log(`📋 Database transcript ending: "${completeText.slice(-200)}"`);
      
      return completeText;
    } catch (error) {
      console.error('❌ Error getting transcript from database:', error);
      return this.getCompleteTranscript(); // Fallback to memory
    }
  }

  clearTranscriptions(): void {
    this.allTranscriptions = [];
    this.finalTranscript = '';
    console.log('🧹 Cleared internal transcriptions and final transcript');
  }

  getSessionId(): string {
    return this.sessionId;
  }
}
