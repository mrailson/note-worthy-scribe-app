import { supabase } from "@/integrations/supabase/client";

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

  constructor(
    private onTranscription: (data: TranscriptData) => void,
    private onError: (error: string) => void,
    private onStatusChange: (status: string) => void
  ) {
    this.sessionId = this.generateSessionId();
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  setMeetingId(meetingId: string): void {
    this.meetingId = meetingId;
    // Use the meeting ID as the session ID to ensure consistency
    this.sessionId = meetingId;
    console.log(`📋 Set meeting ID: ${meetingId} and session ID: ${this.sessionId}`);
  }

  async startTranscription() {
    try {
      this.onStatusChange('Starting desktop Whisper transcription...');
      console.log('🖥️ Starting Desktop Whisper transcription...');

      // Request microphone access with desktop-optimized settings
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 24000, // Higher quality for desktop
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });

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

    // Start recording
    this.mediaRecorder.start();
    
    // Schedule next chunk based on timing requirements
    this.scheduleNextChunk();
  }

  private scheduleNextChunk() {
    if (!this.isRecording) return;

    let nextInterval: number;
    
    if (this.chunkCount === 0) {
      // First chunk: 20 seconds
      nextInterval = 20000;
    } else {
      // Subsequent chunks: 45 seconds
      nextInterval = 45000;
    }

    console.log(`🖥️ Scheduling chunk ${this.chunkCount + 1} in ${nextInterval/1000} seconds`);

    this.transcriptionTimeout = setTimeout(() => {
      if (this.mediaRecorder && this.isRecording && this.mediaRecorder.state === 'recording') {
        this.mediaRecorder.stop();
        
        // Start new recording immediately after a brief pause
        setTimeout(() => {
          if (this.mediaRecorder && this.isRecording) {
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
      
      // Create overlap: keep last portion of previous chunk for continuity
      const currentChunks = [...this.overlapBuffer, ...this.audioChunks];
      
      // Combine all chunks including overlap
      const audioBlob = new Blob(currentChunks, { type: this.audioChunks[0].type });
      console.log(`🖥️ Audio blob size: ${audioBlob.size} bytes`);
      
      // Store last portion of current chunks for next overlap
      const overlapSize = Math.ceil(this.audioChunks.length * 0.2);
      this.overlapBuffer = this.audioChunks.slice(-overlapSize);
      
      this.audioChunks = []; // Clear current chunks after processing

      // Skip very small audio chunks - but don't increment chunk count
      if (audioBlob.size < 20000) {
        console.log(`🖥️ Skipping small audio chunk (${audioBlob.size} bytes) - no increment`);
        return;
      }

      // Convert blob to base64
      const arrayBuffer = await audioBlob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // Convert to base64 in chunks to prevent memory issues
      let binary = '';
      const chunkSize = 0x8000;
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
        binary += String.fromCharCode.apply(null, Array.from(chunk));
      }
      const base64Audio = btoa(binary);

      console.log('📡 Sending desktop audio to Whisper API...');

      // Send to Whisper API
      const { data, error } = await supabase.functions.invoke('speech-to-text', {
        body: { audio: base64Audio }
      });

      if (error) {
        console.error('❌ Desktop Whisper API error:', error);
        this.onError('Transcription failed');
        return;
      }

      if (data.text && data.text.trim()) {
        const cleanText = data.text.trim();
        
        // Store transcription internally
        this.allTranscriptions.push(cleanText);
        console.log(`📝 Stored transcription ${this.allTranscriptions.length}: "${cleanText.substring(0, 100)}..."`);
        
        // Store in database if meeting ID is set
        if (this.meetingId) {
          try {
            console.log(`🔍 DEBUG: Storing chunk ${currentChunkNumber}`);
            
            const { error: dbError } = await supabase
              .from('meeting_transcription_chunks')
              .insert({
                meeting_id: this.meetingId,
                session_id: this.sessionId,
                chunk_number: currentChunkNumber,
                transcription_text: cleanText,
                confidence: 0.9,
                user_id: (await supabase.auth.getUser()).data.user?.id
              });

            if (dbError) {
              console.error('❌ Failed to store chunk in database:', dbError);
            } else {
              console.log(`💾 Chunk ${currentChunkNumber} stored in database`);
            }
          } catch (error) {
            console.error('❌ Database storage error:', error);
          }
        }
        
        const transcriptData: TranscriptData = {
          text: cleanText,
          is_final: true,
          confidence: 0.9,
          speaker: 'Speaker'
        };

        console.log('✅ Desktop transcription:', cleanText);
        this.onTranscription(transcriptData);
      }

    } catch (error) {
      console.error('❌ Error processing desktop audio:', error);
      this.onError('Failed to process audio');
    }
  }

  async stopTranscription(): Promise<void> {
    console.log('🛑 Stopping desktop Whisper transcription...');
    
    if (this.transcriptionTimeout) {
      clearTimeout(this.transcriptionTimeout);
      this.transcriptionTimeout = null;
    }

    // Stop recording and wait for final data
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      console.log('🔄 Stopping final recording chunk...');
      this.mediaRecorder.stop();
      // Wait longer for the final ondataavailable event
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Now stop the recording flag
    this.isRecording = false;

    // Force process any remaining audio chunks and wait for completion
    console.log(`🔍 DEBUG: Checking for remaining chunks - audioChunks.length: ${this.audioChunks.length}`);
    if (this.audioChunks.length > 0) {
      // Increment chunk count BEFORE processing to ensure unique numbering
      const finalChunk = this.chunkCount++;
      console.log(`🔄 Processing final audio chunk ${finalChunk} (${this.audioChunks.length} audio chunks)... Next chunk would be: ${this.chunkCount}`);
      await this.processAudioChunks(finalChunk);
      console.log(`🔍 DEBUG: Final chunk ${finalChunk} processed and stored`);
      // Additional wait to ensure transcription callback is processed
      await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for database save
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
    this.allTranscriptions.forEach((text, i) => {
      console.log(`📋 Chunk ${i + 1}: "${text.substring(0, 100)}..."`);
    });
    
    const completeText = this.allTranscriptions.join(' ').trim();
    console.log(`📋 Complete transcript length: ${completeText.length} characters`);
    return completeText;
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

      // Apply deduplication logic to prevent repeated segments
      const completeText = this.deduplicateTranscriptChunks(data.map(chunk => chunk.transcription_text));
      console.log(`🔍 DEBUG: Database transcript after deduplication: ${completeText.length} chars, ${data.length} chunks`);
      console.log(`🔍 DEBUG: Chunk details: [${data.map((chunk, i) => `"Chunk ${chunk.chunk_number}: ${chunk.transcription_text.substring(0, 50)}..."`).join(', ')}]`);
      console.log(`📋 Database transcript ending: "${completeText.slice(-200)}"`);
      
      return completeText;
    } catch (error) {
      console.error('❌ Error getting transcript from database:', error);
      return this.getCompleteTranscript(); // Fallback to memory
    }
  }

  private deduplicateTranscriptChunks(chunks: string[]): string {
    if (chunks.length === 0) return '';
    if (chunks.length === 1) return chunks[0].trim();

    console.log('🧹 Starting transcript deduplication...');
    
    let result = chunks[0].trim();
    console.log(`🧹 Base chunk: "${result.substring(0, 100)}..."`);

    for (let i = 1; i < chunks.length; i++) {
      const currentChunk = chunks[i].trim();
      console.log(`🧹 Processing chunk ${i}: "${currentChunk.substring(0, 100)}..."`);
      
      // Find the best overlap between result ending and current chunk beginning
      const overlap = this.findBestOverlap(result, currentChunk);
      
      if (overlap.length > 0) {
        // Remove the overlapping part from the current chunk
        const newContent = currentChunk.substring(overlap.length).trim();
        console.log(`🧹 Found overlap of ${overlap.length} chars: "${overlap.substring(0, 50)}..."`);
        console.log(`🧹 Adding new content: "${newContent.substring(0, 50)}..."`);
        
        if (newContent.length > 0) {
          result += ' ' + newContent;
        }
      } else {
        // No overlap found, check for complete duplicates or add as new content
        if (!this.isSubstantiallyDuplicate(result, currentChunk)) {
          console.log(`🧹 No overlap found, adding as new content`);
          result += ' ' + currentChunk;
        } else {
          console.log(`🧹 Chunk appears to be duplicate, skipping`);
        }
      }
    }

    console.log(`🧹 Deduplication complete: ${result.length} chars`);
    return result.trim();
  }

  private findBestOverlap(text1: string, text2: string): string {
    // Look for overlap by comparing the end of text1 with the beginning of text2
    // We'll check different lengths to find the longest meaningful overlap
    const maxOverlapLength = Math.min(text1.length, text2.length, 500); // Limit search to avoid performance issues
    
    for (let length = maxOverlapLength; length >= 20; length--) {
      const ending = text1.slice(-length).toLowerCase().trim();
      const beginning = text2.substring(0, length).toLowerCase().trim();
      
      // Check for exact match
      if (ending === beginning) {
        return text2.substring(0, length);
      }
      
      // Check for near match (allow for small differences in punctuation/spacing)
      const similarity = this.calculateSimilarity(ending, beginning);
      if (similarity > 0.85) {
        return text2.substring(0, length);
      }
    }
    
    return '';
  }

  private calculateSimilarity(str1: string, str2: string): number {
    // Simple similarity calculation based on character overlap
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    let matches = 0;
    for (let i = 0; i < shorter.length; i++) {
      if (longer[i] === shorter[i]) {
        matches++;
      }
    }
    
    return matches / longer.length;
  }

  private isSubstantiallyDuplicate(existingText: string, newChunk: string): boolean {
    // Check if the new chunk is substantially contained within the existing text
    const normalizedExisting = existingText.toLowerCase().replace(/\s+/g, ' ').trim();
    const normalizedNew = newChunk.toLowerCase().replace(/\s+/g, ' ').trim();
    
    // If new chunk is very short, it might be a fragment
    if (normalizedNew.length < 50) {
      return normalizedExisting.includes(normalizedNew);
    }
    
    // Check if significant portion (70%+) of new chunk already exists
    const words = normalizedNew.split(' ');
    const wordsFound = words.filter(word => 
      word.length > 3 && normalizedExisting.includes(word)
    ).length;
    
    return (wordsFound / words.length) > 0.7;
  }

  clearTranscriptions(): void {
    this.allTranscriptions = [];
    console.log('🧹 Cleared internal transcriptions');
  }

  getSessionId(): string {
    return this.sessionId;
  }
}
