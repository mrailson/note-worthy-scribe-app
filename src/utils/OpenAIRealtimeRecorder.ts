export interface RealtimeConfig {
  onTranscript?: (transcript: string, isFinal: boolean) => void;
  onStatusChange?: (status: string) => void;
  onError?: (error: string) => void;
}

export class OpenAIRealtimeRecorder {
  private ws: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private isRecording = false;
  private sessionReady = false;
  
  constructor(private config: RealtimeConfig = {}) {}

  async startRecording(): Promise<void> {
    if (this.isRecording) {
      throw new Error('Already recording');
    }

    try {
      this.config.onStatusChange?.('Connecting to OpenAI Realtime API...');
      
      // Connect to our edge function WebSocket proxy
      this.ws = new WebSocket('wss://dphcnbricafkbtizkoal.functions.supabase.co/openai-realtime-session');
      
      this.setupWebSocketHandlers();
      
      // Wait for WebSocket connection
      await new Promise((resolve, reject) => {
        if (!this.ws) return reject(new Error('WebSocket not initialized'));
        
        this.ws.onopen = () => {
          console.log('WebSocket connected to edge function');
          resolve(void 0);
        };
        this.ws.onerror = (error) => {
          console.error('WebSocket connection error:', error);
          reject(error);
        };
      });
      
      this.config.onStatusChange?.('Setting up microphone audio...');
      
      // Set up audio recording
      await this.setupAudioRecording();
      
      this.isRecording = true;
      this.config.onStatusChange?.('Recording and transcribing...');
      
    } catch (error) {
      console.error('Error starting realtime recording:', error);
      this.cleanup();
      throw error;
    }
  }

  private setupWebSocketHandlers(): void {
    if (!this.ws) return;
    
    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('Received message type:', data.type);
        
        switch (data.type) {
          case 'session.created':
            console.log('Session created successfully');
            break;
            
          case 'session.updated':
            console.log('Session updated, ready for audio');
            this.sessionReady = true;
            break;
            
          case 'input_audio_buffer.speech_started':
            console.log('Speech detected');
            break;
            
          case 'input_audio_buffer.speech_stopped':
            console.log('Speech stopped');
            break;
            
          case 'conversation.item.input_audio_transcription.completed':
            const transcript = data.transcript;
            console.log('Final transcript:', transcript);
            this.config.onTranscript?.(transcript, true);
            break;
            
          case 'conversation.item.input_audio_transcription.failed':
            console.error('Transcription failed:', data.error);
            this.config.onError?.('Transcription failed');
            break;
            
          case 'error':
            console.error('OpenAI error:', data.error);
            this.config.onError?.(data.error.message || 'Unknown error');
            break;
            
          default:
            console.log('Unhandled message type:', data.type);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    
    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.config.onError?.('Connection error');
    };
    
    this.ws.onclose = (event) => {
      console.log('WebSocket closed:', event.code, event.reason);
      this.config.onStatusChange?.('Disconnected');
    };
  }

  private async setupAudioRecording(): Promise<void> {
    try {
      console.log('🎤 Setting up microphone audio for transcription...');
      
      // Get microphone stream - this is what we'll send to OpenAI for transcription
      console.log('📱 Requesting microphone permission...');
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      console.log('✅ Microphone permission granted');
      console.log('🎤 Microphone tracks:', micStream.getAudioTracks().map(track => ({
        id: track.id,
        kind: track.kind,
        label: track.label,
        enabled: track.enabled,
        muted: track.muted,
        readyState: track.readyState
      })));

      // Also get display media for monitoring/recording (optional)
      let displayStream: MediaStream | null = null;
      try {
        console.log('🔊 Requesting speaker audio...');
        displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: false,
          audio: {
            sampleRate: 24000,
            channelCount: 1,
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false
          }
        });
        console.log('🔊 Speaker audio captured for monitoring');
      } catch (error) {
        console.warn('⚠️ Could not capture speaker audio:', error);
      }

      // Create audio context
      this.audioContext = new AudioContext({ sampleRate: 24000 });
      console.log('🎵 Audio context created, state:', this.audioContext.state);
      
      // Create microphone source - this is what gets transcribed
      const micSource = this.audioContext.createMediaStreamSource(micStream);
      console.log('🎤 Microphone source created');
      
      // Create script processor ONLY for microphone audio
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
      console.log('⚙️ Audio processor created');
      
      this.processor.onaudioprocess = (e) => {
        if (!this.sessionReady || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
          return;
        }
        
        const inputData = e.inputBuffer.getChannelData(0);
        
        // Check if we have actual audio data
        const maxLevel = Math.max(...inputData.map(Math.abs));
        if (maxLevel > 0.001) {
          console.log('🎤 Microphone audio detected, level:', maxLevel.toFixed(4));
        }
        
        const encodedAudio = this.encodeAudioForAPI(new Float32Array(inputData));
        
        // Send ONLY microphone audio to OpenAI for transcription
        const audioMessage = {
          type: 'input_audio_buffer.append',
          audio: encodedAudio
        };
        
        this.ws.send(JSON.stringify(audioMessage));
      };

      // Connect ONLY microphone to processor for transcription
      console.log('🔌 Connecting microphone to audio processor...');
      micSource.connect(this.processor);
      this.processor.connect(this.audioContext.destination);
      console.log('✅ Microphone connected to processor');

      // Store streams for cleanup
      this.stream = micStream;
      if (displayStream) {
        // Add display stream tracks to our main stream for cleanup
        displayStream.getAudioTracks().forEach(track => {
          this.stream?.addTrack(track);
        });
      }

      console.log('✅ Microphone audio setup complete for transcription');
      
      // Test microphone by checking if tracks are active
      const micTracks = micStream.getAudioTracks();
      if (micTracks.length === 0) {
        throw new Error('No microphone tracks available');
      }
      
      micTracks.forEach((track, index) => {
        console.log(`🎤 Mic track ${index}:`, {
          enabled: track.enabled,
          muted: track.muted,
          readyState: track.readyState,
          label: track.label
        });
      });
      
    } catch (error) {
      console.error('❌ Error setting up microphone audio:', error);
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

    this.config.onStatusChange?.('Stopping recording...');
    
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
      
      this.config.onStatusChange?.('Recording stopped');
      
    } catch (error) {
      console.error('Error stopping recording:', error);
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