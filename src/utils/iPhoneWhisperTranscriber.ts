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
  private previousTranscription = ''; // Track what we've already transcribed to avoid duplicates

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

      // Create single MediaRecorder that will run for entire session
      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: this.selectedMimeType,
        audioBitsPerSecond: 128000 // Higher bitrate to reduce artifacts on iOS
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
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
    
    // Use timeslice to get regular ondataavailable events (5 seconds)
    // This is more reliable on iOS Safari than requestData()
    this.mediaRecorder.start(5000);  
    
    console.log('📱 iPhone MediaRecorder started with 5s timeslice');

    const FIRST_PROCESS_INTERVAL = 15000; // 15 seconds for first transcription
    const SUBSEQUENT_PROCESS_INTERVAL = 60000; // 60 seconds after that
    let isFirstProcess = true;

    const scheduleProcessing = () => {
      if (!this.isRecording) return;
      
      const interval = isFirstProcess ? FIRST_PROCESS_INTERVAL : SUBSEQUENT_PROCESS_INTERVAL;
      console.log(`⏱️ Scheduling processing in ${interval}ms`);
      
      this.chunkTimeout = setTimeout(async () => {
        if (this.isRecording && this.fullRecordingChunks.length > 0) {
          console.log(`📤 Processing cumulative audio (${this.fullRecordingChunks.length} chunks)`);
          this.lastIntervalMs = interval;
          await this.processCumulativeAudio(false);
          
          if (isFirstProcess) {
            isFirstProcess = false;
            console.log('✅ First process complete, switching to 60-second intervals');
          }
          
          scheduleProcessing();
        }
      }, interval);
    };

    scheduleProcessing();
  }

  private async processCumulativeAudio(isFinalChunk = false) {
    if (this.fullRecordingChunks.length === 0) return;

    try {
      // Combine ALL chunks received so far into one valid M4A blob
      const cumulativeBlob = new Blob(this.fullRecordingChunks, { 
        type: this.selectedMimeType || 'audio/mp4' 
      });
      
      console.log(`📏 Cumulative blob: ${cumulativeBlob.size} bytes from ${this.fullRecordingChunks.length} chunks`);

      // Convert to base64
      const arrayBuffer = await cumulativeBlob.arrayBuffer();
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

      console.log('📡 Sending cumulative audio to Whisper API...');

      // Send to Whisper
      const { data, error } = await supabase.functions.invoke('speech-to-text', {
        body: {
          audio: base64Audio,
          mimeType: cumulativeBlob.type,
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

      const fullText = data.text.trim();
      
      // Extract only NEW content (what wasn't in previous transcription)
      const newText = this.extractNewContent(fullText, this.previousTranscription);
      
      if (newText && newText.trim()) {
        console.log(`📝 New transcription content (${newText.split(/\s+/).length} words): "${newText.substring(0, 80)}..."`);
        
        // Update previous transcription for next comparison
        this.previousTranscription = fullText;
        
        // Emit only the new content to the UI
        const transcriptData: TranscriptData = {
          text: newText.trim(),
          is_final: true,
          confidence: data.confidence || 0.9,
          speaker: 'Speaker'
        };
        
        this.onTranscription(transcriptData);
        
        // Update word count with new words only
        const newWordCount = newText.split(/\s+/).filter(Boolean).length;
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
                text: newText
              }];
            }
            
            console.log(`📦 Received ${data.segments.length} segments from API`);
            
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
            } else {
              const filteredCount = data.segments.length - newSegments.length;
              const rejectionReason = `All segments already processed (filtered ${filteredCount} duplicate${filteredCount !== 1 ? 's' : ''})`;
              console.log(`⏭️ Chunk ${currentChunkNumber}: ${rejectionReason}`);
              
              // Save chunk with rejection reason for tracking
              await supabase
                .from('meeting_transcription_chunks')
                .insert({
                  meeting_id: this.meetingId,
                  session_id: this.sessionId,
                  chunk_number: currentChunkNumber,
                  transcription_text: JSON.stringify([]),
                  confidence: transcriptData.confidence,
                  is_final: true,
                  user_id: user,
                  merge_rejection_reason: rejectionReason
                });
            }
          } else {
            console.warn('ℹ️ Skipping DB store: missing meetingId/sessionId/user');
          }
        } catch (e) {
          console.warn('⚠️ Error while saving segments to DB:', e);
        }
      } else {
        console.log('ℹ️ No new content extracted from cumulative transcription');
      }
    } catch (error) {
      console.error('❌ processCumulativeAudio error:', error);
      this.onError('Failed to process audio');
    }
  }

  private extractNewContent(fullText: string, previousText: string): string {
    if (!previousText) return fullText;
    
    // Simple approach: if full text starts with previous text, return the difference
    const prevWords = previousText.split(/\s+/).filter(Boolean);
    const fullWords = fullText.split(/\s+/).filter(Boolean);
    
    if (fullWords.length <= prevWords.length) {
      console.log('⚠️ New transcription is not longer than previous, returning empty');
      return '';
    }
    
    // Find the best match point by checking if the beginning of fullText matches the end of previousText
    // This handles cases where Whisper might slightly rephrase the beginning
    let bestMatchIndex = 0;
    const searchWindowSize = Math.min(30, prevWords.length); // Check last 30 words of previous
    
    for (let i = Math.max(0, prevWords.length - searchWindowSize); i < prevWords.length; i++) {
      const prevTail = prevWords.slice(i).join(' ').toLowerCase();
      const fullHead = fullWords.slice(0, prevWords.length - i).join(' ').toLowerCase();
      
      if (fullHead.includes(prevTail) || prevTail.includes(fullHead)) {
        bestMatchIndex = prevWords.length - i;
        break;
      }
    }
    
    // If no good match, assume previous transcription ended at prevWords.length
    if (bestMatchIndex === 0) {
      bestMatchIndex = prevWords.length;
    }
    
    // Return everything after the match point
    const newWords = fullWords.slice(bestMatchIndex);
    const result = newWords.join(' ');
    
    console.log(`🔍 extractNewContent: prevWords=${prevWords.length}, fullWords=${fullWords.length}, matchIndex=${bestMatchIndex}, newWords=${newWords.length}`);
    
    return result;
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
      
      // Process final cumulative audio
      if (this.fullRecordingChunks.length > 0) {
        console.log('🔄 Processing final cumulative audio...');
        await this.processCumulativeAudio(true);
      }
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
