import { supabase } from "@/integrations/supabase/client";
import { hasAudioActivity, getOptimalChunkInterval, OPTIMAL_CHUNK_DURATION } from './audioLevelDetection';
import { meetsConfidenceThreshold, withDefaultThresholds, type MeetingSettingsWithThresholds } from './confidenceGating';

export interface TranscriptData {
  text: string;
  is_final: boolean;
  confidence: number;
  speaker: string;
}

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
  private lastSegmentEndTime = 0; // Track the last segment end time to avoid duplicates
  private totalProcessedDuration = 0; // Track cumulative audio duration for time offset
  private finalTranscript = ''; // Accumulated transcript for UI
  private lastProcessedChunkIndex = 0; // Track which chunks we've already processed
  private backupChunkCounter = 0; // Track incremental backup uploads
  private headerChunk: Blob | null = null; // Preserve M4A header for valid audio files

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
  private readonly SILENCE_DURATION_MS = 1500; // 1.5 seconds of silence triggers flush
  private readonly MIN_CHUNK_DURATION_MS = 2000; // Minimum 2 seconds before flushing

  private selectedMimeType: string = 'audio/webm';

  // Auto-recovery for iOS background throttling
  private lastSuccessfulTranscriptionTime = 0;
  private autoRecoveryAttempts = 0;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private readonly AUTO_RECOVERY_THRESHOLD_MS = 45000; // 45 seconds without transcription
  private readonly MAX_AUTO_RECOVERY_ATTEMPTS = 3;
  private onRecoveryAttempt?: () => void;

  constructor(
    private onTranscription: (data: TranscriptData) => void,
    private onError: (error: string) => void,
    private onStatusChange: (status: string) => void,
    meetingSettings?: any,
    meetingId?: string,
    private onAudioActivity?: (hasActivity: boolean) => void,
    private selectedDeviceId?: string | null,
    onRecoveryAttempt?: () => void
  ) {
    this.meetingSettings = withDefaultThresholds(meetingSettings);
    this.onRecoveryAttempt = onRecoveryAttempt;
    if (meetingId) {
      this.meetingId = meetingId;
      this.sessionId = meetingId;
    }
  }

  /**
   * Set callback for recovery attempts (called when auto-recovery kicks in)
   */
  public setRecoveryCallback(callback: () => void) {
    this.onRecoveryAttempt = callback;
  }

  /**
   * Start health monitoring for auto-recovery
   * Detects when transcription has stalled and attempts automatic recovery
   */
  private startHealthMonitoring() {
    // Clear any existing interval
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.lastSuccessfulTranscriptionTime = Date.now();
    this.autoRecoveryAttempts = 0;

    // Check every 15 seconds
    this.healthCheckInterval = setInterval(async () => {
      if (!this.isRecording) {
        this.stopHealthMonitoring();
        return;
      }

      const timeSinceLastTranscription = Date.now() - this.lastSuccessfulTranscriptionTime;
      
      if (timeSinceLastTranscription > this.AUTO_RECOVERY_THRESHOLD_MS) {
        console.warn(`⚠️ iPhone: No transcription for ${Math.round(timeSinceLastTranscription / 1000)}s - checking audio activity`);
        
        // Check if we're still capturing audio
        if (this.fullRecordingChunks.length > this.lastProcessedChunkIndex) {
          // We have unprocessed chunks - try to process them
          console.log('🔄 iPhone: Found unprocessed chunks, attempting recovery...');
          await this.attemptAutoRecovery();
        } else {
          console.log('⏸️ iPhone: No new audio chunks - possible background throttling');
        }
      }
    }, 15000);

    console.log('🏥 iPhone: Health monitoring started');
  }

  private stopHealthMonitoring() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    console.log('🏥 iPhone: Health monitoring stopped');
  }

  /**
   * Attempt automatic recovery when transcription appears stalled
   */
  private async attemptAutoRecovery() {
    if (this.autoRecoveryAttempts >= this.MAX_AUTO_RECOVERY_ATTEMPTS) {
      console.error('❌ iPhone: Max auto-recovery attempts reached');
      this.onError('Transcription stalled - tap to retry');
      return;
    }

    this.autoRecoveryAttempts++;
    console.log(`🔄 iPhone: Auto-recovery attempt ${this.autoRecoveryAttempts}/${this.MAX_AUTO_RECOVERY_ATTEMPTS}`);
    this.onStatusChange(`Recovering transcription (attempt ${this.autoRecoveryAttempts})...`);

    // Notify caller about recovery attempt
    this.onRecoveryAttempt?.();

    try {
      // Force process any pending chunks
      if (this.fullRecordingChunks.length > this.lastProcessedChunkIndex) {
        await this.processNewAudioChunks();
        this.onStatusChange('Recording...');
      }
    } catch (error) {
      console.error('❌ iPhone: Auto-recovery failed:', error);
    }
  }

  /**
   * Process any pending chunks that may have accumulated during background state
   * Call this when visibility is restored
   */
  public async processPendingChunks(): Promise<number> {
    const pendingCount = this.fullRecordingChunks.length - this.lastProcessedChunkIndex;
    
    if (pendingCount <= 0) {
      console.log('📱 iPhone: No pending chunks to process');
      return 0;
    }

    console.log(`📱 iPhone: Processing ${pendingCount} pending chunks after visibility restore`);
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

  /**
   * Mark successful transcription (resets recovery counter)
   */
  private markSuccessfulTranscription() {
    this.lastSuccessfulTranscriptionTime = Date.now();
    this.autoRecoveryAttempts = 0;
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
          this.fullRecordingChunks.length > this.lastProcessedChunkIndex &&
          this.isRecording) {
        console.log(`🔇 iPhone: Silence detected for ${(timeSinceLastSpeech/1000).toFixed(1)}s after ${(chunkDuration/1000).toFixed(1)}s of audio - processing early`);
        this.flushCurrentChunk();
      }
      
      this.silenceTimer = null;
    }, this.SILENCE_DURATION_MS);
  }
  
  /**
   * Flush current audio chunk early (triggered by silence detection)
   * Process available chunks immediately for faster feedback
   */
  private async flushCurrentChunk() {
    // Cancel any scheduled processing
    if (this.chunkTimeout) {
      clearTimeout(this.chunkTimeout);
      this.chunkTimeout = null;
    }
    
    // Process any new chunks immediately
    if (this.fullRecordingChunks.length > this.lastProcessedChunkIndex && this.isRecording) {
      console.log(`📤 iPhone: Processing early flush (${this.fullRecordingChunks.length - this.lastProcessedChunkIndex} new chunks)`);
      await this.processNewAudioChunks();
      
      // Reset chunk start time for next segment
      this.chunkStartTime = Date.now();
      this.lastSpeechTime = Date.now();
      
      // Resume scheduled processing
      this.scheduleNextProcessing();
    }
  }
  
  private scheduleNextProcessing() {
    if (!this.isRecording) return;
    
    // Schedule next processing at 60 second intervals (backup timer)
    this.chunkTimeout = setTimeout(async () => {
      if (this.isRecording && this.fullRecordingChunks.length > this.lastProcessedChunkIndex) {
        console.log(`📤 Processing scheduled audio chunks (${this.fullRecordingChunks.length - this.lastProcessedChunkIndex} new chunks)`);
        await this.processNewAudioChunks();
        this.chunkStartTime = Date.now();
        this.lastSpeechTime = Date.now();
        this.scheduleNextProcessing();
      }
    }, 60000); // 60 second backup interval
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
      console.log('📱 Starting iPhone Whisper transcription...');

      // Ensure session and meeting IDs for chunk storage and backups
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

      // Request microphone access with iPhone-optimized settings
      // Use selected device if provided
      const audioConstraints: MediaTrackConstraints = {
        sampleRate: 16000, // Whisper works well with 16kHz
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: false, // Disable AGC to reduce pumping/hallucinations
      };
      
      if (this.selectedDeviceId) {
        audioConstraints.deviceId = { exact: this.selectedDeviceId };
        console.log('🎤 Using selected microphone device:', this.selectedDeviceId);
      }
      
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints
      });
      
      // Set up audio activity monitoring for VAD-based silence detection
      // This is always enabled for smoother real-time transcription experience
      this.audioContext = new AudioContext({ sampleRate: 16000 });
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      
      const source = this.audioContext.createMediaStreamSource(this.stream);
      source.connect(this.analyser);
      
      // Start checking for audio activity (VAD + optional callback)
      this.startActivityMonitoring();

      // Check supported MIME types for iPhone
      const mimeTypes = [
        'audio/mp4;codecs=mp4a.40.2', // Prefer explicit AAC on iOS
        'audio/mp4',
        'audio/aac',
        'audio/webm;codecs=opus',
        'audio/webm'
      ];

      this.selectedMimeType = 'audio/webm'; // fallback
      for (const mimeType of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          this.selectedMimeType = mimeType;
          console.log('📱 Using MIME type:', mimeType);
          break;
        }
      }

      // Create single MediaRecorder that will run for entire session
      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: this.selectedMimeType,
        audioBitsPerSecond: 128000 // Higher bitrate to reduce artifacts on iOS
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          // Capture first chunk as M4A header (contains container metadata)
          if (!this.headerChunk) {
            this.headerChunk = event.data;
            console.log(`📦 iPhone: Captured M4A header chunk (${event.data.size} bytes)`);
          }
          console.log(`📦 iPhone MediaRecorder ondataavailable: ${event.data.size} bytes`);
          this.audioChunks.push(event.data);
          this.fullRecordingChunks.push(event.data);
        }
      };

      this.mediaRecorder.onerror = (event) => {
        console.error('📱 MediaRecorder error:', event);
        this.onError('Recording error occurred');
      };

      console.log('✅ Created single iPhone MediaRecorder instance with MIME type:', this.selectedMimeType);

      // Wait briefly for audio stream to fully initialize (prevents missing first seconds)
      await new Promise(resolve => setTimeout(resolve, 200));

      // Start recording and process in chunks
      this.isRecording = true;
      this.startChunkedRecording();
      
      // Start health monitoring for auto-recovery
      this.startHealthMonitoring();
      
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
    this.chunkStartTime = Date.now(); // Track for VAD minimum duration
    this.lastSpeechTime = Date.now(); // Assume starting with speech
    
    // Use timeslice to get regular ondataavailable events (5 seconds)
    // This is more reliable on iOS Safari than requestData()
    this.mediaRecorder.start(5000);  
    
    console.log('📱 iPhone MediaRecorder started with 5s timeslice + VAD silence detection');

    // First transcription after 15 seconds for quick feedback
    const FIRST_PROCESS_INTERVAL = 15000;
    
    this.chunkTimeout = setTimeout(async () => {
      if (this.isRecording && this.fullRecordingChunks.length > this.lastProcessedChunkIndex) {
        console.log(`📤 Processing FIRST audio chunks (${this.fullRecordingChunks.length - this.lastProcessedChunkIndex} new chunks)`);
        await this.processNewAudioChunks();
        this.chunkStartTime = Date.now();
        this.lastSpeechTime = Date.now();
        console.log('✅ First process complete, VAD will trigger subsequent flushes or 60s backup');
        
        // Schedule backup processing (VAD will trigger earlier if silence detected)
        this.scheduleNextProcessing();
      }
    }, FIRST_PROCESS_INTERVAL);
  }

  private async processNewAudioChunks() {
    const newChunks = this.fullRecordingChunks.slice(this.lastProcessedChunkIndex);
    if (newChunks.length === 0) return;

    try {
      // Build valid M4A: always prepend header + ALL accumulated chunks
      // iOS M4A format requires the header for proper decoding
      // We'll extract only the NEW text by comparing with previously transcribed content
      const allChunks = this.fullRecordingChunks;
      const chunksToProcess = this.headerChunk 
        ? [this.headerChunk, ...allChunks.filter(c => c !== this.headerChunk)]
        : allChunks;
      
      const audioBlob = new Blob(chunksToProcess, { 
        type: this.selectedMimeType || 'audio/mp4' 
      });
      
      console.log(`📏 Full audio blob: ${audioBlob.size} bytes from ${allChunks.length} total chunks (${newChunks.length} new)`);

      // Convert to base64
      const arrayBuffer = await audioBlob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // Convert to base64 in chunks to prevent memory issues
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

      console.log('📡 Sending audio to Whisper API...');

      // Send to Whisper
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
      
      // Check for hallucination
      if (this.isHallucination(fullTranscribedText)) {
        console.warn('⚠️ Hallucination detected, skipping chunk:', fullTranscribedText.substring(0, 100));
        this.lastProcessedChunkIndex = this.fullRecordingChunks.length;
        return;
      }
      
      // Extract only NEW text by removing what we've already transcribed
      const newText = this.extractNewText(fullTranscribedText, this.finalTranscript);
      
      if (newText) {
        console.log(`📝 NEW text (${newText.split(/\s+/).length} words): "${newText.substring(0, 80)}${newText.length > 80 ? '...' : ''}"`);
        console.log(`📝 Full transcript now: ${fullTranscribedText.split(/\s+/).length} words`);
        
        // Update our running transcript
        this.finalTranscript = fullTranscribedText;
        
        // Emit ONLY the new text to UI
        const transcriptData: TranscriptData = {
          text: newText,
          is_final: true,
          confidence: data.confidence || 0.9,
          speaker: 'Speaker'
        };
        
        this.onTranscription(transcriptData);
        
        // Mark successful transcription for health monitoring
        this.markSuccessfulTranscription();
        
        // Update word count (only for new words)
        const newWordCount = newText.split(/\s+/).filter(Boolean).length;
        this.totalWordCount += newWordCount;
        console.log(`📊 Word count: +${newWordCount} words (total: ${this.totalWordCount})`);
        
        // Store segments in database
        try {
          this.chunkCounter += 1;
          const currentChunkNumber = this.chunkCounter;
          const user = (await supabase.auth.getUser()).data.user?.id;
          
          if (this.meetingId && this.sessionId && user) {
            // Create synthetic segment for the new text only
            const newSegments = [{
              start: this.lastSegmentEndTime,
              end: this.lastSegmentEndTime + (newChunks.length * 5), // Approximate based on chunks
              text: newText
            }];
            
            console.log(`📦 Storing new segment: ${newText.length} chars`);
            
            const { error: dbError } = await supabase
              .from('meeting_transcription_chunks')
              .insert({
                meeting_id: this.meetingId,
                session_id: this.sessionId,
                chunk_number: currentChunkNumber,
                transcription_text: JSON.stringify(newSegments),
                confidence: transcriptData.confidence,
                is_final: true,
                user_id: user,
                merge_rejection_reason: null
              });
            
            if (dbError) {
              console.warn('⚠️ Failed to store segments:', dbError);
            } else {
              // Update last end time
              this.lastSegmentEndTime += newChunks.length * 5;
              console.log(`💾 Stored segment in chunk #${currentChunkNumber}, lastEndTime: ${this.lastSegmentEndTime.toFixed(2)}s`);
            }
          } else {
            console.warn('ℹ️ Skipping DB store: missing meetingId/sessionId/user');
          }
        } catch (e) {
          console.warn('⚠️ Error while saving segments to DB:', e);
        }
      } else {
        console.log('ℹ️ No new text detected in this chunk');
      }
      
      // Mark these chunks as processed (but don't clear - we need them for subsequent full transcriptions)
      this.lastProcessedChunkIndex = this.fullRecordingChunks.length;
      
      // Upload backup periodically
      if (this.fullRecordingChunks.length > 0 && this.chunkCounter % 3 === 0) {
        await this.uploadAndClearProcessedChunks([...this.fullRecordingChunks]);
      }
      
      console.log(`✅ Processed ${newChunks.length} new chunks, total accumulated: ${this.fullRecordingChunks.length}`);
      
    } catch (error) {
      console.error('❌ processNewAudioChunks error:', error);
      this.onError('Failed to process audio');
    }
  }
  
  /**
   * Extract only the NEW text from the full transcription by comparing with previous transcript
   * This handles iOS M4A format where we must send the full audio each time
   */
  private extractNewText(fullText: string, previousText: string): string {
    if (!previousText) return fullText;
    if (!fullText) return '';
    
    const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
    
    const fullNorm = normalise(fullText);
    const prevNorm = normalise(previousText);
    
    // If the full text starts with the previous text, extract the delta
    if (fullNorm.startsWith(prevNorm)) {
      // Find where the new content starts in the original (non-normalised) text
      const prevWords = previousText.split(/\s+/).filter(Boolean);
      const fullWords = fullText.split(/\s+/).filter(Boolean);
      
      // Find the point where new content begins
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
    
    // Fuzzy matching: find the longest suffix of previous that appears in full
    const prevWords = previousText.split(/\s+/).filter(Boolean);
    const fullWords = fullText.split(/\s+/).filter(Boolean);
    
    // Look for overlap point (where previous text ends in full text)
    for (let overlapLen = Math.min(prevWords.length, 20); overlapLen >= 3; overlapLen--) {
      const suffix = prevWords.slice(-overlapLen).map(w => normalise(w)).join(' ');
      
      for (let i = 0; i <= fullWords.length - overlapLen; i++) {
        const segment = fullWords.slice(i, i + overlapLen).map(w => normalise(w)).join(' ');
        if (segment === suffix) {
          // Found the overlap point - return everything after
          const newContent = fullWords.slice(i + overlapLen).join(' ');
          if (newContent) {
            console.log(`🔍 Found overlap at word ${i + overlapLen}, extracting ${fullWords.length - i - overlapLen} new words`);
            return newContent;
          }
        }
      }
    }
    
    // Fallback: if full text is longer, assume it's all new (edge case)
    if (fullWords.length > prevWords.length + 3) {
      console.log('⚠️ Could not find overlap, returning excess words as new');
      return fullWords.slice(prevWords.length).join(' ');
    }
    
    return '';
  }

  private isHallucination(text: string): boolean {
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length < 5) return false;
    
    // Check for repetition - less than 30% unique words = likely hallucination
    const uniqueWords = new Set(words.map(w => w.toLowerCase()));
    const uniqueRatio = uniqueWords.size / words.length;
    
    if (uniqueRatio < 0.3) {
      console.warn(`🚨 Hallucination detected: only ${(uniqueRatio * 100).toFixed(1)}% unique words`);
      return true;
    }
    
    return false;
  }

  private async uploadAndClearProcessedChunks(processedChunks: Blob[]) {
    // Upload mini-backup to storage
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId || !this.meetingId || processedChunks.length === 0) return;
    
    this.backupChunkCounter++;
    const chunkBlob = new Blob(processedChunks, { type: this.selectedMimeType });
    const ext = this.selectedMimeType.includes('mp4') ? 'm4a' : this.selectedMimeType.includes('aac') ? 'aac' : 'webm';
    const fileName = `${userId}/${this.meetingId}_chunk_${String(this.backupChunkCounter).padStart(3, '0')}.${ext}`;
    
    const { error } = await supabase.storage
      .from('meeting-audio-backups')
      .upload(fileName, chunkBlob, { contentType: this.selectedMimeType });
    
    if (!error) {
      console.log(`📤 Uploaded backup chunk #${this.backupChunkCounter} (${chunkBlob.size} bytes)`);
    } else {
      console.warn('⚠️ Failed to upload backup chunk:', error);
    }
  }

  private simpleSmartMerge(oldText: string, newText: string): string {
    if (!oldText) return newText;
    if (!newText) return oldText;
    
    // Simple tail overlap detection (12-20 words)
    const oldWords = oldText.trim().split(/\s+/);
    const newWords = newText.trim().split(/\s+/);
    const checkLength = Math.min(20, oldWords.length, newWords.length);
    
    for (let i = checkLength; i >= 3; i--) {
      const lastOld = oldWords.slice(-i).join(' ').toLowerCase();
      const firstNew = newWords.slice(0, i).join(' ').toLowerCase();
      
      // Simple similarity check
      if (lastOld === firstNew || this.fuzzyMatch(lastOld, firstNew)) {
        return oldText + " " + newWords.slice(i).join(' ');
      }
    }
    
    return oldText + " " + newText;
  }

  private fuzzyMatch(str1: string, str2: string): boolean {
    if (str1.length === 0 || str2.length === 0) return false;
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    const editDistance = this.levenshteinDistance(longer, shorter);
    const similarity = (longer.length - editDistance) / longer.length;
    return similarity > 0.7;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const m = str1.length;
    const n = str2.length;
    const d: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
    
    for (let i = 0; i <= m; i++) d[i][0] = i;
    for (let j = 0; j <= n; j++) d[0][j] = j;
    
    for (let j = 1; j <= n; j++) {
      for (let i = 1; i <= m; i++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        d[i][j] = Math.min(
          d[i - 1][j] + 1,
          d[i][j - 1] + 1,
          d[i - 1][j - 1] + cost
        );
      }
    }
    
    return d[m][n];
  }

  private isLikelyRepetitiveNoise(text: string): boolean {
    const t = text.toLowerCase().trim();
    if (/(?:\b(?:ha|haha|ha-ha|hee|hehe|lol|woo|beep)[\s,!.?-]*){6,}/i.test(t)) return true;
    const words = t.split(/\s+/).filter(Boolean);
    if (words.length >= 10) {
      const unique = new Set(words).size;
      if (unique / words.length < 0.4) return true;
    }
    return false;
  }

  async stopTranscription() {
    console.log('🛑 Stopping iPhone transcription...');
    
    // CRITICAL: Set isRecording to false FIRST to prevent race conditions
    this.isRecording = false;
    this.onStatusChange('Processing final transcript...');
    
    // Stop health monitoring and audio activity monitoring
    this.stopHealthMonitoring();
    this.stopActivityMonitoring();

    if (this.transcriptionInterval) {
      clearInterval(this.transcriptionInterval);
      this.transcriptionInterval = null;
    }
    // Clear scheduled chunk extraction
    if (this.chunkTimeout) {
      clearTimeout(this.chunkTimeout);
      this.chunkTimeout = null;
    }

    // Stop the recorder - this triggers final ondataavailable
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      console.log('🔄 Stopping MediaRecorder and waiting for final data...');
      
      // Create a promise that resolves when onstop fires
      const stopPromise = new Promise<void>((resolve) => {
        const recorder = this.mediaRecorder!;
        const originalOnStop = recorder.onstop;
        recorder.onstop = (event) => {
          if (originalOnStop && typeof originalOnStop === 'function') {
            originalOnStop.call(recorder, event);
          }
          resolve();
        };
      });
      
      this.mediaRecorder.stop();
      
      // Wait for onstop with timeout safety
      await Promise.race([
        stopPromise,
        new Promise(resolve => setTimeout(resolve, 3000))
      ]);
      
      // Wait longer for final ondataavailable to fire
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Process any remaining new audio chunks
      if (this.fullRecordingChunks.length > this.lastProcessedChunkIndex) {
        console.log('🔄 Processing final new audio chunks...');
        this.onStatusChange('Processing final transcript...');
        await this.processNewAudioChunks();
        // Wait for database operations
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    this.mediaRecorder = null;
    this.audioChunks = [];
    this.fullRecordingChunks = []; // Clear any remaining chunks
    this.headerChunk = null; // Clear header reference
    this.finalTranscript = ''; // Reset for next session
    this.lastProcessedChunkIndex = 0;

    console.log(`✅ iPhone transcription stopped. ${this.backupChunkCounter} backup chunks uploaded during recording.`);
    this.onStatusChange('Stopped');
  }

  isActive(): boolean {
    return this.isRecording;
  }
}
