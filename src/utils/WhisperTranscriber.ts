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

      console.log('🎤 Requesting microphone access...');
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 48000,
          channelCount: 1,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        }
      });
      console.log('✅ Microphone access granted');

      console.log('🔧 Creating MediaRecorder...');
      // Use specific codec settings for better chunk compatibility
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
        ? 'audio/webm;codecs=opus' 
        : 'audio/webm';
      
      console.log('🎵 Using MediaRecorder mimeType:', mimeType);
      
      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: mimeType,
        audioBitsPerSecond: 128000 // Set a consistent bitrate for better chunk quality
      });

      this.mediaRecorder.ondataavailable = async (e) => {
        console.log('📡 MediaRecorder data available:', {
          hasData: !!e.data,
          dataSize: e.data?.size || 0,
          timestamp: new Date().toISOString()
        });
        
        if (e.data && e.data.size > 0) {
          await this.uploadChunk(e.data);
        } else {
          console.warn('⚠️ No audio data available in chunk');
        }
      };

      this.mediaRecorder.onstop = () => {
        console.log('🛑 MediaRecorder stopped (this should not happen during continuous recording)');
        // Don't set isRecording to false here for continuous recording
        if (this.chunkTimer) { 
          clearTimeout(this.chunkTimer); 
          this.chunkTimer = undefined; 
        }
      };

      this.mediaRecorder.onerror = (event) => {
        console.error('❌ MediaRecorder error:', event);
        this.onError('MediaRecorder error occurred');
      };

      this.isRecording = true;
      console.log('▶️ Starting MediaRecorder...');
      this.mediaRecorder.start(); 
      this.scheduleNextChunk();
      
      this.onStatusChange('Recording');
      console.log('✅ API-based Whisper transcription started successfully');
    } catch (error) {
      console.error('❌ Failed to start Whisper transcription:', error);
      this.onError(`Failed to start Whisper: ${error instanceof Error ? error.message : 'Unknown error'}`);
      this.onStatusChange('Error');
    }
  }

  private scheduleNextChunk() {
    if (!this.isRecording || !this.mediaRecorder) {
      console.log('⚠️ Not scheduling next chunk - recording stopped or no recorder');
      return;
    }
    
    this.chunkTimer = window.setTimeout(() => {
      if (!this.mediaRecorder || !this.isRecording) {
        console.log('⚠️ Timer fired but recording stopped or no recorder');
        return;
      }
      
      if (this.mediaRecorder.state !== "recording") {
        console.log('⚠️ MediaRecorder not in recording state:', this.mediaRecorder.state);
        return;
      }
      
      console.log('⏰ Processing 3.5s audio chunk...');
      this.mediaRecorder.requestData(); // triggers ondataavailable
      
      // Don't stop the recorder - just request data and continue
      this.scheduleNextChunk(); // Schedule the next chunk immediately
    }, 3500); // 3.5s chunks for better audio capture
  }

  private async uploadChunk(audioData: Blob) {
    try {
      console.log('🔄 Processing audio chunk with process-meeting-audio function...');
      console.log('📊 Audio chunk details:', {
        size: audioData.size,
        type: audioData.type,
        sizeInKB: Math.round(audioData.size / 1024)
      });
      
      this.onStatusChange('Processing...');
      
      // Skip very small chunks (lowered threshold significantly)
      if (audioData.size < 10000) {
        console.log('🔇 Skipping very small audio chunk, size:', audioData.size);
        this.onStatusChange(this.isRecording ? 'Recording' : 'Stopped');
        return;
      }

      console.log('📡 Sending audio to process-meeting-audio function...');

      // Create FormData for the robust edge function
      const formData = new FormData();
      formData.append('file', audioData, 'chunk.webm');

      console.log('🚀 Invoking process-meeting-audio edge function...');
      const { data, error } = await supabase.functions.invoke('process-meeting-audio', {
        body: formData
      });

      console.log('📨 Process-meeting-audio Response:', { 
        hasData: !!data,
        hasError: !!error,
        dataKeys: data ? Object.keys(data) : [],
        errorMessage: error?.message || 'No error message'
      });

      if (error) {
        console.error('❌ Process-meeting-audio error details:', {
          error: error,
          message: error.message || 'No message',
          details: error.details || 'No details',
          hint: error.hint || 'No hint',
          code: error.code || 'No code'
        });
        this.onError(`Transcription failed: ${error.message || error.toString()}`);
        return;
      }

      if (data?.text && data.text.trim()) {
        const cleanText = data.text.trim();
        console.log('📝 Whisper transcription SUCCESS:', cleanText);
        
        const transcriptData: TranscriptData = {
          text: cleanText,
          is_final: true,
          confidence: data.confidence || 0.9,
          speaker: 'Speaker'
        };
        
        console.log('✅ Calling onTranscription with:', transcriptData);
        this.onTranscription(transcriptData);
        
        if (this.onSummary) {
          this.onSummary(cleanText);
        }
      } else {
        console.log('ℹ️ No transcript text received. Full response:', JSON.stringify(data, null, 2));
        console.log('⚠️ Response analysis:', {
          hasText: !!data?.text,
          textLength: data?.text?.length || 0,
          textContent: data?.text || 'No text property',
          responseKeys: data ? Object.keys(data) : []
        });
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