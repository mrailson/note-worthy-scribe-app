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
  private uploadQueue: Promise<void> = Promise.resolve();

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
          channelCount: 1,              // mono is best for STT
          sampleRate: 48000,            // browsers usually give 48 kHz; Whisper will resample
          noiseSuppression: true,       // useful for live mic
          echoCancellation: true,       // true if mic + speakers
          autoGainControl: false        // avoid volume pumping; let Whisper handle dynamics
        }
      });
      console.log('✅ Microphone access granted');

      console.log('🔧 Creating MediaRecorder...');
      // Use known-good settings for Whisper
      const mimeType = 'audio/webm;codecs=opus'; // Whisper accepts webm/opus
      
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        throw new Error(`MediaRecorder does not support ${mimeType}`);
      }
      
      console.log('🎵 Using MediaRecorder mimeType:', mimeType);
      
      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: mimeType,
        audioBitsPerSecond: 128000 // ~128 kbps VBR is a good balance
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
        console.log('🛑 MediaRecorder stopped');
        this.isRecording = false;
      };

      this.mediaRecorder.onerror = (event) => {
        console.error('❌ MediaRecorder error:', event);
        this.onError('MediaRecorder error occurred');
      };

      this.isRecording = true;
      console.log('▶️ Starting MediaRecorder...');
      this.mediaRecorder.start(3000); // Fire dataavailable every 3s for optimal chunk size
      
      this.onStatusChange('Recording');
      console.log('✅ API-based Whisper transcription started successfully');
    } catch (error) {
      console.error('❌ Failed to start Whisper transcription:', error);
      this.onError(`Failed to start Whisper: ${error instanceof Error ? error.message : 'Unknown error'}`);
      this.onStatusChange('Error');
    }
  }

  // Remove the old chunk scheduling methods since MediaRecorder now handles timing

  private async uploadChunk(audioData: Blob) {
    // Queue uploads to prevent concurrent requests that cause 500 errors
    this.uploadQueue = this.uploadQueue.then(() => this.processChunkWithRetry(audioData));
    return this.uploadQueue;
  }

  private async processChunkWithRetry(audioData: Blob, maxRetries = 3) {
    let delay = 300;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.processChunk(audioData);
        return; // Success - exit retry loop
      } catch (error) {
        console.warn(`❌ Upload attempt ${attempt}/${maxRetries} failed:`, error);
        
        if (attempt === maxRetries) {
          console.error('❌ All retry attempts failed');
          this.onError(`Upload failed after ${maxRetries} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`);
          return;
        }
        
        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2;
      }
    }
  }

  private async processChunk(audioData: Blob) {
    try {
      console.log('🔄 [v4] Processing audio chunk with speech-to-text function...');
      console.log('📊 Audio chunk details:', {
        size: audioData.size,
        type: audioData.type,
        sizeInKB: Math.round(audioData.size / 1024)
      });
      
      this.onStatusChange('Processing...');
      
      // Skip very small chunks
      if (audioData.size < 10000) {
        console.log('🔇 Skipping very small audio chunk, size:', audioData.size);
        this.onStatusChange(this.isRecording ? 'Recording' : 'Stopped');
        return;
      }

      console.log('📤 Sending binary audio data to speech-to-text function...');
      
      // Send binary data directly instead of base64 (more efficient)
      const arrayBuffer = await audioData.arrayBuffer();
      
      // Use the optimized speech-to-text function with proper parameters
      const { data, error } = await supabase.functions.invoke('speech-to-text', {
        body: { 
          audioData: Array.from(new Uint8Array(arrayBuffer)), // Send as byte array
          mimeType: audioData.type,
          language: "en",             // Force English for NHS context
          temperature: 0,             // Stable output for meeting notes
          // Bias decoding with common NHS terms
          prompt: "NHS, PCN, DES, ARRS, QOF, EMIS, SystmOne, locum, CQC, practice, patient, consultation, medication, prescription, referral, appointment"
        }
      });

      console.log('📨 Speech-to-text Response:', { 
        hasData: !!data,
        hasError: !!error,
        dataKeys: data ? Object.keys(data) : [],
        errorMessage: error?.message || 'No error message'
      });

      if (error) {
        console.error('❌ Speech-to-text error details:', {
          error: error,
          message: error.message || 'No message',
          details: error.details || 'No details',
          hint: error.hint || 'No hint',
          code: error.code || 'No code'
        });
        throw new Error(`Transcription failed: ${error.message || error.toString()}`);
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
      // Re-throw error so retry logic can handle it
      throw error;
    }
  }

  stopTranscription() {
    console.log('🛑 Stopping Whisper transcription...');
    
    this.isRecording = false;
    
    if (this.mediaRecorder && this.mediaRecorder.state === "recording") {
      this.mediaRecorder.stop();
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