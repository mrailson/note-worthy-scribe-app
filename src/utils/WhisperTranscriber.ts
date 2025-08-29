import { supabase } from "@/integrations/supabase/client";

export interface TranscriptData {
  text: string;
  is_final: boolean;
  confidence: number;
  start?: number;
  end?: number;
  speaker?: string;
}

// === Non-recursive retry-safe networking + queue ===
const BACKOFF_MS = [250, 600, 1200];
const MAX_ATTEMPTS = 3;

type UploadItem = { blob: Blob; meta?: { chunkIndex?: number } };

export class WhisperTranscriber {
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private isRecording = false;
  private queue: UploadItem[] = [];
  private processing = false;
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
      // Use WebM with longer chunks to avoid incomplete audio files
      const mimeType = 'audio/webm;codecs=opus';
      
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        throw new Error(`MediaRecorder does not support ${mimeType}`);
      }
      
      console.log('🎵 Using MediaRecorder mimeType:', mimeType);
      
      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: mimeType,
        audioBitsPerSecond: 128000
      });

      this.mediaRecorder.ondataavailable = (e) => {
        console.log('📡 MediaRecorder data available:', {
          hasData: !!e.data,
          dataSize: e.data?.size || 0,
          timestamp: new Date().toISOString(),
          chunkNumber: this.chunkCounter
        });
        
        if (e.data && e.data.size > 0) {
          // Enqueue chunk - no awaits to prevent re-entrancy
          this.enqueueChunk(e.data, { chunkIndex: this.chunkCounter++ });
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
      this.mediaRecorder.start(10000); // 10-second chunks to avoid incomplete WebM files
      
      this.onStatusChange('Recording');
      console.log('✅ API-based Whisper transcription started successfully');
    } catch (error) {
      console.error('❌ Failed to start Whisper transcription:', error);
      this.onError(`Failed to start Whisper: ${error instanceof Error ? error.message : 'Unknown error'}`);
      this.onStatusChange('Error');
    }
  }


  /** Call this from mediaRecorder.ondataavailable */
  private enqueueChunk(blob: Blob, meta?: { chunkIndex?: number }) {
    if (!blob || !blob.size) return;
    this.queue.push({ blob, meta });
    // Fire-and-forget; no awaits -> no accidental re-entrancy
    this.drainQueue().catch(e => this.onError(`Queue processing error: ${e.message}`));
  }

  private async drainQueue() {
    if (this.processing) return;
    this.processing = true;
    try {
      while (this.queue.length) {
        const item = this.queue.shift()!;
        const res = await this.uploadWithRetry(() => this.uploadOnce(item));
        // IMPORTANT: onTranscription must NOT call enqueue/process again
        if (res?.data?.text && res.data.text.trim()) {
          const cleanText = res.data.text.trim();
          console.log('📝 Whisper transcription SUCCESS:', cleanText);
          
          const transcriptData: TranscriptData = {
            text: cleanText,
            is_final: true,
            confidence: res.data.confidence || 0.9,
            speaker: 'Speaker'
          };
          
          console.log('✅ Calling onTranscription with:', transcriptData);
          this.onTranscription(transcriptData);
          
          if (this.onSummary) {
            this.onSummary(cleanText);
          }
        }
        
        // Add delay between requests
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } finally {
      this.processing = false;
    }
  }

  private async uploadWithRetry(doUpload: () => Promise<any>) {
    let lastErr: any;
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      try {
        return await doUpload();
      } catch (e) {
        lastErr = e;
        if (i < MAX_ATTEMPTS - 1) {
          const wait = BACKOFF_MS[i] ?? BACKOFF_MS[BACKOFF_MS.length - 1];
          console.warn(`❌ Upload attempt ${i + 1}/${MAX_ATTEMPTS} failed, retrying in ${wait}ms:`, e);
          await new Promise(r => setTimeout(r, wait));
        }
      }
    }
    console.error('❌ All retry attempts failed:', lastErr);
    throw lastErr;
  }

  /** Single network call. Never calls drainQueue/uploadWithRetry/process* */
  private async uploadOnce(item: UploadItem) {
    const { blob, meta } = item;
    
    console.log('🔄 [v8-DIAGNOSTIC] Processing audio chunk with Supabase client...');
    console.log('📊 Audio chunk details:', {
      size: blob.size,
      type: blob.type,
      sizeInKB: Math.round(blob.size / 1024),
      timestamp: new Date().toISOString(),
      chunkIndex: meta?.chunkIndex
    });
    
    this.onStatusChange('Processing...');
    
    // Skip very small chunks (increased threshold for WebM)
    if (blob.size < 5000) {
      console.log('🔇 Skipping small audio chunk, size:', blob.size);
      this.onStatusChange(this.isRecording ? 'Recording' : 'Stopped');
      return { data: { text: '' } }; // Return empty result for small chunks
    }

    console.log('📤 [DIAGNOSTIC] Preparing to send audio data via Supabase client...');
    
    // Add network connectivity check
    if (!navigator.onLine) {
      console.error('❌ [DIAGNOSTIC] No internet connection available');
      throw new Error('No internet connection available');
    }
    
    console.log('🌐 [DIAGNOSTIC] Network connectivity confirmed');
    
    // Convert Blob to ArrayBuffer for Supabase client
    const arrayBuffer = await blob.arrayBuffer();
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
    
    this.onStatusChange(this.isRecording ? 'Recording' : 'Stopped');
    return { data };
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
    this.queue = []; // Clear the queue
    this.chunkCounter = 0;
    this.processing = false;
    
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