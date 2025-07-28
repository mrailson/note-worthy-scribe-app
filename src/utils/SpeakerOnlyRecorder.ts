export interface SpeakerRecorderConfig {
  onTranscript?: (transcript: string, isFinal: boolean) => void;
  onStatusChange?: (status: string) => void;
  onError?: (error: string) => void;
}

export class SpeakerOnlyRecorder {
  private ws: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private isRecording = false;
  private sessionReady = false;
  
  constructor(private config: SpeakerRecorderConfig = {}) {}

  async startRecording(): Promise<void> {
    if (this.isRecording) {
      throw new Error('Already recording');
    }

    try {
      this.config.onStatusChange?.('Connecting to OpenAI for speaker audio...');
      
      // Connect to our edge function WebSocket proxy
      this.ws = new WebSocket('wss://dphcnbricafkbtizkoal.functions.supabase.co/realtime-transcription');
      
      this.setupWebSocketHandlers();
      
      // Wait for WebSocket connection
      await new Promise((resolve, reject) => {
        if (!this.ws) return reject(new Error('WebSocket not initialized'));
        
        this.ws.onopen = () => {
          console.log('WebSocket connected for speaker audio');
          resolve(void 0);
        };
        this.ws.onerror = (error) => {
          console.error('WebSocket connection error:', error);
          reject(error);
        };
      });
      
      this.config.onStatusChange?.('Setting up speaker audio capture...');
      
      // Set up speaker-only audio recording
      await this.setupSpeakerAudioRecording();
      
      this.isRecording = true;
      this.config.onStatusChange?.('Recording speaker audio...');
      
    } catch (error) {
      console.error('Error starting speaker recording:', error);
      this.cleanup();
      throw error;
    }
  }

  private setupWebSocketHandlers(): void {
    if (!this.ws) return;
    
    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('Speaker audio - received message type:', data.type);
        
        switch (data.type) {
          case 'session.created':
            console.log('Speaker session created successfully');
            break;
            
          case 'session.updated':
            console.log('Speaker session updated, ready for audio');
            this.sessionReady = true;
            break;
            
          case 'conversation.item.input_audio_transcription.completed':
            const transcript = data.transcript;
            console.log('Speaker transcript:', transcript);
            this.config.onTranscript?.(transcript, true);
            break;
            
          case 'conversation.item.input_audio_transcription.failed':
            console.error('Speaker transcription failed:', data.error);
            this.config.onError?.('Speaker transcription failed');
            break;
            
          case 'error':
            console.error('Speaker OpenAI error:', data.error);
            this.config.onError?.(data.error.message || 'Unknown error');
            break;
        }
      } catch (error) {
        console.error('Error parsing speaker WebSocket message:', error);
      }
    };
    
    this.ws.onerror = (error) => {
      console.error('Speaker WebSocket error:', error);
      this.config.onError?.('Speaker connection error');
    };
    
    this.ws.onclose = (event) => {
      console.log('Speaker WebSocket closed:', event.code, event.reason);
      this.config.onStatusChange?.('Speaker disconnected');
    };
  }

  private async setupSpeakerAudioRecording(): Promise<void> {
    try {
      console.log('🔊 Setting up speaker-only audio recording...');
      
      // Get display media (speaker audio only)
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: false,
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });

      if (!displayStream || displayStream.getAudioTracks().length === 0) {
        throw new Error('No speaker audio track available');
      }

      console.log('🔊 Speaker audio captured successfully');

      // Create audio context
      this.audioContext = new AudioContext({ sampleRate: 24000 });
      
      // Create speaker source
      const speakerSource = this.audioContext.createMediaStreamSource(displayStream);

      // Create script processor for audio data
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
      
      this.processor.onaudioprocess = (e) => {
        if (!this.sessionReady || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
          return;
        }
        
        const inputData = e.inputBuffer.getChannelData(0);
        const encodedAudio = this.encodeAudioForAPI(new Float32Array(inputData));
        
        // Send audio to OpenAI Realtime API
        const audioMessage = {
          type: 'input_audio_buffer.append',
          audio: encodedAudio
        };
        
        this.ws.send(JSON.stringify(audioMessage));
      };

      // Connect speaker to processor and destination
      speakerSource.connect(this.processor);
      this.processor.connect(this.audioContext.destination);

      // Store stream for cleanup
      this.stream = displayStream;
      this.source = speakerSource;

      console.log('✅ Speaker-only audio recording setup complete');
      
    } catch (error) {
      console.error('❌ Error setting up speaker audio recording:', error);
      throw error;
    }
  }

  private encodeAudioForAPI(float32Array: Float32Array): string {
    // Convert Float32Array to Int16Array (PCM16)
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    
    // Convert to base64
    const uint8Array = new Uint8Array(int16Array.buffer);
    let binary = '';
    const chunkSize = 0x8000;
    
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    
    return btoa(binary);
  }

  async stopRecording(): Promise<void> {
    if (!this.isRecording) return;

    this.config.onStatusChange?.('Stopping speaker recording...');
    
    try {
      // Send final audio buffer commit
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        const commitMessage = {
          type: 'input_audio_buffer.commit'
        };
        this.ws.send(JSON.stringify(commitMessage));
      }
      
      this.isRecording = false;
      this.cleanup();
      
      this.config.onStatusChange?.('Speaker recording stopped');
      
    } catch (error) {
      console.error('Error stopping speaker recording:', error);
      this.config.onError?.(`Error stopping recording: ${error.message}`);
    }
  }

  private cleanup(): void {
    // Stop audio processing
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    // Close WebSocket
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.sessionReady = false;
  }

  getRecordingStatus(): boolean {
    return this.isRecording;
  }
}