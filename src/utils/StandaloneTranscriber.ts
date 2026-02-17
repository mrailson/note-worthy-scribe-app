import { supabase } from '@/integrations/supabase/client';

interface TranscriberOptions {
  service: 'whisper' | 'deepgram';
  onTranscript: (text: string) => void;
  onTranscribing: (isTranscribing: boolean) => void;
  onError: (error: string) => void;
  onVolumeChange: (volume: number) => void;
}

export class StandaloneTranscriber {
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private volumeInterval: NodeJS.Timeout | null = null;
  private audioChunks: Blob[] = [];
  private chunkInterval: NodeJS.Timeout | null = null;
  private isActive = false;
  private isPaused = false;
  private isMuted = false;
  private processedSegments = new Set<string>();
  private selectedMimeType: string | null = null;

  constructor(private options: TranscriberOptions) {}

  private generateSegmentId(text: string): string {
    // Use full normalized text for better uniqueness
    const normalized = text.trim().toLowerCase().replace(/\s+/g, ' ');
    // Create a simple hash
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return `${hash}-${normalized.slice(0, 30)}`;
  }

  private async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  private getSupportedMimeType(): string | null {
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
      'audio/mpeg'
    ];
    try {
      for (const t of candidates) {
        if (typeof MediaRecorder !== 'undefined' && (MediaRecorder as any).isTypeSupported?.(t)) {
          return t;
        }
      }
    } catch {}
    return null;
  }

  async start() {
    try {
      // Get microphone access
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // Set up audio analysis for volume detection
      this.audioContext = new AudioContext();
      const source = this.audioContext.createMediaStreamSource(this.stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      source.connect(this.analyser);

      // Start volume monitoring
      this.startVolumeMonitoring();

      // Set up MediaRecorder
      const mimeType = this.getSupportedMimeType();
      this.selectedMimeType = mimeType;
      console.log('Using MediaRecorder mimeType:', mimeType || 'default');
      this.mediaRecorder = new MediaRecorder(this.stream, mimeType ? { mimeType } : undefined as any);

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && !this.isPaused) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        this.processAudioChunk();
      };

      this.isActive = true;
      this.mediaRecorder.start(1000); // Request data every second for Safari/iOS

      // Process chunks every 2 seconds for more real-time transcription
      this.chunkInterval = setInterval(() => {
        if (this.isActive && !this.isPaused && this.audioChunks.length > 0) {
          this.processAudioChunk();
        }
      }, 2000);

    } catch (error) {
      this.options.onError(`Failed to start recording: ${error}`);
      throw error;
    }
  }

  async stop() {
    this.isActive = false;
    
    if (this.chunkInterval) {
      clearInterval(this.chunkInterval);
      this.chunkInterval = null;
    }

    if (this.volumeInterval) {
      clearInterval(this.volumeInterval);
      this.volumeInterval = null;
    }

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }

    // Process any remaining chunks
    if (this.audioChunks.length > 0) {
      await this.processAudioChunk();
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }

    this.mediaRecorder = null;
    this.analyser = null;
    this.processedSegments.clear();
  }

  async pause() {
    this.isPaused = true;
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.pause();
    }
  }

  async resume() {
    this.isPaused = false;
    if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
      this.mediaRecorder.resume();
    }
  }

  async toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.stream) {
      this.stream.getAudioTracks().forEach(track => {
        track.enabled = !this.isMuted;
      });
    }
  }

  private startVolumeMonitoring() {
    if (!this.analyser) return;

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const updateVolume = () => {
      if (!this.analyser || !this.isActive) return;
      
      this.analyser.getByteFrequencyData(dataArray);
      
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      
      const average = sum / bufferLength;
      const volume = Math.min(1, average / 128);
      
      this.options.onVolumeChange(this.isMuted ? 0 : volume);
    };

    this.volumeInterval = setInterval(updateVolume, 100);
  }

  private async processAudioChunk() {
    if (this.audioChunks.length === 0) return;

    const chunks = [...this.audioChunks];
    this.audioChunks = [];

    const audioBlob = new Blob(chunks, { type: 'audio/webm' });
    
    // Allow smaller chunks to capture short utterances like "yes", "okay"
    if (audioBlob.size < 256) {
      console.log('Skipping very small chunk:', audioBlob.size, 'bytes');
      return;
    }
    
    console.log('Processing audio chunk:', audioBlob.size, 'bytes');

    this.options.onTranscribing(true);

    try {
      const base64Audio = await this.blobToBase64(audioBlob);
      const audioData = base64Audio.split(',')[1]; // Remove data:audio/webm;base64, prefix

      let response;
      if (this.options.service === 'whisper') {
        response = await supabase.functions.invoke('standalone-whisper', {
          body: { audio: audioData }
        });
      } else {
        response = await supabase.functions.invoke('standalone-deepgram', {
          body: { audio: audioData }
        });
      }

      if (response.error) {
        throw new Error(response.error.message || 'Transcription failed');
      }

      if (response.data?.text?.trim()) {
        const text = response.data.text.trim();
        const segmentId = this.generateSegmentId(text);
        
        console.log('Received transcription:', text);
        
        // Prevent duplicate processing
        if (!this.processedSegments.has(segmentId)) {
          this.processedSegments.add(segmentId);
          console.log('Adding new transcript segment:', text);
          this.options.onTranscript(text);
        } else {
          console.log('Skipping duplicate segment:', text);
        }
      } else {
        console.log('No transcription text received');
      }

    } catch (error) {
      console.error('Transcription error:', error);
      this.options.onError(`Transcription failed: ${error}`);
    } finally {
      this.options.onTranscribing(false);
    }
  }

  getStream(): MediaStream | null {
    return this.stream;
  }
}
