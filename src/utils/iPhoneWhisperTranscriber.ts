import { supabase } from "@/integrations/supabase/client";

export interface TranscriptData {
  text: string;
  is_final: boolean;
  confidence: number;
  speaker: string;
}

export class iPhoneWhisperTranscriber {
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private isRecording = false;
  private audioChunks: Blob[] = [];
  private transcriptionInterval: NodeJS.Timeout | null = null;
  private overlapBuffer: Blob[] = [];
  private chunkTimeout: ReturnType<typeof setTimeout> | null = null;
  private recordingStartTime = 0;
  private lastIntervalMs = 0;

  constructor(
    private onTranscription: (data: TranscriptData) => void,
    private onError: (error: string) => void,
    private onStatusChange: (status: string) => void
  ) {}

  async startTranscription() {
    try {
      this.onStatusChange('Starting iPhone transcription...');
      console.log('📱 Starting iPhone Whisper transcription...');

      // Request microphone access with iPhone-optimized settings
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000, // Whisper works well with 16kHz
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false, // Disable AGC to reduce pumping/hallucinations
        }
      });

      // Check supported MIME types for iPhone
      const mimeTypes = [
        'audio/mp4;codecs=mp4a.40.2', // Prefer explicit AAC on iOS
        'audio/mp4',
        'audio/aac',
        'audio/webm;codecs=opus',
        'audio/webm'
      ];

      let selectedMimeType = 'audio/webm'; // fallback
      for (const mimeType of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType;
          console.log('📱 Using MIME type:', mimeType);
          break;
        }
      }

      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: selectedMimeType,
        audioBitsPerSecond: 128000 // Higher bitrate to reduce artifacts on iOS
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = async () => {
        if (this.audioChunks.length > 0) {
          await this.processAudioChunks();
        }
      };

      this.mediaRecorder.onerror = (event) => {
        console.error('📱 MediaRecorder error:', event);
        this.onError('Recording error occurred');
      };

      // Start recording and process in chunks every 60 seconds with overlap
      this.isRecording = true;
      this.startChunkedRecording();
      
      this.onStatusChange('Recording...');
      console.log('✅ iPhone transcription started');

    } catch (error) {
      console.error('❌ Failed to start iPhone transcription:', error);
      this.onError(`Failed to start recording: ${error.message}`);
    }
  }

  private startChunkedRecording() {
    if (!this.mediaRecorder || !this.isRecording) return;

    // Start recording and dynamically adjust chunking frequency
    this.recordingStartTime = Date.now();
    this.mediaRecorder.start();

    const getInterval = (elapsed: number) => {
      if (elapsed < 20000) return 5000;     // Every 5s for first 20s
      if (elapsed < 60000) return 10000;    // Every 10s until 1 min
      return 30000;                         // Then every 30s for balance
    };

    const scheduleNext = () => {
      if (!this.mediaRecorder || !this.isRecording) return;
      const elapsed = Date.now() - this.recordingStartTime;
      const interval = getInterval(elapsed);
      console.log(`⏱️ Next iPhone chunk in ${interval}ms (elapsed ${elapsed}ms)`);
      this.lastIntervalMs = interval;

      this.chunkTimeout = setTimeout(() => {
        if (this.mediaRecorder && this.isRecording && this.mediaRecorder.state === 'recording') {
          this.mediaRecorder.stop();
          // Start new recording immediately
          setTimeout(() => {
            if (this.mediaRecorder && this.isRecording) {
              this.mediaRecorder.start();
              scheduleNext();
            }
          }, 100);
        } else {
          // If not recording for any reason, try to reschedule
          scheduleNext();
        }
      }, interval);
    };

    scheduleNext();
  }

  private async processAudioChunks() {
    if (this.audioChunks.length === 0) return;

    try {
      const elapsed = Date.now() - this.recordingStartTime;
      // In the first minute, don't use overlap to keep latency low
      let currentChunks: Blob[];
      if (elapsed >= 10000) {
        // Enable small overlap after 10s for stability
        currentChunks = [...this.overlapBuffer, ...this.audioChunks];
      } else {
        currentChunks = [...this.audioChunks];
      }
      
      // Combine chunks
      const audioBlob = new Blob(currentChunks, { type: this.audioChunks[0].type });
      
      // Update overlap buffer only for longer segments
      if (elapsed >= 10000) {
        // Dynamic small overlap: ~1–2s depending on current interval
        let overlapFraction = 0.08; // ~2.4s for 30s chunks
        if (this.lastIntervalMs <= 5000) overlapFraction = 0.2; // ~1s for 5s chunks
        else if (this.lastIntervalMs <= 10000) overlapFraction = 0.1; // ~1s for 10s chunks
        const overlapSize = Math.max(1, Math.ceil(this.audioChunks.length * overlapFraction));
        this.overlapBuffer = this.audioChunks.slice(-overlapSize);
      } else {
        this.overlapBuffer = [];
      }
      
      this.audioChunks = []; // Clear current chunks after processing

      // Skip very small audio chunks, but allow smaller ones early for quick feedback
      const minSize = elapsed < 20000 ? 5000 : elapsed < 60000 ? 12000 : 40000; // bytes
      if (audioBlob.size < minSize) {
        console.log(`📱 Skipping small audio chunk (size=${audioBlob.size}, min=${minSize})`);
        return;
      }

      // Convert blob to base64
      const arrayBuffer = await audioBlob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // Convert to base64 in chunks to prevent memory issues
      let binary = '';
      const chunkSize = 0x8000;
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
        binary += String.fromCharCode.apply(null, Array.from(chunk));
      }
      const base64Audio = btoa(binary);

      console.log('📡 Sending audio to Whisper API...');

      // Send to Whisper API
      const { data, error } = await supabase.functions.invoke('speech-to-text', {
        body: { audio: base64Audio, language: 'en', temperature: 0 }
      });

      if (error) {
        console.error('❌ Whisper API error:', error);
        this.onError('Transcription failed');
        return;
      }

      if (data.text && data.text.trim()) {
        const transcriptData: TranscriptData = {
          text: data.text.trim(),
          is_final: true,
          confidence: 0.9,
          speaker: 'Speaker'
        };

        console.log('✅ iPhone transcription:', data.text);
        this.onTranscription(transcriptData);
      }

    } catch (error) {
      console.error('❌ Error processing audio:', error);
      this.onError('Failed to process audio');
    }
  }

  async stopTranscription() {
    console.log('🛑 Stopping iPhone transcription...');
    this.isRecording = false;

    if (this.transcriptionInterval) {
      clearInterval(this.transcriptionInterval);
      this.transcriptionInterval = null;
    }
    if (this.chunkTimeout) {
      clearTimeout(this.chunkTimeout);
      this.chunkTimeout = null;
    }

    // Process any remaining audio chunks before stopping
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
      // Wait a moment for the final ondataavailable event
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Process final chunk if any audio data remains
    if (this.audioChunks.length > 0) {
      console.log('🔄 Processing final audio chunk before stopping...');
      await this.processAudioChunks();
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    this.mediaRecorder = null;
    this.audioChunks = [];
    this.onStatusChange('Stopped');
  }

  isActive(): boolean {
    return this.isRecording;
  }
}