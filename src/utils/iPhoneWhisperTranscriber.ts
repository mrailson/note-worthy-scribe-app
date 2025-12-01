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

  // Audio activity monitoring
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private activityCheckInterval: NodeJS.Timeout | null = null;

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
    if (!this.analyser || !this.onAudioActivity) return;
    
    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    this.activityCheckInterval = setInterval(() => {
      if (!this.analyser) return;
      
      this.analyser.getByteTimeDomainData(dataArray);
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        const normalized = (dataArray[i] - 128) / 128;
        sum += normalized * normalized;
      }
      const rms = Math.sqrt(sum / bufferLength);
      
      // Call callback with activity status
      if (this.onAudioActivity) {
        this.onAudioActivity(rms > 0.01);
      }
    }, 100); // Check every 100ms
  }
  
  private stopActivityMonitoring() {
    if (this.activityCheckInterval) {
      clearInterval(this.activityCheckInterval);
      this.activityCheckInterval = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }

  private createMediaRecorder() {
    if (!this.stream) {
      throw new Error('No audio stream available for MediaRecorder');
    }

    const recorder = new MediaRecorder(this.stream, {
      mimeType: this.selectedMimeType,
      audioBitsPerSecond: 128000 // Higher bitrate to reduce artifacts on iOS
    });

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.audioChunks.push(event.data);
        this.fullRecordingChunks.push(event.data);
      }
    };

    recorder.onstop = async () => {
      if (this.audioChunks.length > 0) {
        const isFinalChunk = !this.isRecording;
        await this.processAudioChunks(isFinalChunk);
      }
    };

    recorder.onerror = (event) => {
      console.error('📱 MediaRecorder error:', event);
      this.onError('Recording error occurred');
    };

    this.mediaRecorder = recorder;
    console.log('🔄 Created new iPhone MediaRecorder instance with MIME type:', this.selectedMimeType);
    return recorder;
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
      
      // Set up audio activity monitoring if callback provided
      if (this.onAudioActivity) {
        this.audioContext = new AudioContext({ sampleRate: 16000 });
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 256;
        
        const source = this.audioContext.createMediaStreamSource(this.stream);
        source.connect(this.analyser);
        
        // Start checking for audio activity
        this.startActivityMonitoring();
      }

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

      // Create initial MediaRecorder instance
      this.createMediaRecorder();

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
    if (!this.isRecording) return;

    if (!this.mediaRecorder) {
      this.createMediaRecorder();
    }

    // Start recording and dynamically adjust chunking frequency
    this.recordingStartTime = Date.now();
    this.mediaRecorder!.start();

    // Fixed 15-second chunks for iPhone testing
    const getInterval = (elapsed: number) => {
      return 15000; // Fixed 15-second interval
    };

    const scheduleNext = () => {
      if (!this.isRecording) return;
      const elapsed = Date.now() - this.recordingStartTime;
      const interval = getInterval(elapsed);
      console.log(`⏱️ Next iPhone chunk in ${interval}ms (elapsed ${elapsed}ms)`);
      this.lastIntervalMs = interval;

      this.chunkTimeout = setTimeout(() => {
        if (this.mediaRecorder && this.isRecording && this.mediaRecorder.state === 'recording') {
          console.log('🧩 Stopping current iPhone MediaRecorder for chunk rotation');
          this.mediaRecorder.stop();

          // After stopping, create a fresh MediaRecorder for the next chunk
          setTimeout(() => {
            if (!this.isRecording || !this.stream) {
              return;
            }

            const newRecorder = this.createMediaRecorder();
            console.log('▶️ Starting new iPhone MediaRecorder for next chunk');
            newRecorder.start();
            scheduleNext();
          }, 200);
        } else if (this.isRecording) {
          // If not recording for any reason but still marked as recording, try to recreate
          console.log('♻️ MediaRecorder not in recording state, recreating...');
          const newRecorder = this.createMediaRecorder();
          newRecorder.start();
          scheduleNext();
        }
      }, interval);
    };

    scheduleNext();
  }

  private async processAudioChunks(isFinalChunk = false) {
    if (this.audioChunks.length === 0) return;

    try {
      // For iPhone we no longer use an overlap buffer because slicing M4A containers can corrupt audio.
      const chunksToProcess = [...this.audioChunks];
      
      const audioBlob = new Blob(chunksToProcess, { 
        type: this.audioChunks[0]?.type || 'audio/mp4' 
      });
      
      // Clear current chunks after combining with overlap
      this.audioChunks = [];
      
      const elapsed = Date.now() - this.recordingStartTime;
      console.log(`🎬 iPhone processAudioChunks called (isFinal=${isFinalChunk}) at ${elapsed}ms, rawChunks=${this.audioChunks.length}`);

      // Previously we skipped very small blobs; for iPhone we now always send to Whisper
      // to avoid losing short but important utterances.
      // const minSize = 2000; // 2KB minimum for all chunks
      // if (!isFinalChunk && audioBlob.size < minSize) {
      //   console.log(`📱 Skipping small audio chunk (size=${audioBlob.size}, min=${minSize})`);
      //   return;
      // }

      // Convert blob to base64
      const arrayBuffer = await audioBlob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      console.log(`📏 iPhone chunk size=${audioBlob.size} bytes, interval=${this.lastIntervalMs}ms, isFinalChunk=${isFinalChunk}`);
      
      // NOTE: For iPhone we now always send chunks to Whisper to avoid missing speech.
      // If needed later, we can re-enable activity-based skipping once we're 100% confident.
      // const hasActivity = hasAudioActivity(uint8Array, 0.00001);
      // console.log(`🎚️ iPhone audio activity for chunk: ${hasActivity}`);
      // if (!isFinalChunk && !hasActivity) {
      //   console.log(`🔇 Skipping iPhone chunk due to low audio activity`);
      //   return; // Skip transcription for silent chunks
      // }
      
      // Overlap buffer removed for iPhone: using clean, independent chunks to avoid corrupting M4A audio.

      
      // Convert to base64 in chunks to prevent memory issues
      let binary = '';
      const chunkSize = 4096; // smaller chunk for iOS Safari stability
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

      // Determine MIME type from blob (before chunks were cleared)
      const mimeType = audioBlob.type || 'audio/mp4'; // iOS default
      let extension = 'm4a'; // Default to m4a for iOS
      if (mimeType.includes('webm')) {
        extension = 'webm';
      } else if (mimeType.includes('mp4') || mimeType.includes('aac') || mimeType.includes('m4a')) {
        extension = 'm4a';
      } else if (mimeType.includes('wav')) {
        extension = 'wav';
      } else if (mimeType.includes('ogg')) {
        extension = 'ogg';
      }
      const fileName = `iphone-audio.${extension}`;
      
      console.log(`📱 iPhone audio format: ${mimeType}, extension: ${extension}`);

      // Send to Whisper API via Supabase edge function
      const { data, error } = await supabase.functions.invoke('speech-to-text', {
        body: {
          audio: base64Audio,
          mimeType,
          fileName,
          language: 'en',
          temperature: 0,
          condition_on_previous_text: false
        }
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

        // Update live transcript for UI
        this.finalTranscript = this.simpleSmartMerge(this.finalTranscript, t);

        const transcriptData: TranscriptData = {
          text: t,
          is_final: true,
          confidence: data.confidence || 0.9, // Use actual confidence from API
          speaker: 'Speaker'
        };

        // Log quality for analysis but don't block - always show to user and save to DB
        if (!meetsConfidenceThreshold(transcriptData.confidence, this.meetingSettings)) {
          console.log(`ℹ️ Low-confidence iPhone transcription (still shown to user): ${transcriptData.confidence} < ${this.meetingSettings.transcriberThresholds[this.meetingSettings.transcriberService]}`);
        }
        
        console.log('✅ iPhone transcription:', t);
        this.onTranscription(transcriptData);

        // Update running word count
        try {
          this.totalWordCount += t.split(/\s+/).filter(Boolean).length;
        } catch {}

        // Store segments with timestamps in DB
        try {
          this.chunkCounter += 1;
          const currentChunkNumber = this.chunkCounter;
          const user = (await supabase.auth.getUser()).data.user?.id;
          if (this.meetingId && this.sessionId && user) {
            // DIAGNOSTIC FIX: Create synthetic segment if missing
            if (!data.segments || data.segments.length === 0) {
              console.log('⚠️ No segments from API, creating synthetic segment');
              data.segments = [{
                start: this.lastSegmentEndTime,
                end: this.lastSegmentEndTime + 1,
                text: t
              }];
            }
            
            console.log(`📦 iPhone received ${data.segments.length} segments from API`);
            
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
            
            console.log(`⏱️ iPhone chunk ${currentChunkNumber} - offset: ${timeOffset.toFixed(2)}s, lastEndTime: ${this.lastSegmentEndTime.toFixed(2)}s, filtered segments: ${newSegments.length}/${data.segments.length}`);
            
            if (newSegments.length > 0) {
              const { error: dbError } = await supabase
                .from('meeting_transcription_chunks')
                .insert({
                  meeting_id: this.meetingId,
                  session_id: this.sessionId,
                  chunk_number: currentChunkNumber,
                  transcription_text: JSON.stringify(newSegments), // Store segments as JSON
                  confidence: transcriptData.confidence,
                  is_final: true,
                  user_id: user,
                  merge_rejection_reason: null
                });
              if (dbError) {
                console.warn('⚠️ Failed to store iPhone segments:', dbError);
              } else {
                // Update last end time to the latest segment
                this.lastSegmentEndTime = Math.max(...newSegments.map((s: any) => s.end));
                // Update total processed duration (add the duration of this chunk)
                const chunkDuration = Math.max(...offsetSegments.map((s: any) => s.end)) - timeOffset;
                this.totalProcessedDuration += chunkDuration;
                console.log(`💾 Stored ${newSegments.length} segments in iPhone chunk #${currentChunkNumber}, lastEndTime now: ${this.lastSegmentEndTime.toFixed(2)}s, totalDuration: ${this.totalProcessedDuration.toFixed(2)}s`);
              }
            } else {
              const filteredCount = data.segments.length - newSegments.length;
              const rejectionReason = `All segments already processed (filtered ${filteredCount} duplicate${filteredCount !== 1 ? 's' : ''})`;
              console.log(`⏭️ iPhone chunk ${currentChunkNumber}: ${rejectionReason}`);
              
              // Save the chunk with rejection reason for tracking
              await supabase
                .from('meeting_transcription_chunks')
                .insert({
                  meeting_id: this.meetingId,
                  session_id: this.sessionId,
                  chunk_number: currentChunkNumber,
                  transcription_text: JSON.stringify([]), // Empty segments array
                  confidence: transcriptData.confidence,
                  is_final: true,
                  user_id: user,
                  merge_rejection_reason: rejectionReason
                });
            }
          } else {
            console.warn('ℹ️ Skipping DB store: missing meetingId/sessionId/user or no segments');
          }
        } catch (e) {
          console.warn('⚠️ Error while saving iPhone segments to DB:', e);
        }
      }
    } catch (error) {
      console.error('❌ Error processing audio:', error);
      this.onError('Failed to process audio');
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

    // Process final chunk if any audio data remains (force processing even if small)
    if (this.audioChunks.length > 0) {
      console.log('🔄 Processing final audio chunk before stopping...');
      await this.processAudioChunks(true); // isFinalChunk = true bypasses size check
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
