import { supabase } from '@/integrations/supabase/client';

export interface TranscriptData {
  text: string;
  is_final: boolean;
  confidence: number;
  start?: number;
  end?: number;
  chunkIndex?: number;
}

export class WhisperChunkTranscriber {
  private mediaRecorder: MediaRecorder | null = null;
  private audioStream: MediaStream | null = null;
  private isActive = false;
  private chunkIndex = 0;
  private chunkInterval: NodeJS.Timeout | null = null;
  private currentAudioChunks: Blob[] = [];
  private readonly firstChunkDurationMs: number;
  private readonly subsequentChunkDurationMs: number;
  private readonly language?: string;

  constructor(
    private onTranscription: (data: TranscriptData) => void,
    private onError: (error: string) => void,
    private onStatusChange: (status: string) => void,
    options?: { chunkDurationMs?: number; firstChunkDurationMs?: number; subsequentChunkDurationMs?: number; language?: string }
  ) {
    this.firstChunkDurationMs = options?.firstChunkDurationMs ?? options?.chunkDurationMs ?? 5000;
    this.subsequentChunkDurationMs = options?.subsequentChunkDurationMs ?? options?.chunkDurationMs ?? 90000;
    this.language = options?.language;
  }

  async startTranscription() {
    console.log('🚀 Starting Whisper chunk transcription via edge function...');
    try {
      this.onStatusChange('Starting...');

      // Get microphone access (single channel, noise suppressed)
      this.audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Setup MediaRecorder (webm/opus)
      const mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        console.warn('Requested mimeType not supported, using browser default');
      }

      this.mediaRecorder = new MediaRecorder(this.audioStream, { mimeType });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) this.currentAudioChunks.push(event.data);
      };

      this.mediaRecorder.onstop = async () => {
        if (this.currentAudioChunks.length > 0) await this.processAudioChunk();
      };

      // Start recording and chunking
      this.mediaRecorder.start();
      this.isActive = true;
      this.onStatusChange('Recording (Whisper)');
      this.scheduleNextChunk();

      console.log('✅ Whisper chunk transcription started');
    } catch (error: any) {
      console.error('❌ Failed to start Whisper chunk transcription:', error);
      this.onError('Failed to start: ' + (error?.message || String(error)));
      this.cleanup();
    }
  }

  private scheduleNextChunk() {
    if (!this.isActive) return;
    this.chunkInterval = setTimeout(() => {
      if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
        this.mediaRecorder.stop();
        setTimeout(() => {
          if (this.isActive && this.mediaRecorder) {
            this.currentAudioChunks = [];
            this.mediaRecorder.start();
            this.scheduleNextChunk();
          }
        }, 120);
      }
    }, this.chunkDurationMs);
  }

  private async processAudioChunk() {
    if (this.currentAudioChunks.length === 0) return;

    try {
      const chunkIndex = this.chunkIndex++;
      console.log(`🎵 Processing Whisper audio chunk ${chunkIndex}...`);
      this.onStatusChange(`Processing chunk ${chunkIndex + 1}...`);

      // Combine chunks -> Blob
      const audioBlob = new Blob(this.currentAudioChunks, { type: 'audio/webm;codecs=opus' });
      if (audioBlob.size < 1000) {
        console.log('⏭️ Skipping tiny audio chunk');
        this.currentAudioChunks = [];
        return;
      }

      // Blob -> base64 (process in chunks to avoid stack overflow on iPhone)
      const arrayBuffer = await audioBlob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      let binaryString = '';
      const chunkSize = 8192; // Process 8KB at a time
      
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
        let segment = '';
        for (let j = 0; j < chunk.length; j++) {
          segment += String.fromCharCode(chunk[j]);
        }
        binaryString += segment;
      }
      
      const base64Audio = btoa(binaryString);

      // Send to Whisper edge function
      const { data, error } = await supabase.functions.invoke('speech-to-text-consultation', {
        body: {
          audio: base64Audio,
          // language optional; whisper can auto-detect; include if provided
          language: this.language,
        },
      });

      if (error) {
        console.error('❌ Whisper transcription error:', error);
        this.onError('Transcription failed: ' + error.message);
        return;
      }

      const text = (data?.text || '').trim();
      const confidence = typeof data?.confidence === 'number' ? data.confidence : 0.85;

      if (text) {
        const transcriptData: TranscriptData = {
          text,
          is_final: true,
          confidence,
          chunkIndex,
        };
        console.log(`📝 Whisper chunk ${chunkIndex} transcribed:`, text);
        this.onTranscription(transcriptData);
      }

      this.onStatusChange(`Recording (Whisper, processed ${chunkIndex + 1} chunks)`);
    } catch (error: any) {
      console.error('❌ Error processing Whisper chunk:', error);
      this.onError('Chunk processing failed: ' + (error?.message || String(error)));
    }

    this.currentAudioChunks = [];
  }

  stopTranscription() {
    console.log('🛑 Stopping Whisper chunk transcription...');
    this.isActive = false;

    if (this.chunkInterval) {
      clearTimeout(this.chunkInterval);
      this.chunkInterval = null;
    }

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
      try {
        if (this.mediaRecorder.state !== 'inactive') this.mediaRecorder.stop();
      } catch {}
      this.mediaRecorder = null;
    }

    if (this.audioStream) {
      this.audioStream.getTracks().forEach((t) => t.stop());
      this.audioStream = null;
    }
  }

  async clearSummary() {
    // No summaries in this mode
  }
}
