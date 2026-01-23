import { supabase } from '@/integrations/supabase/client';

export interface TranscriptData {
  text: string;
  is_final: boolean;
  confidence: number;
  start?: number;
  end?: number;
}

export class WhisperBatchTranscriber {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private isRecording = false;
  private fullTranscript = '';

  constructor(
    private onTranscription: (data: TranscriptData) => void,
    private onError: (error: string) => void,
    private onStatusChange: (status: string) => void,
    private onSummary?: (summary: string) => void
  ) {}

  async startTranscription() {
    console.log('🚀 Starting Whisper batch recording...');
    
    try {
      this.onStatusChange('Connecting...');
      
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000
        }
      });
      
      // Use webm format for better compatibility
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
        ? 'audio/webm;codecs=opus' 
        : 'audio/webm';
      
      this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });
      this.audioChunks = [];
      this.fullTranscript = '';
      
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };
      
      this.mediaRecorder.onstart = () => {
        console.log('🎙️ Whisper batch recording started');
        this.isRecording = true;
        this.onStatusChange('recording');
        
        // Show status message to user
        this.onTranscription({
          text: '[Recording... Transcription will appear when you stop recording]',
          is_final: false,
          confidence: 1.0
        });
      };
      
      this.mediaRecorder.onstop = async () => {
        console.log('🛑 Whisper batch recording stopped, processing audio...');
        this.onStatusChange('Processing...');
        await this.processRecording();
      };
      
      // Record in 10-second chunks to build up audio
      this.mediaRecorder.start(10000);
      
    } catch (error) {
      console.error('❌ Failed to start Whisper batch recording:', error);
      this.onError('Failed to start recording: ' + (error as Error).message);
    }
  }

  stopTranscription() {
    console.log('🛑 Stopping Whisper batch transcription...');
    this.isRecording = false;
    
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
  }

  private async processRecording() {
    if (this.audioChunks.length === 0) {
      this.onStatusChange('Stopped');
      this.cleanup();
      return;
    }
    
    try {
      const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
      console.log('📦 Audio blob size:', audioBlob.size, 'bytes');
      
      // Convert to base64
      const arrayBuffer = await audioBlob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64Audio = btoa(binary);
      
      console.log('📤 Sending to Whisper API...');
      
      const { data, error } = await supabase.functions.invoke('standalone-whisper', {
        body: {
          audio: base64Audio,
          mimeType: 'audio/webm'
        }
      });
      
      if (error) throw error;
      
      if (data?.text) {
        console.log('✅ Whisper transcription received:', data.text.substring(0, 100));
        this.fullTranscript = data.text;
        
        this.onTranscription({
          text: data.text,
          is_final: true,
          confidence: data.confidence || 0.95
        });
      } else {
        console.warn('⚠️ No transcription text in response');
        this.onTranscription({
          text: '[No speech detected]',
          is_final: true,
          confidence: 0
        });
      }
      
      this.onStatusChange('Stopped');
      
    } catch (error) {
      console.error('❌ Whisper transcription failed:', error);
      this.onError('Transcription failed: ' + (error as Error).message);
      this.onStatusChange('error');
    } finally {
      this.cleanup();
    }
  }

  private cleanup() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    this.mediaRecorder = null;
    this.audioChunks = [];
  }

  isActive(): boolean {
    return this.isRecording;
  }

  async clearSummary() {
    this.fullTranscript = '';
    console.log('Whisper batch transcript cleared');
  }
}
