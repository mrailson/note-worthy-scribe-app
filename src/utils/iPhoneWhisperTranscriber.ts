import { supabase } from "@/integrations/supabase/client";
import { hasAudioActivity, getOptimalChunkInterval, OPTIMAL_CHUNK_DURATION } from './audioLevelDetection';
import { meetsConfidenceThreshold, withDefaultThresholds, type MeetingSettingsWithThresholds } from './confidenceGating';
import { UnifiedTranscriptProcessor } from './UnifiedTranscriptProcessor';

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
  private overlapBuffer: Blob[] = [];
  private chunkTimeout: ReturnType<typeof setTimeout> | null = null;
  private recordingStartTime = 0;
  private lastIntervalMs = 0;
  private meetingId: string | null = null;
  private sessionId: string | null = null;
  private chunkCounter = 0;
  private totalWordCount = 0;
  private meetingSettings: MeetingSettingsWithThresholds;
  private unifiedProcessor: UnifiedTranscriptProcessor;

  constructor(
    private onTranscription: (data: TranscriptData) => void,
    private onError: (error: string) => void,
    private onStatusChange: (status: string) => void,
    meetingSettings?: any
  ) {
    this.meetingSettings = withDefaultThresholds(meetingSettings);
    
    // Initialize unified processor with iPhone-optimized settings
    this.unifiedProcessor = new UnifiedTranscriptProcessor(
      this.meetingSettings,
      {
        enableConfidenceGating: true,
        enableAdvancedDeduplication: true,
        enableLegacyCompatibility: false,
        deduplicationConfig: {
          sentenceWindow: 3, // Smaller window for more frequent chunks
          semanticThreshold: 0.85, // Slightly lower threshold for mobile environment
          chunkOverlapThreshold: 0.78,
          temporalGapMs: 2000, // 2 second gap for iPhone chunk processing
          retroactiveCleaningEnabled: true,
          maxLookbackSentences: 10
        }
      },
      {
        onChunkFiltered: (chunk, reason) => {
          console.log(`📱 iPhone chunk filtered: ${reason} - "${chunk.text?.substring(0, 40)}..."`);
        },
        onDeduplicationStats: (stats) => {
          if (stats.segmentsRemoved > 0) {
            console.log(`📱 iPhone deduplication: Removed ${stats.segmentsRemoved} segments (${stats.processingTimeMs}ms)`);
          }
        }
      }
    );
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

      // Check supported MIME types for iPhone
      const mimeTypes = [
        'audio/mp4;codecs=mp4a.40.2', // Prefer explicit AAC on iOS
        'audio/mp4',
        'audio/aac',
        'audio/webm;codecs=opus',
        'audio/webm'
      ];

      let selectedMimeType = 'audio/webm'; // fallback
      for (const mimeType of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType;
          console.log('📱 Using MIME type:', mimeType);
          break;
        }
      }

      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: selectedMimeType,
        audioBitsPerSecond: 128000 // Higher bitrate to reduce artifacts on iOS
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
          this.fullRecordingChunks.push(event.data);
        }
      };
      this.mediaRecorder.onstop = async () => {
        if (this.audioChunks.length > 0) {
          await this.processAudioChunks();
        }
      };

      this.mediaRecorder.onerror = (event) => {
        console.error('📱 MediaRecorder error:', event);
        this.onError('Recording error occurred');
      };

      // Start recording and process in chunks every 60 seconds with overlap
      this.isRecording = true;
      this.startChunkedRecording();
      
      this.onStatusChange('Recording...');
      console.log('✅ iPhone transcription started');

    } catch (error) {
      console.error('❌ Failed to start iPhone transcription:', error);
      this.onError(`Failed to start recording: ${error.message}`);
    }
  }

  private startChunkedRecording() {
    if (!this.mediaRecorder || !this.isRecording) return;

    // Start recording and dynamically adjust chunking frequency
    this.recordingStartTime = Date.now();
    this.mediaRecorder.start();

    // Phase 2: Use optimal chunk intervals  
    const getInterval = (elapsed: number) => {
      return getOptimalChunkInterval(elapsed, elapsed < 60000); // Early mode for first minute
    };

    const scheduleNext = () => {
      if (!this.mediaRecorder || !this.isRecording) return;
      const elapsed = Date.now() - this.recordingStartTime;
      const interval = getInterval(elapsed);
      console.log(`⏱️ Next iPhone chunk in ${interval}ms (elapsed ${elapsed}ms)`);
      this.lastIntervalMs = interval;

      this.chunkTimeout = setTimeout(() => {
        if (this.mediaRecorder && this.isRecording && this.mediaRecorder.state === 'recording') {
          this.mediaRecorder.stop();
          // Start new recording immediately
          setTimeout(() => {
            if (this.mediaRecorder && this.isRecording) {
              this.mediaRecorder.start();
              scheduleNext();
            }
          }, 100);
        } else {
          // If not recording for any reason, try to reschedule
          scheduleNext();
        }
      }, interval);
    };

    scheduleNext();
  }

  private async processAudioChunks() {
    if (this.audioChunks.length === 0) return;

    try {
      const elapsed = Date.now() - this.recordingStartTime;
      // In the first minute, don't use overlap to keep latency low
      let currentChunks: Blob[];
      if (elapsed >= 10000) {
        // Enable small overlap after 10s for stability
        currentChunks = [...this.overlapBuffer, ...this.audioChunks];
      } else {
        currentChunks = [...this.audioChunks];
      }
      
      // Combine chunks
      const audioBlob = new Blob(currentChunks, { type: this.audioChunks[0].type });
      
      // Update overlap buffer only for longer segments
      if (elapsed >= 10000) {
        // Dynamic small overlap: ~1–2s depending on current interval
        let overlapFraction = 0.08; // ~2.4s for 30s chunks
        if (this.lastIntervalMs <= 5000) overlapFraction = 0.2; // ~1s for 5s chunks
        else if (this.lastIntervalMs <= 10000) overlapFraction = 0.1; // ~1s for 10s chunks
        const overlapSize = Math.max(1, Math.ceil(this.audioChunks.length * overlapFraction));
        this.overlapBuffer = this.audioChunks.slice(-overlapSize);
      } else {
        this.overlapBuffer = [];
      }
      
      this.audioChunks = []; // Clear current chunks after processing

      // Skip very small audio chunks, but allow smaller ones early for quick feedback
      const minSize = elapsed < 20000 ? 5000 : elapsed < 60000 ? 12000 : 40000; // bytes
      if (audioBlob.size < minSize) {
        console.log(`📱 Skipping small audio chunk (size=${audioBlob.size}, min=${minSize})`);
        return;
      }

      // Convert blob to base64
      const arrayBuffer = await audioBlob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // Phase 2: Check audio activity before transcription
      if (!hasAudioActivity(uint8Array, 0.01)) {
        console.log(`🔇 Skipping iPhone chunk due to low audio activity`);
        return; // Skip transcription for silent chunks
      }
      
      // Convert to base64 in chunks to prevent memory issues
      let binary = '';
      const chunkSize = 0x8000;
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
        binary += String.fromCharCode.apply(null, Array.from(chunk));
      }
      const base64Audio = btoa(binary);

      console.log('📡 Sending audio to Whisper API...');

      // Send to Whisper API
      const { data, error } = await supabase.functions.invoke('speech-to-text', {
        body: { audio: base64Audio, language: 'en', temperature: 0, condition_on_previous_text: false }
      });

      if (error) {
        console.error('❌ Whisper API error:', error);
        this.onError('Transcription failed');
        return;
      }

      if (data.text && data.text.trim()) {
        const t = data.text.trim();
        // Skip likely hallucinated/repetitive noise chunks (e.g., endless "ha ha ha")
        if (this.isLikelyRepetitiveNoise(t)) {
          console.log('🚫 Skipping likely hallucinated/repetitive chunk (iPhone)');
          return;
        }

        // Process through unified processor
        const result = this.unifiedProcessor.processChunk({
          text: t,
          confidence: data.confidence || 0.9,
          isFinal: true,
          timestamp: Date.now(),
          source: 'iphone_whisper',
          sessionId: this.sessionId || 'unknown'
        });

        // Send to UI if not filtered
        if (!result.wasFiltered) {
          const transcriptData: TranscriptData = {
            text: t,
            is_final: true,
            confidence: data.confidence || 0.9,
            speaker: 'Speaker'
          };

          this.onTranscription(transcriptData);
          console.log(`📱 iPhone transcription: "${t.substring(0, 100)}..." (confidence: ${transcriptData.confidence.toFixed(3)})`);
        } else {
          console.log(`📱 iPhone chunk filtered: ${result.filterReason}`);
          return; // Don't process further if filtered
        }

        // Update running word count
        try {
          this.totalWordCount += t.split(/\s+/).filter(Boolean).length;
        } catch {}

        // Persist chunk to DB for later full transcript assembly
        try {
          this.chunkCounter += 1;
          const currentChunkNumber = this.chunkCounter;
          const user = (await supabase.auth.getUser()).data.user?.id;
          if (this.meetingId && this.sessionId && user) {
            const { error: dbError } = await supabase
              .from('meeting_transcription_chunks')
              .insert({
                meeting_id: this.meetingId,
                session_id: this.sessionId,
                chunk_number: currentChunkNumber,
                transcription_text: t,
                confidence: data.confidence || 0.9,
                is_final: true, // 🔥 CRITICAL FIX: Set is_final to enable real-time processing
                user_id: user,
              });
            if (dbError) {
              console.warn('⚠️ Failed to store iPhone chunk:', dbError);
            } else {
              console.log(`💾 Stored iPhone chunk #${currentChunkNumber}`);
            }
          } else {
            console.warn('ℹ️ Skipping DB store: missing meetingId/sessionId/user');
          }
        } catch (e) {
          console.warn('⚠️ Error while saving iPhone chunk to DB:', e);
        }
        }
    } catch (error) {
      console.error('❌ Error processing audio:', error);
      this.onError('Failed to process audio');
    }
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

    if (this.transcriptionInterval) {
      clearInterval(this.transcriptionInterval);
      this.transcriptionInterval = null;
    }
    if (this.chunkTimeout) {
      clearTimeout(this.chunkTimeout);
      this.chunkTimeout = null;
    }

    // Process any remaining audio chunks before stopping
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
      // Wait a moment for the final ondataavailable event
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Process final chunk if any audio data remains
    if (this.audioChunks.length > 0) {
      console.log('🔄 Processing final audio chunk before stopping...');
      await this.processAudioChunks();
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    this.mediaRecorder = null;
    this.audioChunks = [];

    // Upload full recording as backup to Supabase Storage and insert metadata
    try {
      if (this.fullRecordingChunks.length > 0 && this.meetingId) {
        const fullBlobType = this.fullRecordingChunks[0]?.type || 'audio/webm';
        const fullBlob = new Blob(this.fullRecordingChunks, { type: fullBlobType });
        const durationSeconds = Math.max(1, Math.round((Date.now() - this.recordingStartTime) / 1000));
        const userId = (await supabase.auth.getUser()).data.user?.id;

        if (userId) {
          const ext = fullBlobType.includes('mp4') ? 'm4a' : fullBlobType.includes('aac') ? 'aac' : 'webm';
          const safeSession = this.sessionId || 'session';
          const fileName = `${userId}/${this.meetingId}_${safeSession}_${Date.now()}.${ext}`;

          console.log('📤 Uploading iPhone backup audio...', { fileName, fullBlobType, size: fullBlob.size });
          const { data: uploadData, error: uploadErr } = await supabase.storage
            .from('meeting-audio-backups')
            .upload(fileName, fullBlob, { contentType: fullBlobType, upsert: false });

          if (uploadErr) {
            console.warn('⚠️ Failed to upload iPhone backup audio:', uploadErr);
          } else if (uploadData?.path) {
            console.log('✅ iPhone backup uploaded:', uploadData.path);
            // Insert backup metadata (RLS now allows user-owned inserts)
            const expectedWords = Math.max(this.totalWordCount, Math.round(durationSeconds * 2));
            const { error: metaErr } = await supabase
              .from('meeting_audio_backups')
              .insert({
                meeting_id: this.meetingId,
                user_id: userId,
                file_path: uploadData.path,
                file_size: fullBlob.size,
                duration_seconds: durationSeconds,
                word_count: this.totalWordCount,
                expected_word_count: expectedWords,
                backup_reason: 'iphone_recorder'
              });
            if (metaErr) {
              console.warn('⚠️ Failed to insert iPhone backup metadata:', metaErr);
            } else {
              console.log('💾 iPhone backup metadata stored');
            }
          }
        } else {
          console.warn('ℹ️ Skipping audio backup upload: no user context');
        }
      } else {
        console.log('ℹ️ No full recording chunks or missing meetingId; skipping backup upload.');
      }
    } catch (e) {
      console.warn('⚠️ Error during iPhone backup upload:', e);
    }

    this.onStatusChange('Stopped');
  }

  isActive(): boolean {
    return this.isRecording;
  }
}