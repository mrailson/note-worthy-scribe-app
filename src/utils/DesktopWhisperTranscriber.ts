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

  constructor(
    private onTranscription: (data: TranscriptData) => void,
    private onError: (error: string) => void,
    private onStatusChange: (status: string) => void
  ) {}

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
          await this.processAudioChunks();
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
      // First chunk: 5 seconds
      nextInterval = 5000;
    } else if (this.chunkCount === 1) {
      // Second chunk: 15 seconds after first (so 20 seconds total)
      nextInterval = 15000;
    } else {
      // Subsequent chunks: 45 seconds
      nextInterval = 45000;
    }

    console.log(`🖥️ Scheduling chunk ${this.chunkCount + 1} in ${nextInterval/1000} seconds`);

    this.transcriptionTimeout = setTimeout(() => {
      if (this.mediaRecorder && this.isRecording && this.mediaRecorder.state === 'recording') {
        this.mediaRecorder.stop();
        this.chunkCount++;
        
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

  private async processAudioChunks() {
    if (this.audioChunks.length === 0) return;

    try {
      console.log(`🖥️ Processing audio chunk ${this.chunkCount}`);
      
      // Create overlap: keep last portion of previous chunk for continuity
      const currentChunks = [...this.overlapBuffer, ...this.audioChunks];
      
      // Combine all chunks including overlap
      const audioBlob = new Blob(currentChunks, { type: this.audioChunks[0].type });
      
      // Store last portion of current chunks for next overlap
      const overlapSize = Math.ceil(this.audioChunks.length * 0.2);
      this.overlapBuffer = this.audioChunks.slice(-overlapSize);
      
      this.audioChunks = []; // Clear current chunks after processing

      // Skip very small audio chunks
      if (audioBlob.size < 20000) {
        console.log('🖥️ Skipping small audio chunk');
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
        const transcriptData: TranscriptData = {
          text: data.text.trim(),
          is_final: true,
          confidence: 0.9,
          speaker: 'Speaker'
        };

        console.log('✅ Desktop transcription:', data.text);
        this.onTranscription(transcriptData);
      }

    } catch (error) {
      console.error('❌ Error processing desktop audio:', error);
      this.onError('Failed to process audio');
    }
  }

  stopTranscription() {
    console.log('🛑 Stopping desktop Whisper transcription...');
    this.isRecording = false;

    if (this.transcriptionTimeout) {
      clearTimeout(this.transcriptionTimeout);
      this.transcriptionTimeout = null;
    }

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    this.mediaRecorder = null;
    this.audioChunks = [];
    this.overlapBuffer = [];
    this.chunkCount = 0;
    this.onStatusChange('Stopped');
  }

  isActive(): boolean {
    return this.isRecording;
  }
}
