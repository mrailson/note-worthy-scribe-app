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
      console.log('🔄 [v5] Processing audio chunk with speech-to-text function...');
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

      console.log('📤 Converting audio to base64 for transport...');
      
      // Convert to base64 for transport (standard approach that works)
      const arrayBuffer = await audioData.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // Process in chunks to avoid memory issues
      const chunkSize = 32768;
      let binary = '';
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
        binary += String.fromCharCode.apply(null, Array.from(chunk));
      }
      const base64Audio = btoa(binary);
      
      // Use the proven speech-to-text function with base64 (what works in meeting recorder)
      const { data, error } = await supabase.functions.invoke('speech-to-text', {
        body: { 
          audio: base64Audio,
          language: "en",
          temperature: 0,
          // NHS-specific prompt for better accuracy
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