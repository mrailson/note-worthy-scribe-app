interface TranscriptionEvent {
  type: 'partial' | 'final';
  text: string;
  confidence?: number;
}

export class StreamingTranscriber {
  private mediaRecorder: MediaRecorder | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private stream: MediaStream | null = null;
  private isRecording = false;
  private isSpeaking = false;
  private audioBuffer: Float32Array[] = [];
  private lastProcessTime = 0;
  private speechTimeout: number | null = null;
  
  // Configuration
  private readonly CHUNK_DURATION = 2000; // 2 seconds
  private readonly SILENCE_THRESHOLD = 0.01; // Voice activity threshold
  private readonly SILENCE_DURATION = 1000; // 1 second of silence before processing
  private readonly SAMPLE_RATE = 16000;
  private readonly BUFFER_SIZE = 4096;
  
  constructor(
    private onTranscription: (event: TranscriptionEvent) => void,
    private onError: (error: string) => void
  ) {}

  async start(): Promise<void> {
    try {
      // Get audio stream
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: this.SAMPLE_RATE,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // Setup audio context for voice activity detection
      this.audioContext = new AudioContext({ sampleRate: this.SAMPLE_RATE });
      const source = this.audioContext.createMediaStreamSource(this.stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      source.connect(this.analyser);

      // Setup audio recording for transcription
      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      this.setupRecording();
      this.startVoiceActivityDetection();
      
      this.isRecording = true;
      this.mediaRecorder.start(100); // Get data every 100ms
      
      console.log('Streaming transcriber started');
    } catch (error) {
      console.error('Error starting transcriber:', error);
      this.onError('Failed to start audio recording');
    }
  }

  stop(): void {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
    }
    
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }
    
    if (this.audioContext) {
      this.audioContext.close();
    }
    
    if (this.speechTimeout) {
      clearTimeout(this.speechTimeout);
    }
    
    this.isRecording = false;
    this.audioBuffer = [];
    console.log('Streaming transcriber stopped');
  }

  private setupRecording(): void {
    if (!this.mediaRecorder) return;

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0 && this.isRecording) {
        this.processAudioChunk(event.data);
      }
    };

    this.mediaRecorder.onstop = () => {
      // Process any remaining audio
      if (this.audioBuffer.length > 0) {
        this.sendForTranscription(true);
      }
    };
  }

  private startVoiceActivityDetection(): void {
    if (!this.analyser) return;

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const checkVoiceActivity = () => {
      if (!this.analyser || !this.isRecording) return;

      this.analyser.getByteFrequencyData(dataArray);
      
      // Calculate average volume
      const average = dataArray.reduce((a, b) => a + b) / bufferLength;
      const normalizedVolume = average / 255;
      
      const currentlySpeaking = normalizedVolume > this.SILENCE_THRESHOLD;
      
      if (currentlySpeaking !== this.isSpeaking) {
        this.isSpeaking = currentlySpeaking;
        
        if (currentlySpeaking) {
          console.log('Speech detected');
          // Clear any pending silence timeout
          if (this.speechTimeout) {
            clearTimeout(this.speechTimeout);
            this.speechTimeout = null;
          }
        } else {
          console.log('Silence detected');
          // Start silence timeout
          this.speechTimeout = window.setTimeout(() => {
            if (this.audioBuffer.length > 0) {
              console.log('Processing audio after silence');
              this.sendForTranscription(false);
            }
          }, this.SILENCE_DURATION);
        }
      }
      
      // Continue monitoring
      requestAnimationFrame(checkVoiceActivity);
    };

    checkVoiceActivity();
  }

  private async processAudioChunk(chunk: Blob): Promise<void> {
    try {
      // Convert blob to array buffer for processing
      const arrayBuffer = await chunk.arrayBuffer();
      this.audioBuffer.push(new Float32Array(arrayBuffer));

      // Check if we should process based on time or buffer size
      const now = Date.now();
      const timeSinceLastProcess = now - this.lastProcessTime;
      
      if (timeSinceLastProcess >= this.CHUNK_DURATION && this.audioBuffer.length > 0) {
        this.sendForTranscription(false);
      }
    } catch (error) {
      console.error('Error processing audio chunk:', error);
    }
  }

  private async sendForTranscription(isFinal: boolean): Promise<void> {
    if (this.audioBuffer.length === 0) return;

    try {
      // Combine audio chunks
      const totalLength = this.audioBuffer.reduce((acc, chunk) => acc + chunk.length, 0);
      const combinedAudio = new Float32Array(totalLength);
      let offset = 0;
      
      for (const chunk of this.audioBuffer) {
        combinedAudio.set(chunk, offset);
        offset += chunk.length;
      }

      // Convert to base64 for transmission
      const audioData = this.float32ArrayToBase64(combinedAudio);
      
      // Send to our optimized transcription endpoint
      const response = await fetch('https://dphcnbricafkbtizkoal.functions.supabase.co/speech-to-text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ audio: audioData })
      });

      if (!response.ok) {
        throw new Error(`Transcription failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.text && result.text.trim()) {
        this.onTranscription({
          type: isFinal ? 'final' : 'partial',
          text: result.text.trim()
        });
      }

      // Clear processed audio buffer
      this.audioBuffer = [];
      this.lastProcessTime = Date.now();
      
    } catch (error) {
      console.error('Error sending for transcription:', error);
      this.onError('Transcription failed');
    }
  }

  private float32ArrayToBase64(float32Array: Float32Array): string {
    // Convert float32 to int16 for better compatibility
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    
    const uint8Array = new Uint8Array(int16Array.buffer);
    let binary = '';
    const chunkSize = 0x8000;
    
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    
    return btoa(binary);
  }
}