export interface AudioCaptureCallbacks {
  onChunkReady?: (chunk: AudioChunk) => void;
  onError?: (error: Error) => void;
  onStatusChange?: (status: 'disconnected' | 'connecting' | 'connected' | 'error') => void;
}

export interface AudioChunk {
  audioBlob: Blob;
  chunkNumber: number;
  startTime: Date;
  endTime: Date;
  duration: number;
}

export interface EnhancedAudioCaptureOptions {
  chunkDuration?: number; // Duration in milliseconds (default: 15000)
  overlapDuration?: number; // Overlap in milliseconds (default: 2000)
  sampleRate?: number; // Sample rate (default: 24000)
  enableSystemAudio?: boolean; // Enable system audio capture (default: false)
  silenceThreshold?: number; // RMS threshold for silence detection (default: 0.005)
}

export class EnhancedAudioCaptureService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioContext: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private systemStream: MediaStream | null = null;
  private currentChunks: Blob[] = [];
  private lastChunk: Blob | null = null;
  private chunkNumber = 0;
  private isCapturing = false;
  private chunkInterval: number | null = null;
  private sessionStartTime: Date | null = null;

  private readonly options: Required<EnhancedAudioCaptureOptions>;
  private readonly callbacks: AudioCaptureCallbacks;

  constructor(callbacks: AudioCaptureCallbacks = {}, options: EnhancedAudioCaptureOptions = {}) {
    this.callbacks = callbacks;
    this.options = {
      chunkDuration: 15000, // 15 seconds
      overlapDuration: 2000, // 2 seconds
      sampleRate: 24000,
      enableSystemAudio: false,
      silenceThreshold: 0.005,
      ...options
    };

    console.log('EnhancedAudioCaptureService initialized with options:', this.options);
  }

  async startCapture(): Promise<void> {
    try {
      this.callbacks.onStatusChange?.('connecting');
      console.log('Starting enhanced audio capture...');

      // Request microphone access
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: this.options.sampleRate,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // Optionally request system audio
      if (this.options.enableSystemAudio) {
        try {
          this.systemStream = await navigator.mediaDevices.getDisplayMedia({
            audio: {
              sampleRate: this.options.sampleRate,
              channelCount: 1,
              echoCancellation: false,
              noiseSuppression: false
            },
            video: false
          });
          console.log('System audio capture enabled');
        } catch (error) {
          console.warn('System audio not available, using microphone only:', error);
        }
      }

      // Create mixed stream if both available
      const finalStream = this.systemStream 
        ? await this.createMixedStream(this.stream, this.systemStream)
        : this.stream;

      // Setup MediaRecorder
      this.setupMediaRecorder(finalStream);
      
      this.isCapturing = true;
      this.sessionStartTime = new Date();
      this.chunkNumber = 0;
      this.currentChunks = [];
      this.lastChunk = null;

      // Start recording and chunking
      this.mediaRecorder!.start(1000); // Collect data every second
      this.startChunking();

      this.callbacks.onStatusChange?.('connected');
      console.log('Enhanced audio capture started successfully');

    } catch (error) {
      console.error('Failed to start enhanced audio capture:', error);
      this.callbacks.onError?.(error as Error);
      this.callbacks.onStatusChange?.('error');
      throw error;
    }
  }

  private async createMixedStream(micStream: MediaStream, systemStream: MediaStream): Promise<MediaStream> {
    this.audioContext = new AudioContext({ sampleRate: this.options.sampleRate });
    
    const micSource = this.audioContext.createMediaStreamSource(micStream);
    const systemSource = this.audioContext.createMediaStreamSource(systemStream);
    
    // Create gain nodes to mix audio
    const micGain = this.audioContext.createGain();
    const systemGain = this.audioContext.createGain();
    const mixer = this.audioContext.createGain();
    
    // Set gain levels to prevent clipping
    micGain.gain.value = 0.7;
    systemGain.gain.value = 0.3;
    
    // Connect sources to gains to mixer
    micSource.connect(micGain);
    systemSource.connect(systemGain);
    micGain.connect(mixer);
    systemGain.connect(mixer);
    
    // Create destination for mixed stream
    const destination = this.audioContext.createMediaStreamDestination();
    mixer.connect(destination);
    
    return destination.stream;
  }

  private setupMediaRecorder(stream: MediaStream): void {
    const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
    this.mediaRecorder = new MediaRecorder(stream, { mimeType });

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.currentChunks.push(event.data);
      }
    };

    this.mediaRecorder.onerror = (event) => {
      console.error('MediaRecorder error:', event);
      this.callbacks.onError?.(new Error('MediaRecorder error'));
    };

    console.log('MediaRecorder setup complete with mimeType:', mimeType);
  }

  private startChunking(): void {
    const chunkIntervalDuration = this.options.chunkDuration - this.options.overlapDuration;
    
    this.chunkInterval = window.setInterval(async () => {
      if (this.currentChunks.length > 0) {
        await this.processCurrentChunk();
      }
    }, chunkIntervalDuration);

    console.log(`Chunking started with interval: ${chunkIntervalDuration}ms`);
  }

  private async processCurrentChunk(): Promise<void> {
    try {
      const currentTime = new Date();
      const startTime = new Date(currentTime.getTime() - this.options.chunkDuration);
      
      // Create blob from current chunks
      const currentBlob = new Blob(this.currentChunks, { type: 'audio/webm' });
      this.currentChunks = [];

      let finalBlob = currentBlob;
      
      // Merge with previous chunk for overlap if available
      if (this.lastChunk) {
        finalBlob = await this.mergeWithOverlap(this.lastChunk, currentBlob);
      }

      // Check if chunk contains speech
      const containsSpeech = await this.checkAudioSignal(finalBlob);
      
      if (containsSpeech) {
        const audioChunk: AudioChunk = {
          audioBlob: finalBlob,
          chunkNumber: this.chunkNumber,
          startTime,
          endTime: currentTime,
          duration: this.options.chunkDuration
        };

        console.log(`Processing audio chunk ${this.chunkNumber} (${finalBlob.size} bytes)`);
        this.callbacks.onChunkReady?.(audioChunk);
      } else {
        console.log(`Skipping silent chunk ${this.chunkNumber}`);
      }

      // Store current chunk for next overlap
      this.lastChunk = currentBlob;
      this.chunkNumber++;

    } catch (error) {
      console.error('Error processing audio chunk:', error);
      this.callbacks.onError?.(error as Error);
    }
  }

  private async mergeWithOverlap(previousBlob: Blob, currentBlob: Blob): Promise<Blob> {
    try {
      if (!this.audioContext) {
        this.audioContext = new AudioContext({ sampleRate: this.options.sampleRate });
      }

      // Decode audio buffers
      const [prevBuffer, currBuffer] = await Promise.all([
        previousBlob.arrayBuffer().then(buf => this.audioContext!.decodeAudioData(buf)),
        currentBlob.arrayBuffer().then(buf => this.audioContext!.decodeAudioData(buf))
      ]);

      // Calculate overlap samples
      const overlapSamples = Math.floor(this.audioContext.sampleRate * (this.options.overlapDuration / 1000));
      const totalLength = prevBuffer.length + currBuffer.length - overlapSamples;

      // Create merged buffer
      const merged = this.audioContext.createBuffer(1, totalLength, this.audioContext.sampleRate);
      const mergedData = merged.getChannelData(0);
      const prevData = prevBuffer.getChannelData(0);
      const currData = currBuffer.getChannelData(0);

      // Copy previous buffer
      mergedData.set(prevData.subarray(0, prevBuffer.length - overlapSamples));

      // Blend overlap section
      const blendStart = prevBuffer.length - overlapSamples;
      for (let i = 0; i < overlapSamples; i++) {
        const fadeOut = 1 - (i / overlapSamples);
        const fadeIn = i / overlapSamples;
        const prevSample = prevData[blendStart + i] * fadeOut;
        const currSample = currData[i] * fadeIn;
        mergedData[blendStart + i] = prevSample + currSample;
      }

      // Copy remaining current buffer
      mergedData.set(currData.subarray(overlapSamples), blendStart + overlapSamples);

      // Convert back to blob
      return await this.audioBufferToBlob(merged);

    } catch (error) {
      console.error('Error merging audio with overlap:', error);
      // Fallback to simple concatenation
      return new Blob([previousBlob, currentBlob], { type: 'audio/webm' });
    }
  }

  private async audioBufferToBlob(buffer: AudioBuffer): Promise<Blob> {
    const offlineContext = new OfflineAudioContext(1, buffer.length, buffer.sampleRate);
    const source = offlineContext.createBufferSource();
    source.buffer = buffer;
    source.connect(offlineContext.destination);
    source.start(0);
    
    const renderedBuffer = await offlineContext.startRendering();
    
    // Convert to WAV format
    const wavBuffer = this.audioBufferToWav(renderedBuffer);
    return new Blob([wavBuffer], { type: 'audio/wav' });
  }

  private audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
    const length = buffer.length;
    const arrayBuffer = new ArrayBuffer(44 + length * 2);
    const view = new DataView(arrayBuffer);
    const channelData = buffer.getChannelData(0);

    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, buffer.sampleRate, true);
    view.setUint32(28, buffer.sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length * 2, true);

    // Convert float samples to 16-bit PCM
    let offset = 44;
    for (let i = 0; i < length; i++) {
      const sample = Math.max(-1, Math.min(1, channelData[i]));
      view.setInt16(offset, sample * 0x7FFF, true);
      offset += 2;
    }

    return arrayBuffer;
  }

  private async checkAudioSignal(blob: Blob): Promise<boolean> {
    try {
      const arrayBuffer = await blob.arrayBuffer();
      
      if (!this.audioContext) {
        this.audioContext = new AudioContext({ sampleRate: this.options.sampleRate });
      }

      const audioData = await this.audioContext.decodeAudioData(arrayBuffer);
      const channelData = audioData.getChannelData(0);
      
      // Calculate RMS (Root Mean Square)
      let sumSquares = 0;
      let peak = 0;
      
      for (let i = 0; i < channelData.length; i++) {
        const sample = channelData[i];
        sumSquares += sample * sample;
        peak = Math.max(peak, Math.abs(sample));
      }
      
      const rms = Math.sqrt(sumSquares / channelData.length);
      const dynamicRange = peak - rms;
      
      console.log(`Audio signal analysis - RMS: ${rms.toFixed(6)}, Peak: ${peak.toFixed(6)}, Dynamic Range: ${dynamicRange.toFixed(6)}`);
      
      // Check if signal exceeds thresholds
      return rms > this.options.silenceThreshold && dynamicRange > 0.02;
      
    } catch (error) {
      console.error('Error checking audio signal:', error);
      // If analysis fails, assume it contains speech
      return true;
    }
  }

  stopCapture(): void {
    try {
      console.log('Stopping enhanced audio capture...');
      
      this.isCapturing = false;
      
      if (this.chunkInterval) {
        clearInterval(this.chunkInterval);
        this.chunkInterval = null;
      }
      
      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
      }
      
      if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop());
        this.stream = null;
      }
      
      if (this.systemStream) {
        this.systemStream.getTracks().forEach(track => track.stop());
        this.systemStream = null;
      }
      
      if (this.audioContext) {
        this.audioContext.close();
        this.audioContext = null;
      }
      
      this.callbacks.onStatusChange?.('disconnected');
      console.log('Enhanced audio capture stopped');
      
    } catch (error) {
      console.error('Error stopping audio capture:', error);
      this.callbacks.onError?.(error as Error);
    }
  }

  isActive(): boolean {
    return this.isCapturing;
  }

  getSessionInfo() {
    return {
      isCapturing: this.isCapturing,
      chunkNumber: this.chunkNumber,
      sessionStartTime: this.sessionStartTime,
      options: this.options
    };
  }
}