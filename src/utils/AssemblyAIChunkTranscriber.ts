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
          autoGainControl: true
        }
      });

      // Setup MediaRecorder
      this.mediaRecorder = new MediaRecorder(this.audioStream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.currentAudioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = async () => {
        if (this.currentAudioChunks.length > 0) {
          await this.processAudioChunk();
        }
      };

      // Start recording and set up chunking
      this.mediaRecorder.start();
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

    this.chunkInterval = setTimeout(() => {
      if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
        // Stop current recording to trigger data processing
        this.mediaRecorder.stop();
        
        // Start new recording for next chunk
        setTimeout(() => {
          if (this.isActive && this.mediaRecorder) {
            this.currentAudioChunks = []; // Reset for next chunk
            this.mediaRecorder.start();
            this.scheduleNextChunk(); // Schedule next chunk
          }
        }, 100);
      }
    }, this.chunkDurationMs);
  }

  private async processAudioChunk() {
    if (this.currentAudioChunks.length === 0) return;

    try {
      const chunkIndex = this.chunkIndex++;
      console.log(`🎵 Processing audio chunk ${chunkIndex}...`);
      
      this.onStatusChange(`Processing chunk ${chunkIndex}...`);

      // Combine all audio chunks into a single blob
      const audioBlob = new Blob(this.currentAudioChunks, { type: 'audio/webm;codecs=opus' });
      
      // Skip very small chunks (less than 1KB)
      if (audioBlob.size < 1000) {
        console.log('⏭️ Skipping tiny audio chunk');
        this.currentAudioChunks = [];
        return;
      }

      // Convert to base64 for transmission
      const arrayBuffer = await audioBlob.arrayBuffer();
      const base64Audio = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

      // Send to edge function
      const { data, error } = await supabase.functions.invoke('assemblyai-transcription', {
        body: { 
          audio: base64Audio,
          mimeType: 'audio/webm;codecs=opus',
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
      }

      this.onStatusChange(`Recording (processed ${chunkIndex + 1} chunks)`);
      
    } catch (error) {
      console.error('❌ Error processing audio chunk:', error);
      this.onError('Chunk processing failed: ' + error.message);
    }

    this.currentAudioChunks = [];
  }

  stopTranscription() {
    console.log('🛑 Stopping AssemblyAI chunk transcription...');
    this.isActive = false;
    
    if (this.chunkInterval) {
      clearTimeout(this.chunkInterval);
      this.chunkInterval = null;
    }
    
    // Process any remaining audio
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