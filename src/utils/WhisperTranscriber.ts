import { supabase } from "@/integrations/supabase/client";

export interface TranscriptData {
  text: string;
  is_final: boolean;
  confidence: number;
  start?: number;
  end?: number;
  speaker?: string;
}

export class WhisperTranscriber {
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private isRecording = false;
  private audioChunks: Blob[] = [];
  private transcriptionTimeout: NodeJS.Timeout | null = null;
  private chunkCount = 0;

  constructor(
    private onTranscription: (data: TranscriptData) => void,
    private onError: (error: string) => void,
    private onStatusChange: (status: string) => void,
    private onSummary?: (summary: string) => void
  ) {}

  async startTranscription() {
    try {
      console.log('🎙️ Starting API-based Whisper transcription...');
      this.onStatusChange('Starting recording...');

      // Get microphone access with optimized settings for API transcription
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 48000,
          channelCount: 1,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        }
      });

      // Check supported MIME types
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/mp4;codecs=mp4a.40.2',
        'audio/aac'
      ];

      let selectedMimeType = 'audio/webm';
      for (const mimeType of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType;
          console.log('🎙️ Using MIME type:', mimeType);
          break;
        }
      }

      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: selectedMimeType,
        audioBitsPerSecond: 128000
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = async () => {
        if (this.audioChunks.length > 0) {
          await this.processAudioChunk();
        }
      };

      this.mediaRecorder.onerror = (event) => {
        console.error('🎙️ MediaRecorder error:', event);
        this.onError('Recording error occurred');
      };

      this.isRecording = true;
      this.chunkCount = 0;
      this.startChunkedRecording();
      
      this.onStatusChange('Recording');
      console.log('✅ API-based Whisper transcription started');
    } catch (error) {
      console.error('❌ Failed to start Whisper transcription:', error);
      this.onError(`Failed to start Whisper: ${error instanceof Error ? error.message : 'Unknown error'}`);
      this.onStatusChange('Error');
    }
  }

  private startChunkedRecording() {
    if (!this.mediaRecorder || !this.isRecording) return;

    this.mediaRecorder.start();
    
    // Process audio in 10-second chunks for better transcription quality
    // (5 seconds was too short and caused poor quality results)
    this.transcriptionTimeout = setTimeout(() => {
      if (this.mediaRecorder && this.isRecording && this.mediaRecorder.state === 'recording') {
        this.mediaRecorder.stop();
        
        // Start recording again immediately for continuous transcription
        setTimeout(() => {
          if (this.isRecording && this.mediaRecorder) {
            this.mediaRecorder.start();
            this.startChunkedRecording();
          }
        }, 100);
      }
    }, 10000); // Increased to 10 seconds for better audio quality
  }

  private async processAudioChunk() {
    if (this.audioChunks.length === 0) return;

    try {
      console.log('🔄 Processing audio chunk with Whisper via FormData (Meeting Recorder style)...');
      this.onStatusChange('Processing...');
      
      // Combine all chunks into a proper audio blob
      const audioBlob = new Blob(this.audioChunks, { type: this.audioChunks[0].type });
      this.audioChunks = [];
      
      // Skip very small chunks (increased threshold for better quality)
      if (audioBlob.size < 50000) { // Increased from 20KB to 50KB
        console.log('🔇 Skipping small audio chunk, size:', audioBlob.size);
        this.onStatusChange(this.isRecording ? 'Recording' : 'Stopped');
        return;
      }

      console.log('📡 Sending audio to process-meeting-audio (same as Meeting Recorder)...', {
        blobSize: audioBlob.size,
        blobType: audioBlob.type
      });

      // Use the same approach as Meeting Recorder - FormData with audio file
      const formData = new FormData();
      formData.append('audio', audioBlob, 'chunk.webm');

      const { data, error } = await supabase.functions.invoke('process-meeting-audio', {
        body: formData,
      });

      console.log('📨 API Response:', { 
        success: data?.success || false, 
        transcript: data?.transcript ? 'received' : 'none',
        error: error || 'none' 
      });

      if (error) {
        console.error('❌ Meeting audio processing error:', {
          error: error,
          message: error.message || 'No message'
        });
        this.onError(`Transcription failed: ${error.message || error.toString()}`);
        return;
      }

      if (data?.success && data?.transcript && data.transcript.trim()) {
        const cleanText = data.transcript.trim();
        console.log('📝 Whisper transcription:', cleanText);
        
        const transcriptData: TranscriptData = {
          text: cleanText,
          is_final: true,
          confidence: 0.9, // process-meeting-audio doesn't return confidence
          speaker: 'Speaker'
        };
        
        this.onTranscription(transcriptData);
        
        if (this.onSummary) {
          this.onSummary(cleanText);
        }
      } else {
        console.log('ℹ️ No transcript text received or processing failed');
      }
      
      this.onStatusChange(this.isRecording ? 'Recording' : 'Stopped');
    } catch (error) {
      console.error('❌ Whisper processing error details:', {
        error: error,
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace',
        name: error instanceof Error ? error.name : 'Unknown error type'
      });
      this.onError(`Whisper processing error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  stopTranscription() {
    console.log('🛑 Stopping Whisper transcription...');
    this.isRecording = false;
    
    if (this.transcriptionTimeout) {
      clearTimeout(this.transcriptionTimeout);
      this.transcriptionTimeout = null;
    }
    
    if (this.mediaRecorder) {
      if (this.mediaRecorder.state === 'recording') {
        this.mediaRecorder.stop();
      }
      
      // Stop all tracks
      if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop());
      }
      
      this.mediaRecorder = null;
      this.stream = null;
    }
    
    this.onStatusChange('Stopped');
    console.log('✅ Whisper transcription stopped');
  }

  isActive(): boolean {
    return this.isRecording;
  }

  async clearSummary() {
    console.log('🧹 Clearing Whisper summary');
  }
}