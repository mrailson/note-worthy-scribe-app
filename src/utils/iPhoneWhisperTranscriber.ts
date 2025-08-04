import { supabase } from "@/integrations/supabase/client";

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
  private transcriptionInterval: NodeJS.Timeout | null = null;
  private overlapBuffer: Blob[] = [];

  constructor(
    private onTranscription: (data: TranscriptData) => void,
    private onError: (error: string) => void,
    private onStatusChange: (status: string) => void
  ) {}

  async startTranscription() {
    try {
      this.onStatusChange('Starting iPhone transcription...');
      console.log('📱 Starting iPhone Whisper transcription...');

      // Request microphone access with iPhone-optimized settings
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000, // Whisper works well with 16kHz
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });

      // Check supported MIME types for iPhone
      const mimeTypes = [
        'audio/mp4',
        'audio/mp4;codecs=mp4a.40.2',
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
        audioBitsPerSecond: 64000 // Lower bitrate for mobile
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
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

    // Start recording
    this.mediaRecorder.start();
    
    // Process chunks every 60 seconds (clinical quality)
    this.transcriptionInterval = setInterval(() => {
      if (this.mediaRecorder && this.isRecording && this.mediaRecorder.state === 'recording') {
        this.mediaRecorder.stop();
        // Start new recording immediately
        setTimeout(() => {
          if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.start();
          }
        }, 100);
      }
    }, 60000);
  }

  private async processAudioChunks() {
    if (this.audioChunks.length === 0) return;

    try {
      // Create overlap: keep last 8 seconds of previous chunk (roughly 25% overlap for 35s chunks)
      const currentChunks = [...this.overlapBuffer, ...this.audioChunks];
      
      // Combine all chunks including overlap
      const audioBlob = new Blob(currentChunks, { type: this.audioChunks[0].type });
      
      // Store last ~8 seconds of current chunks for next overlap
      // Estimate: last 25% of chunks for 8-second overlap
      const overlapSize = Math.ceil(this.audioChunks.length * 0.25);
      this.overlapBuffer = this.audioChunks.slice(-overlapSize);
      
      this.audioChunks = []; // Clear current chunks after processing

      // Skip very small audio chunks (less than 5 seconds for clinical quality)
      if (audioBlob.size < 40000) {
        console.log('📱 Skipping small audio chunk');
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

      console.log('📡 Sending audio to Whisper API...');

      // Send to Whisper API
      const { data, error } = await supabase.functions.invoke('speech-to-text', {
        body: { audio: base64Audio }
      });

      if (error) {
        console.error('❌ Whisper API error:', error);
        this.onError('Transcription failed');
        return;
      }

      if (data.text && data.text.trim()) {
        const transcriptData: TranscriptData = {
          text: data.text.trim(),
          is_final: true,
          confidence: 0.9,
          speaker: 'Speaker'
        };

        console.log('✅ iPhone transcription:', data.text);
        this.onTranscription(transcriptData);
      }

    } catch (error) {
      console.error('❌ Error processing audio:', error);
      this.onError('Failed to process audio');
    }
  }

  async stopTranscription() {
    console.log('🛑 Stopping iPhone transcription...');
    this.isRecording = false;

    if (this.transcriptionInterval) {
      clearInterval(this.transcriptionInterval);
      this.transcriptionInterval = null;
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
    this.onStatusChange('Stopped');
  }

  isActive(): boolean {
    return this.isRecording;
  }
}