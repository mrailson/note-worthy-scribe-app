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
  private audioChunks: Blob[] = [];
  private chunkCounter = 0;
  private networkRetryCount = 0;
  private maxNetworkRetries = 3;

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
      // Use WAV format which is more reliable for chunked audio
      const mimeType = 'audio/wav'; 
      
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        // Fallback to WebM if WAV not supported
        const fallbackType = 'audio/webm';
        if (!MediaRecorder.isTypeSupported(fallbackType)) {
          throw new Error(`MediaRecorder does not support ${mimeType} or ${fallbackType}`);
        }
        console.log('🎵 Using fallback MediaRecorder mimeType:', fallbackType);
        this.mediaRecorder = new MediaRecorder(this.stream, {
          mimeType: fallbackType,
          audioBitsPerSecond: 128000
        });
      } else {
        console.log('🎵 Using MediaRecorder mimeType:', mimeType);
        this.mediaRecorder = new MediaRecorder(this.stream, {
          mimeType: mimeType,
          audioBitsPerSecond: 128000
        });
      }

      this.mediaRecorder.ondataavailable = async (e) => {
        console.log('📡 MediaRecorder data available:', {
          hasData: !!e.data,
          dataSize: e.data?.size || 0,
          timestamp: new Date().toISOString(),
          chunkNumber: this.chunkCounter++
        });
        
        if (e.data && e.data.size > 0) {
          // Collect chunks instead of processing individually
          this.audioChunks.push(e.data);
          
          // Process accumulated audio every few chunks or when we have enough data
          if (this.audioChunks.length >= 1) { // Process each chunk individually but as complete WebM
            await this.processAccumulatedAudio();
          }
        } else {
          console.warn('⚠️ No audio data available in chunk');
        }
      };

      this.mediaRecorder.onstop = () => {
        console.log('🛑 MediaRecorder stopped');
        // Process any remaining chunks when recording stops
        if (this.audioChunks.length > 0) {
          this.processAccumulatedAudio();
        }
        this.isRecording = false;
      };

      this.mediaRecorder.onerror = (event) => {
        console.error('❌ MediaRecorder error:', event);
        this.onError('MediaRecorder error occurred');
      };

      this.isRecording = true;
      console.log('▶️ Starting MediaRecorder...');
      this.mediaRecorder.start(5000); // 5-second chunks for better WebM structure
      
      this.onStatusChange('Recording');
      console.log('✅ API-based Whisper transcription started successfully');
    } catch (error) {
      console.error('❌ Failed to start Whisper transcription:', error);
      this.onError(`Failed to start Whisper: ${error instanceof Error ? error.message : 'Unknown error'}`);
      this.onStatusChange('Error');
    }
  }

  private async processAccumulatedAudio() {
    if (this.audioChunks.length === 0) return;
    
    // Take the latest chunk (which should be a complete WebM segment)
    const latestChunk = this.audioChunks.pop()!;
    this.audioChunks = []; // Clear the buffer
    
    // Process the complete chunk
    await this.uploadChunk(latestChunk);
  }

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
        this.networkRetryCount = 0; // Reset network retry count on success
        return; // Success - exit retry loop
      } catch (error) {
        console.warn(`❌ Upload attempt ${attempt}/${maxRetries} failed:`, error);
        
        // Check if it's a network error
        const isNetworkError = error instanceof Error && (
          error.message.includes('Failed to fetch') ||
          error.message.includes('NetworkError') ||
          error.message.includes('ERR_NETWORK') ||
          error.message.includes('ERR_INTERNET_DISCONNECTED')
        );
        
        if (isNetworkError) {
          this.networkRetryCount++;
          this.onStatusChange(`Network issue detected (${this.networkRetryCount}/${this.maxNetworkRetries})`);
          
          if (this.networkRetryCount >= this.maxNetworkRetries) {
            console.error('❌ Max network retries reached. Stopping transcription.');
            this.onError(`Network connectivity lost. Tried ${this.maxNetworkRetries} times.`);
            this.stopTranscription();
            return;
          }
        }
        
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
      console.log('🔄 [v7-DIAGNOSTIC] Processing audio chunk with Supabase client...');
      console.log('📊 Audio chunk details:', {
        size: audioData.size,
        type: audioData.type,
        sizeInKB: Math.round(audioData.size / 1024),
        timestamp: new Date().toISOString()
      });
      
      this.onStatusChange('Processing...');
      
      // Skip very small chunks
      if (audioData.size < 1000) {
        console.log('🔇 Skipping very small audio chunk, size:', audioData.size);
        this.onStatusChange(this.isRecording ? 'Recording' : 'Stopped');
        return;
      }

      console.log('📤 [DIAGNOSTIC] Preparing to send audio data via Supabase client...');
      
      // Add network connectivity check
      if (!navigator.onLine) {
        console.error('❌ [DIAGNOSTIC] No internet connection available');
        throw new Error('No internet connection available');
      }
      
      console.log('🌐 [DIAGNOSTIC] Network connectivity confirmed');
      
      // Convert Blob to ArrayBuffer for Supabase client
      const arrayBuffer = await audioData.arrayBuffer();
      console.log('🚀 [DIAGNOSTIC] Sending request via Supabase client...');
      
      // Use Supabase client which handles authentication automatically
      const { data, error } = await supabase.functions.invoke('speech-to-text', {
        body: {
          audio: btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))
        }
      });
      
      console.log('📥 [DIAGNOSTIC] Received response from Supabase client:', {
        hasData: !!data,
        hasError: !!error,
        error: error,
        timestamp: new Date().toISOString()
      });

      if (error) {
        console.error('❌ Supabase function error:', error);
        throw new Error(`Transcription failed: ${error.message || JSON.stringify(error)}`);
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
      }
      
      this.onStatusChange(this.isRecording ? 'Recording' : 'Stopped');
    } catch (error) {
      console.error('❌ [DIAGNOSTIC] Whisper processing error details:', {
        error: error,
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace',
        name: error instanceof Error ? error.name : 'Unknown error type',
        timestamp: new Date().toISOString()
      });
      
      // Re-throw error so retry logic can handle it
      throw error;
    }
  }

  stopTranscription() {
    console.log('🛑 Stopping Whisper transcription...');
    
    this.isRecording = false;
    
    // Process any remaining audio chunks
    if (this.audioChunks.length > 0) {
      this.processAccumulatedAudio();
    }
    
    if (this.mediaRecorder && this.mediaRecorder.state === "recording") {
      this.mediaRecorder.stop();
    }
    
    // Stop all tracks
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }
    
    this.mediaRecorder = null;
    this.stream = null;
    this.audioChunks = [];
    this.chunkCounter = 0;
    
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