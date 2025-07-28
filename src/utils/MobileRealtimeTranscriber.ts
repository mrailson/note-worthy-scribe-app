export class MobileRealtimeTranscriber {
  private ws: WebSocket | null = null;
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private isRecording = false;
  

  constructor(
    private onTranscript: (transcript: TranscriptData) => void,
    private onError: (error: string) => void,
    private onStatusChange: (status: string) => void
  ) {}

  async startTranscription() {
    try {
      this.onStatusChange('Initializing mobile audio...');
      
      // Check if we're on iOS/Safari and optimize accordingly
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
      
      console.log(`📱 Starting transcription on ${isIOS ? 'iOS' : 'mobile'} device`);

      // Step 1: Start audio capture with mobile-optimized settings
      await this.startMobileAudioCapture();
      
      // Step 2: Connect to OpenAI Realtime API
      await this.connectToOpenAI();
      
      this.onStatusChange('Recording...');
    } catch (error) {
      console.error('Failed to start mobile transcription:', error);
      this.onError('Failed to start transcription: ' + error.message);
    }
  }


  private async startMobileAudioCapture() {
    try {
      // Mobile-optimized audio constraints
      const constraints = {
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          // iOS-specific optimizations
          latency: 0.02, // Low latency for real-time
          volume: 1.0
        }
      };

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('📱 Mobile audio stream acquired');

      // Create AudioContext with mobile-optimized settings
      this.audioContext = new AudioContext({
        sampleRate: 24000,
        latencyHint: 'interactive'
      });

      // Handle iOS Safari audio context restrictions
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      this.source = this.audioContext.createMediaStreamSource(this.stream);
      
      // Use ScriptProcessorNode for real-time processing (better iOS compatibility)
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
      
      this.processor.onaudioprocess = (e) => {
        if (this.isRecording && this.ws?.readyState === WebSocket.OPEN) {
          const inputData = e.inputBuffer.getChannelData(0);
          this.sendAudioToOpenAI(new Float32Array(inputData));
        }
      };

      this.source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);

      console.log('🎵 Mobile audio processing pipeline established');
    } catch (error) {
      console.error('Mobile audio capture error:', error);
      throw error;
    }
  }

  private async connectToOpenAI() {
    return new Promise<void>((resolve, reject) => {
      try {
        // Connect through our secure edge function
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/functions/v1/realtime-transcription`;
        
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          console.log('🔄 Connected to OpenAI Realtime API via secure proxy');
          this.isRecording = true;
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleOpenAIMessage(data);
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          reject(new Error('WebSocket connection failed'));
        };

        this.ws.onclose = () => {
          console.log('WebSocket connection closed');
          this.isRecording = false;
        };
      } catch (error) {
        reject(error);
      }
    });
  }


  private sendAudioToOpenAI(audioData: Float32Array) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    try {
      // Convert Float32Array to PCM16 format for OpenAI
      const pcm16Data = this.convertToPCM16(audioData);
      const base64Audio = this.arrayBufferToBase64(pcm16Data);

      this.ws.send(JSON.stringify({
        type: 'input_audio_buffer.append',
        audio: base64Audio
      }));
    } catch (error) {
      console.error('Error sending audio to OpenAI:', error);
    }
  }

  private convertToPCM16(float32Array: Float32Array): ArrayBuffer {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return int16Array.buffer;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunkSize = 0x8000;
    
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    
    return btoa(binary);
  }

  private handleOpenAIMessage(data: any) {
    console.log('📨 OpenAI message:', data.type);

    switch (data.type) {
      case 'session.created':
        console.log('✅ OpenAI session established');
        break;

      case 'session.updated':
        console.log('🔄 Session configuration updated');
        break;

      case 'input_audio_buffer.speech_started':
        console.log('🎤 Speech detected');
        break;

      case 'input_audio_buffer.speech_stopped':
        console.log('🔇 Speech ended');
        break;

      case 'conversation.item.input_audio_transcription.completed':
        if (data.transcript && data.transcript.trim()) {
          this.onTranscript({
            text: data.transcript,
            speaker: 'Speaker',
            confidence: 0.95,
            timestamp: new Date().toISOString(),
            isFinal: true,
            is_final: true,
            words: []
          });
        }
        break;

      case 'conversation.item.input_audio_transcription.failed':
        console.warn('⚠️ Transcription failed:', data.error);
        break;

      case 'error':
        this.onError('OpenAI API error: ' + (data.error?.message || 'Unknown error'));
        break;

      default:
        // Log other message types for debugging
        if (data.type) {
          console.log(`📋 OpenAI event: ${data.type}`);
        }
        break;
    }
  }

  stopTranscription() {
    this.isRecording = false;
    this.onStatusChange('Stopping...');

    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }

    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.onStatusChange('Stopped');
  }

  isActive() {
    return this.isRecording;
  }
}

export interface TranscriptData {
  text: string;
  speaker: string;
  confidence: number;
  timestamp: string;
  isFinal: boolean;
  is_final: boolean; // Match BrowserSpeechTranscriber interface
  words?: Array<{
    text: string;
    start: number;
    end: number;
    confidence: number;
  }>;
}