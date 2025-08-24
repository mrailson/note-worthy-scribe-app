import { pipeline } from '@huggingface/transformers';

export interface TranscriptData {
  text: string;
  is_final: boolean;
  confidence: number;
  start?: number;
  end?: number;
  speaker?: string;
}

export class WhisperTranscriber {
  private transcriber: any = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private isRecording = false;
  private recordingInterval: NodeJS.Timeout | null = null;

  constructor(
    private onTranscription: (data: TranscriptData) => void,
    private onError: (error: string) => void,
    private onStatusChange: (status: string) => void,
    private onSummary?: (summary: string) => void
  ) {}

  async startTranscription() {
    try {
      this.onStatusChange('Loading Whisper model...');
      console.log('🤖 Loading Whisper model...');
      
      // Load the Whisper model (this may take a while on first load)
      this.transcriber = await pipeline(
        "automatic-speech-recognition",
        "onnx-community/whisper-tiny.en",
        { device: "webgpu" }
      );
      
      console.log('✅ Whisper model loaded');
      this.onStatusChange('Starting recording...');

      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        } 
      });

      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = async () => {
        if (this.audioChunks.length > 0) {
          const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
          this.audioChunks = [];
          await this.processAudioChunk(audioBlob);
        }
      };

      this.isRecording = true;
      this.onStatusChange('Recording');
      
      // Start recording in chunks for real-time processing
      this.startChunkedRecording();
      
      console.log('🎙️ Whisper transcription started');
    } catch (error) {
      console.error('❌ Failed to start Whisper transcription:', error);
      this.onError(`Failed to start Whisper: ${error instanceof Error ? error.message : 'Unknown error'}`);
      this.onStatusChange('Error');
    }
  }

  private startChunkedRecording() {
    if (!this.mediaRecorder) return;

    this.mediaRecorder.start();
    
    // Process audio in 3-second chunks for near real-time transcription
    this.recordingInterval = setInterval(() => {
      if (this.mediaRecorder && this.isRecording && this.mediaRecorder.state === 'recording') {
        this.mediaRecorder.stop();
        // Start recording again immediately
        setTimeout(() => {
          if (this.isRecording && this.mediaRecorder) {
            this.mediaRecorder.start();
          }
        }, 100);
      }
    }, 3000);
  }

  private async processAudioChunk(audioBlob: Blob) {
    if (!this.transcriber) return;

    try {
      console.log('🔄 Processing audio chunk with Whisper...');
      this.onStatusChange('Processing...');
      
      // Convert blob to ArrayBuffer for Whisper
      const audioBuffer = await audioBlob.arrayBuffer();
      
      // Create a temporary URL for the audio
      const audioUrl = URL.createObjectURL(audioBlob);
      
      // Transcribe the audio
      const result = await this.transcriber(audioUrl);
      
      // Clean up the URL
      URL.revokeObjectURL(audioUrl);
      
      if (result?.text && result.text.trim()) {
        console.log('📝 Whisper transcription:', result.text);
        
        const transcriptData: TranscriptData = {
          text: result.text.trim(),
          is_final: true,
          confidence: 0.8, // Whisper doesn't provide confidence scores
          speaker: 'Speaker'
        };
        
        this.onTranscription(transcriptData);
        
        if (this.onSummary) {
          this.onSummary(result.text);
        }
      }
      
      this.onStatusChange(this.isRecording ? 'Recording' : 'Stopped');
    } catch (error) {
      console.error('❌ Whisper processing error:', error);
      this.onError(`Whisper processing error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  stopTranscription() {
    console.log('🛑 Stopping Whisper transcription...');
    this.isRecording = false;
    
    if (this.recordingInterval) {
      clearInterval(this.recordingInterval);
      this.recordingInterval = null;
    }
    
    if (this.mediaRecorder) {
      if (this.mediaRecorder.state === 'recording') {
        this.mediaRecorder.stop();
      }
      
      // Stop all tracks
      if (this.mediaRecorder.stream) {
        this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
      }
      
      this.mediaRecorder = null;
    }
    
    this.onStatusChange('Stopped');
    console.log('✅ Whisper transcription stopped');
  }

  isActive(): boolean {
    return this.isRecording;
  }

  async clearSummary() {
    // Whisper doesn't maintain a summary, so this is a no-op
    console.log('🧹 Clearing Whisper summary (no-op)');
  }
}