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

  constructor(
    private onTranscription: (data: TranscriptData) => void,
    private onError: (error: string) => void,
    private onStatusChange: (status: string) => void,
    meetingSettings?: any,
    meetingId?: string,
    private onAudioActivity?: (hasActivity: boolean) => void
  ) {
    this.meetingSettings = withDefaultThresholds(meetingSettings);
    if (meetingId) {
      this.meetingId = meetingId;
      this.sessionId = meetingId;
    }
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
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000, // Whisper works well with 16kHz
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false, // Disable AGC to reduce pumping/hallucinations
        }
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
      // Build valid M4A: always prepend header + new chunks
      // This ensures all audio blobs sent to Whisper have proper container structure
      const chunksToProcess = this.headerChunk 
        ? [this.headerChunk, ...newChunks.filter(c => c !== this.headerChunk)]
        : newChunks;
      
      const audioBlob = new Blob(chunksToProcess, { 
        type: this.selectedMimeType || 'audio/mp4' 
      });
      
      console.log(`📏 New audio blob: ${audioBlob.size} bytes from ${newChunks.length} new chunks`);

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

      console.log('📡 Sending NEW audio segment to Whisper API...');

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

      const transcribedText = data.text.trim();
      
      // Check for hallucination
      if (this.isHallucination(transcribedText)) {
        console.warn('⚠️ Hallucination detected, skipping chunk:', transcribedText.substring(0, 100));
        this.lastProcessedChunkIndex = this.fullRecordingChunks.length;
        return;
      }
      
      if (transcribedText) {
        console.log(`📝 Transcription (${transcribedText.split(/\s+/).length} words): "${transcribedText.substring(0, 80)}..."`);
        
        // Emit to UI
        const transcriptData: TranscriptData = {
          text: transcribedText,
          is_final: true,
          confidence: data.confidence || 0.9,
          speaker: 'Speaker'
        };
        
        this.onTranscription(transcriptData);
        
        // Update word count
        const newWordCount = transcribedText.split(/\s+/).filter(Boolean).length;
        this.totalWordCount += newWordCount;
        console.log(`📊 Word count: +${newWordCount} words (total: ${this.totalWordCount})`);
        
        // Store segments in database
        try {
          this.chunkCounter += 1;
          const currentChunkNumber = this.chunkCounter;
          const user = (await supabase.auth.getUser()).data.user?.id;
          
          if (this.meetingId && this.sessionId && user) {
            // Create synthetic segment if missing
            if (!data.segments || data.segments.length === 0) {
              console.log('⚠️ No segments from API, creating synthetic segment');
              data.segments = [{
                start: this.lastSegmentEndTime,
                end: this.lastSegmentEndTime + 1,
                text: transcribedText
              }];
            }
            
            console.log(`📦 Received ${data.segments.length} segments from API`);
            
            // Calculate time offset
            const timeOffset = this.totalProcessedDuration;
            console.log(`⏰ Applying time offset: ${timeOffset.toFixed(2)}s to ${data.segments.length} segments`);
            
            // Apply time offset to all segments
            const offsetSegments = data.segments.map((seg: any) => ({
              start: seg.start + timeOffset,
              end: seg.end + timeOffset,
              text: seg.text.trim()
            }));
            
            // Filter segments that are after our last stored end time
            const newSegments = offsetSegments
              .filter((seg: any) => this.lastSegmentEndTime === 0 || seg.end > this.lastSegmentEndTime);
            
            console.log(`⏱️ Chunk ${currentChunkNumber} - offset: ${timeOffset.toFixed(2)}s, lastEndTime: ${this.lastSegmentEndTime.toFixed(2)}s, filtered segments: ${newSegments.length}/${data.segments.length}`);
            
            if (newSegments.length > 0) {
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
                // Update last end time to the latest segment
                this.lastSegmentEndTime = Math.max(...newSegments.map((s: any) => s.end));
                // Update total processed duration
                const chunkDuration = Math.max(...offsetSegments.map((s: any) => s.end)) - timeOffset;
                this.totalProcessedDuration += chunkDuration;
                console.log(`💾 Stored ${newSegments.length} segments in chunk #${currentChunkNumber}, lastEndTime: ${this.lastSegmentEndTime.toFixed(2)}s, totalDuration: ${this.totalProcessedDuration.toFixed(2)}s`);
              }
            }
          } else {
            console.warn('ℹ️ Skipping DB store: missing meetingId/sessionId/user');
          }
        } catch (e) {
          console.warn('⚠️ Error while saving segments to DB:', e);
        }
      }
      
      // Mark these chunks as processed
      const processedChunks = this.fullRecordingChunks.slice(0, this.fullRecordingChunks.length);
      this.lastProcessedChunkIndex = this.fullRecordingChunks.length;
      
      // Upload and clear processed chunks to free memory
      await this.uploadAndClearProcessedChunks(processedChunks);
      const clearedCount = this.fullRecordingChunks.length;
      this.fullRecordingChunks = []; // Clear memory (header preserved separately)
      this.lastProcessedChunkIndex = 0; // Reset index since array is now empty
      
      console.log(`✅ Processed ${newChunks.length} chunks, cleared ${clearedCount} from memory (header preserved)`);
      
    } catch (error) {
      console.error('❌ processNewAudioChunks error:', error);
      this.onError('Failed to process audio');
    }
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
    this.isRecording = false;
    
    // Stop audio activity monitoring
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
      this.mediaRecorder.stop();
      
      // Wait for final ondataavailable to fire
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Process any remaining new audio chunks
      if (this.fullRecordingChunks.length > this.lastProcessedChunkIndex) {
        console.log('🔄 Processing final new audio chunks...');
        await this.processNewAudioChunks();
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

    console.log(`✅ iPhone transcription stopped. ${this.backupChunkCounter} backup chunks uploaded during recording.`);
    this.onStatusChange('Stopped');
  }

  isActive(): boolean {
    return this.isRecording;
  }
}
