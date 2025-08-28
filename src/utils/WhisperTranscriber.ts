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
  private chunkTimer: number | undefined = undefined;

  constructor(
    private onTranscription: (data: TranscriptData) => void,
    private onError: (error: string) => void,
    private onStatusChange: (status: string) => void,
    private onSummary?: (summary: string) => void
  ) {}

  async startTranscription() {
    if (this.isRecording) {
      console.warn("🎙️ Recorder already running; ignoring start.");
      return;
    }

    try {
      console.log('🎙️ Starting API-based Whisper transcription...');
      this.onStatusChange('Starting recording...');

      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 48000,
          channelCount: 1,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        }
      });

      this.mediaRecorder = new MediaRecorder(this.stream, { 
        mimeType: "audio/webm;codecs=opus" 
      });

      this.mediaRecorder.ondataavailable = async (e) => {
        if (e.data && e.data.size > 0) {
          await this.uploadChunk(e.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        this.isRecording = false;
        if (this.chunkTimer) { 
          clearTimeout(this.chunkTimer); 
          this.chunkTimer = undefined; 
        }
      };

      this.isRecording = true;
      this.mediaRecorder.start(); // no timeslice here; we'll stop manually per chunk
      this.scheduleNextChunk();
      
      this.onStatusChange('Recording');
      console.log('✅ API-based Whisper transcription started');
    } catch (error) {
      console.error('❌ Failed to start Whisper transcription:', error);
      this.onError(`Failed to start Whisper: ${error instanceof Error ? error.message : 'Unknown error'}`);
      this.onStatusChange('Error');
    }
  }

  private scheduleNextChunk() {
    if (!this.isRecording || !this.mediaRecorder) return;
    
    this.chunkTimer = window.setTimeout(() => {
      if (!this.mediaRecorder || this.mediaRecorder.state !== "recording") return;
      
      this.mediaRecorder.requestData(); // triggers ondataavailable
      this.mediaRecorder.stop();        // ensure it fully stops before restarting
      
      // restart only after stop has fired:
      const restart = () => {
        if (!this.mediaRecorder) return;
        this.mediaRecorder.onstop = () => {
          if (!this.isRecording) return;
          this.mediaRecorder!.start();   // safely restart
          this.scheduleNextChunk();
        };
      };
      
      // Small delay to let UA settle
      setTimeout(restart, 10);
    }, 2500); // 2.5s chunks
  }

  private async uploadChunk(audioData: Blob) {
    try {
      console.log('🔄 Processing audio chunk with process-meeting-audio function...');
      this.onStatusChange('Processing...');
      
      // Skip very small chunks
      if (audioData.size < 50000) {
        console.log('🔇 Skipping small audio chunk, size:', audioData.size);
        this.onStatusChange(this.isRecording ? 'Recording' : 'Stopped');
        return;
      }

      console.log('📡 Sending audio to process-meeting-audio function...', {
        blobSize: audioData.size,
        blobType: audioData.type
      });

      // Create FormData for the robust edge function
      const formData = new FormData();
      formData.append('file', audioData, 'chunk.webm');

      const { data, error } = await supabase.functions.invoke('process-meeting-audio', {
        body: formData
      });

      console.log('📨 Process-meeting-audio API Response:', { 
        data: data ? JSON.stringify(data, null, 2) : 'null',
        error: error ? JSON.stringify(error, null, 2) : 'null',
        hasData: !!data,
        hasError: !!error
      });

      if (error) {
        console.error('❌ Process-meeting-audio error:', {
          error: error,
          message: error.message || 'No message'
        });
        this.onError(`Transcription failed: ${error.message || error.toString()}`);
        return;
      }

      if (data?.text && data.text.trim()) {
        const cleanText = data.text.trim();
        console.log('📝 Whisper transcription:', cleanText);
        
        const transcriptData: TranscriptData = {
          text: cleanText,
          is_final: true,
          confidence: 0.9,
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
    
    if (!this.mediaRecorder) return;
    if (this.mediaRecorder.state === "recording") this.mediaRecorder.stop();
    this.isRecording = false;
    
    if (this.chunkTimer) {
      clearTimeout(this.chunkTimer);
      this.chunkTimer = undefined;
    }
    
    // Stop all tracks
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }
    
    this.mediaRecorder = null;
    this.stream = null;
    
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