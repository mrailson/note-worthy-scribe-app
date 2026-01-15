import { supabase } from "@/integrations/supabase/client";
import { hasAudioActivity, getOptimalChunkInterval, OPTIMAL_CHUNK_DURATION } from './audioLevelDetection';
import { meetsConfidenceThreshold, withDefaultThresholds, type MeetingSettingsWithThresholds } from './confidenceGating';

export interface TranscriptData {
  text: string;
  is_final: boolean;
  confidence: number;
  speaker: string;
}

export class DesktopWhisperTranscriber {
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private isRecording = false;
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
  private readonly SILENCE_DURATION_MS = 1500; // 1.5 seconds of silence triggers flush
  private readonly MIN_CHUNK_DURATION_MS = 2000; // Minimum 2 seconds before flushing

  constructor(
    private onTranscription: (data: TranscriptData) => void,
    private onError: (error: string) => void,
    private onStatusChange: (status: string) => void,
    meetingSettings?: any,
    meetingId?: string,
    private onAudioActivity?: (hasActivity: boolean) => void,
    private onChunkProcessed?: () => void,
    private selectedDeviceId?: string | null,
    private externalStream?: MediaStream | null // Allow passing pre-configured stream (e.g., mixed mic + browser audio)
  ) {
    this.sessionId = meetingId || this.generateSessionId();
    this.meetingId = meetingId || null;
    this.chunkIntervalMs = 25000; // Phase 2: Optimized chunk duration for better transcription
    this.meetingSettings = withDefaultThresholds(meetingSettings);
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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

      // Check supported MIME types for desktop
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/mp4;codecs=mp4a.40.2',
        'audio/aac'
      ];

      let selectedMimeType = 'audio/webm'; // fallback
      for (const mimeType of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType;
          console.log('🖥️ Using MIME type:', mimeType);
          break;
        }
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

    this.transcriptionTimeout = setTimeout(() => {
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
    }, nextInterval);
  }

  private async processAudioChunks(chunkNumber?: number) {
    if (this.audioChunks.length === 0) return;

    try {
      const currentChunkNumber = chunkNumber ?? this.chunkCount;
      console.log(`🖥️ Processing audio chunk ${currentChunkNumber} - audioChunks: ${this.audioChunks.length}, meetingId: ${this.meetingId}`);
      
      // No overlap buffer - process chunks as-is for timestamp-based deduplication
      const audioBlob = new Blob(this.audioChunks, { type: this.audioChunks[0].type });
      console.log(`🖥️ Audio blob size: ${audioBlob.size} bytes`);
      
      this.audioChunks = []; // Clear current chunks after processing

      // Skip very small audio chunks - but don't increment chunk count
      if (audioBlob.size < 20000) {
        console.log(`🖥️ Skipping small audio chunk (${audioBlob.size} bytes) - no increment`);
        return;
      }

      // Convert blob to base64
      const arrayBuffer = await audioBlob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // Check audio quality before sending
      if (!this.checkAudioQuality(uint8Array)) {
        console.log(`🔇 Skipping low-quality audio chunk ${currentChunkNumber}`);
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
        // ChatGPT recommended guardrails: check quality metrics
        const avgLogprob = data.avg_logprob ?? -0.3;
        const noSpeechProb = data.no_speech_prob ?? 0.0;
        
        console.log(`📊 Quality metrics - avg_logprob: ${avgLogprob.toFixed(3)}, no_speech_prob: ${noSpeechProb.toFixed(3)}`);
        
        // Previously we hard-gated on these and dropped chunks.
        // For completeness (especially in Mic + System mode), we now only LOG
        // suspicious chunks but still pass them through so we don't lose speech.
        if (avgLogprob < -1.5) {
          console.log(`⚠️ Low avg_logprob (likely noisy / hard to hear), but keeping chunk for completeness`);
        }
        
        if (noSpeechProb > 0.9) {
          console.log(`⚠️ High no_speech_prob (model not confident speech is present), but keeping chunk for completeness`);
        }
        
        const cleanText = data.text.trim();
        
        // Skip only clearly hallucinated/repetitive noise chunks (e.g., endless "ha ha ha")
        if (this.isLikelyRepetitiveNoise(cleanText)) {
          console.log('🚫 Skipping likely hallucinated/repetitive chunk');
          return;
        }

        // Use smart merge with de-duplication to avoid duplicates
        this.finalTranscript = this.smartMerge(this.finalTranscript, cleanText);
        
        // Store transcription internally
        this.allTranscriptions.push(cleanText);
        console.log(`📝 Stored transcription ${this.allTranscriptions.length}: "${cleanText.substring(0, 100)}..."`);
        console.log(`📝 Final transcript length: ${this.finalTranscript.length} chars`);
        
        // Store in database if meeting ID is set - use timestamp-based segments
        if (this.meetingId) {
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
                  meeting_id: this.meetingId,
                  session_id: this.sessionId,
                  chunk_number: currentChunkNumber,
                  transcription_text: JSON.stringify(newSegments), // Store segments as JSON
                  confidence: data.confidence || 0.9,
                  is_final: true,
                  user_id: (await supabase.auth.getUser()).data.user?.id,
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
                  meeting_id: this.meetingId,
                  session_id: this.sessionId,
                  chunk_number: currentChunkNumber,
                  transcription_text: JSON.stringify([]), // Empty segments array
                  confidence: data.confidence || 0.9,
                  is_final: true,
                  user_id: (await supabase.auth.getUser()).data.user?.id,
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
        
        // Notify watchdog that a chunk was successfully processed
        if (this.onChunkProcessed) {
          this.onChunkProcessed();
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
    
    // CRITICAL: Set isRecording to false FIRST to prevent race conditions
    // This ensures no new chunks are started while we process the final one
    this.isRecording = false;
    this.onStatusChange('Processing final transcript...');
    
    // Stop audio activity monitoring
    this.stopActivityMonitoring();
    
    if (this.transcriptionTimeout) {
      clearTimeout(this.transcriptionTimeout);
      this.transcriptionTimeout = null;
    }

    // Stop recording and wait for final ondataavailable event using promise
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      console.log('🔄 Stopping final recording chunk...');
      
      // Create a promise that resolves when onstop fires
      const stopPromise = new Promise<void>((resolve) => {
        const originalOnStop = this.mediaRecorder!.onstop;
        this.mediaRecorder!.onstop = async (event) => {
          // Call original handler first (processes the chunks)
          if (originalOnStop && typeof originalOnStop === 'function') {
            await (originalOnStop as (ev: Event) => Promise<void>)(event);
          }
          resolve();
        };
      });
      
      this.mediaRecorder.stop();
      
      // Wait for onstop to complete (with timeout safety)
      await Promise.race([
        stopPromise,
        new Promise(resolve => setTimeout(resolve, 5000)) // 5 second timeout
      ]);
      
      // Additional wait for final ondataavailable processing
      await new Promise(resolve => setTimeout(resolve, 1000));
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
