// HTTP-based chunk transcription for AssemblyAI
import { supabase } from '@/integrations/supabase/client';

export interface TranscriptData {
  text: string;
  is_final: boolean;
  confidence: number;
  start?: number;
  end?: number;
  chunkIndex?: number;
}

export class AssemblyAIChunkTranscriber {
  private mediaRecorder: MediaRecorder | null = null;
  private audioStream: MediaStream | null = null;
  private isActive = false;
  private chunkIndex = 0;
  private chunkInterval: NodeJS.Timeout | null = null;
  private currentAudioChunks: Blob[] = [];

  constructor(
    private onTranscription: (data: TranscriptData) => void,
    private onError: (error: string) => void,
    private onStatusChange: (status: string) => void,
    private onSummary?: (summary: string) => void,
    private chunkDurationMs: number = 15000 // 15 seconds per chunk
  ) {}

  async startTranscription() {
    console.log('🚀 Starting AssemblyAI chunk transcription...');
    
    try {
      this.onStatusChange('Starting...');
      
      // Get microphone access
      this.audioStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false // Disable AGC for better quality
        }
      });

      // Setup MediaRecorder with better format
      const mimeType = MediaRecorder.isTypeSupported('audio/wav') 
        ? 'audio/wav' 
        : 'audio/webm;codecs=opus';
      
      this.mediaRecorder = new MediaRecorder(this.audioStream, {
        mimeType,
        audioBitsPerSecond: 128000
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          console.log(`📦 Audio chunk received: ${event.data.size} bytes`);
          this.currentAudioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = async () => {
        if (this.currentAudioChunks.length > 0 && this.isActive) {
          await this.processAudioChunk();
        }
      };

      // Start recording with time slice for consistent chunks
      this.mediaRecorder.start(1000); // 1 second time slices
      this.isActive = true;
      this.onStatusChange('Recording (chunk-based)');

      // Process audio in chunks
      this.scheduleNextChunk();
      
      console.log('✅ AssemblyAI chunk transcription started');
      
    } catch (error) {
      console.error('❌ Failed to start AssemblyAI chunk transcription:', error);
      this.onError('Failed to start: ' + error.message);
      this.cleanup();
    }
  }

  private scheduleNextChunk() {
    if (!this.isActive) return;

    this.chunkInterval = setTimeout(async () => {
      if (this.mediaRecorder && this.mediaRecorder.state === 'recording' && this.isActive) {
        // Process current chunks without stopping recording
        if (this.currentAudioChunks.length > 0) {
          const chunksToProcess = [...this.currentAudioChunks];
          this.currentAudioChunks = []; // Clear for next batch
          
          // Process chunks while continuing to record
          await this.processAudioChunks(chunksToProcess);
        }
        
        // Schedule next chunk processing
        this.scheduleNextChunk();
      }
    }, this.chunkDurationMs);
  }

  private async processAudioChunks(chunks: Blob[]) {
    if (chunks.length === 0) return;

    try {
      const chunkIndex = this.chunkIndex++;
      console.log(`🎵 Processing audio chunk ${chunkIndex}...`);
      
      this.onStatusChange(`Processing chunk ${chunkIndex}...`);

      // Combine all audio chunks into a single blob
      const audioBlob = new Blob(chunks);
      
      // Skip very small chunks (less than 2KB)
      if (audioBlob.size < 2000) {
        console.log('⏭️ Skipping tiny audio chunk');
        return;
      }

      // Convert to base64 using chunked approach to avoid stack overflow
      const arrayBuffer = await audioBlob.arrayBuffer();
      const base64Audio = this.arrayBufferToBase64(arrayBuffer);

      // Send to edge function
      try {
        const { data, error } = await supabase.functions.invoke('assemblyai-transcription', {
          body: { 
            audio: base64Audio,
            mimeType: audioBlob.type || 'audio/wav',
            chunkIndex
          }
        });

        if (error) {
          console.error('❌ AssemblyAI transcription error:', error);
          this.onError('Transcription failed: ' + error.message);
          return;
        }

        if (data?.text?.trim()) {
          const transcriptData: TranscriptData = {
            text: data.text.trim(),
            is_final: true,
            confidence: data.confidence || 0.9,
            chunkIndex
          };
          
          console.log(`📝 Chunk ${chunkIndex} transcribed:`, transcriptData.text);
          this.onTranscription(transcriptData);
        } else {
          console.log(`📝 Chunk ${chunkIndex} had no transcribable audio`);
        }

        this.onStatusChange(`Recording (processed ${chunkIndex + 1} chunks)`);
        
      } catch (fetchError) {
        console.error('❌ Edge function call failed:', fetchError);
        this.onError('Network error: ' + fetchError.message);
      }
      
    } catch (error) {
      console.error('❌ Error processing audio chunk:', error);
      this.onError('Chunk processing failed: ' + error.message);
    }
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    const chunkSize = 8192; // Process in 8KB chunks to avoid stack overflow
    let binary = '';
    
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.slice(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    
    return btoa(binary);
  }

  private async processAudioChunk() {
    // Legacy method - redirect to new chunked processing
    if (this.currentAudioChunks.length > 0) {
      await this.processAudioChunks([...this.currentAudioChunks]);
      this.currentAudioChunks = [];
    }
  }

  async stopTranscription() {
    console.log('🛑 Stopping AssemblyAI chunk transcription...');
    this.isActive = false;
    
    if (this.chunkInterval) {
      clearTimeout(this.chunkInterval);
      this.chunkInterval = null;
    }
    
    // Process any remaining audio chunks
    if (this.currentAudioChunks.length > 0) {
      console.log('🔄 Processing final audio chunks...');
      await this.processAudioChunks([...this.currentAudioChunks]);
      this.currentAudioChunks = [];
    }
    
    // Stop recorder gracefully
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
    }
    
    this.cleanup();
    this.onStatusChange('Stopped');
  }

  isRecording(): boolean {
    return this.isActive;
  }

  private cleanup() {
    if (this.chunkInterval) {
      clearTimeout(this.chunkInterval);
      this.chunkInterval = null;
    }

    if (this.mediaRecorder) {
      if (this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
      }
      this.mediaRecorder = null;
    }

    if (this.audioStream) {
      this.audioStream.getTracks().forEach(track => track.stop());
      this.audioStream = null;
    }
  }

  async clearSummary() {
    console.log('AssemblyAI chunk transcriber does not maintain summaries');
  }
}