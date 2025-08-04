export interface AudioCaptureOptions {
  sampleRate?: number;
  channelCount?: number;
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  autoGainControl?: boolean;
}

export interface AudioServiceCallbacks {
  onAudioData?: (audioData: Blob) => void;
  onError?: (error: string) => void;
  onStatusChange?: (status: 'connecting' | 'connected' | 'disconnected' | 'error') => void;
}

export class AudioService {
  private audioContext: AudioContext | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private micStream: MediaStream | null = null;
  private systemStream: MediaStream | null = null;
  private isCapturing = false;
  private callbacks: AudioServiceCallbacks;

  constructor(callbacks: AudioServiceCallbacks = {}) {
    this.callbacks = callbacks;
  }

  async startCapture(options: AudioCaptureOptions = {}): Promise<void> {
    try {
      this.callbacks.onStatusChange?.('connecting');

      const defaultOptions: AudioCaptureOptions = {
        sampleRate: 24000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        ...options
      };

      // Get microphone stream
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: defaultOptions
      });

      // Try to get system audio (optional)
      try {
        this.systemStream = await navigator.mediaDevices.getDisplayMedia({
          video: false,
          audio: {
            sampleRate: defaultOptions.sampleRate,
            channelCount: defaultOptions.channelCount,
            echoCancellation: false,
            noiseSuppression: false
          }
        });
      } catch (error) {
        console.log('System audio not available, using microphone only');
      }

      // Create mixed stream if both available
      const finalStream = this.systemStream 
        ? this.createMixedStream(this.micStream, this.systemStream)
        : this.micStream;

      // Setup MediaRecorder
      this.setupMediaRecorder(finalStream);
      
      this.isCapturing = true;
      this.callbacks.onStatusChange?.('connected');
      
    } catch (error) {
      this.callbacks.onError?.(`Failed to start audio capture: ${error}`);
      this.callbacks.onStatusChange?.('error');
      throw error;
    }
  }

  private createMixedStream(micStream: MediaStream, systemStream: MediaStream): MediaStream {
    this.audioContext = new AudioContext({ sampleRate: 24000 });
    
    const micSource = this.audioContext.createMediaStreamSource(micStream);
    const systemSource = this.audioContext.createMediaStreamSource(systemStream);
    
    const destination = this.audioContext.createMediaStreamDestination();
    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = 0.8; // Prevent clipping
    
    micSource.connect(gainNode);
    systemSource.connect(gainNode);
    gainNode.connect(destination);
    
    return destination.stream;
  }

  private setupMediaRecorder(stream: MediaStream): void {
    const options = { mimeType: 'audio/webm' };
    
    try {
      this.mediaRecorder = new MediaRecorder(stream, options);
    } catch (error) {
      // Fallback for browsers that don't support webm
      this.mediaRecorder = new MediaRecorder(stream);
    }

    const audioChunks: Blob[] = [];

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    this.mediaRecorder.onstop = () => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      this.callbacks.onAudioData?.(audioBlob);
      audioChunks.length = 0;
    };

    this.mediaRecorder.start(1000); // Collect data every second
  }

  stopCapture(): void {
    try {
      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
      }

      if (this.micStream) {
        this.micStream.getTracks().forEach(track => track.stop());
        this.micStream = null;
      }

      if (this.systemStream) {
        this.systemStream.getTracks().forEach(track => track.stop());
        this.systemStream = null;
      }

      if (this.audioContext) {
        this.audioContext.close();
        this.audioContext = null;
      }

      this.isCapturing = false;
      this.callbacks.onStatusChange?.('disconnected');
      
    } catch (error) {
      this.callbacks.onError?.(`Error stopping audio capture: ${error}`);
    }
  }

  isActive(): boolean {
    return this.isCapturing;
  }

  // Get audio level for UI feedback
  getAudioLevel(): number {
    // Implementation for audio level monitoring
    // This would require additional audio analysis setup
    return 0;
  }
}