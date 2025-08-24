import { supabase } from '@/integrations/supabase/client';

export interface TranscriptData {
  text: string;
  isFinal: boolean;
  confidence: number;
  start?: number;
  end?: number;
  speaker?: string;
  words?: Array<{
    word: string;
    start: number;
    end: number;
    confidence: number;
    speaker?: number;
  }>;
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'live' | 'error';

export class OpenAIRealtimeTranscriber {
  private ws: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private audioWorklet: AudioWorkletNode | null = null;
  private mediaStream: MediaStream | null = null;
  private isRecording = false;
  private sessionId: string | null = null;
  private language: string = 'en';
  private medicalBias: boolean = false;
  private latencyStart: number = 0;

  constructor(
    private onTranscription: (data: TranscriptData) => void,
    private onError: (error: string) => void,
    private onStatusChange: (status: ConnectionStatus, latency?: number) => void
  ) {}

  async startTranscription(language: string = 'en', medicalBias: boolean = false) {
    console.log('🎙️ Starting OpenAI Realtime Transcription...');
    this.language = language;
    this.medicalBias = medicalBias;
    
    try {
      this.onStatusChange('connecting');
      await this.setupRealtimeSession();
      await this.setupAudioCapture();
      this.isRecording = true;
      this.onStatusChange('live');
      console.log('✅ Transcription started successfully');
    } catch (error) {
      console.error('❌ Failed to start transcription:', error);
      this.onError(error instanceof Error ? error.message : 'Failed to start transcription');
      this.onStatusChange('error');
    }
  }

  private async setupRealtimeSession() {
    console.log('🔗 Setting up realtime session...');
    
    // Get token from our edge function
    const { data, error } = await supabase.functions.invoke('openai-realtime-token', {
      body: {
        language: this.language,
        medicalBias: this.medicalBias
      }
    });

    if (error) {
      throw new Error(`Failed to get session token: ${error.message}`);
    }

    if (!data?.client_secret?.value) {
      throw new Error('No session token received');
    }

    this.sessionId = data.id;
    const token = data.client_secret.value;

    // Connect to OpenAI Realtime API using WebSocket
    const wsUrl = `wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17`;
    this.ws = new WebSocket(wsUrl, ["realtime"]);
    
    // Set authorization header
    this.ws.addEventListener('open', () => {
      console.log('🔌 WebSocket connected');
      this.onStatusChange('connected');
      
      // Send authentication
      this.ws?.send(JSON.stringify({
        type: 'session.update',
        session: {
          input_audio_format: "pcm16",
          input_audio_transcription: {
            enabled: true,
            language: this.language === "auto" ? undefined : this.language
          },
          modalities: ["text"],
          turn_detection: {
            type: "server_vad",
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 500
          },
          instructions: this.medicalBias 
            ? "Transcribe UK primary care speech with medical abbreviations. Preserve drug names, doses, routes accurately. Use UK spelling."
            : "Transcribe speech clearly and accurately."
        }
      }));
    });

    this.ws.addEventListener('message', (event) => {
      try {
        const message = JSON.parse(event.data);
        this.handleRealtimeMessage(message);
      } catch (error) {
        console.error('❌ Error parsing WebSocket message:', error);
      }
    });

    this.ws.addEventListener('error', (error) => {
      console.error('❌ WebSocket error:', error);
      this.onError('Connection error occurred');
      this.onStatusChange('error');
    });

    this.ws.addEventListener('close', () => {
      console.log('🔌 WebSocket disconnected');
      this.onStatusChange('disconnected');
    });

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 10000);

      this.ws!.addEventListener('open', () => {
        clearTimeout(timeout);
        resolve();
      });

      this.ws!.addEventListener('error', () => {
        clearTimeout(timeout);
        reject(new Error('Failed to connect to OpenAI'));
      });
    });
  }

  private handleRealtimeMessage(message: any) {
    console.log('📥 Realtime message:', message.type, message);

    switch (message.type) {
      case 'session.created':
      case 'session.updated':
        console.log('✅ Session configured:', message);
        break;

      case 'input_audio_buffer.speech_started':
        console.log('🗣️ Speech detected');
        this.latencyStart = Date.now();
        break;

      case 'input_audio_buffer.speech_stopped':
        console.log('🤫 Speech ended');
        break;

      case 'conversation.item.input_audio_transcription.completed':
        const finalText = message.transcript;
        if (finalText && finalText.trim()) {
          console.log('📝 Final transcript:', finalText);
          const latency = this.latencyStart ? Date.now() - this.latencyStart : 0;
          this.onStatusChange('live', latency);
          this.onTranscription({
            text: finalText,
            isFinal: true,
            confidence: 0.9, // OpenAI doesn't provide confidence scores
          });
        }
        break;

      case 'conversation.item.input_audio_transcription.failed':
        console.warn('⚠️ Transcription failed:', message.error);
        this.onError('Transcription failed: ' + (message.error?.message || 'Unknown error'));
        break;

      case 'error':
        console.error('❌ OpenAI error:', message.error);
        this.onError(message.error?.message || 'Unknown error occurred');
        break;
    }
  }

  private async setupAudioCapture() {
    console.log('🎧 Setting up audio capture...');
    
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      this.audioContext = new AudioContext({ sampleRate: 24000 });
      
      // Load audio worklet processor for better performance
      try {
        await this.audioContext.audioWorklet.addModule(
          'data:application/javascript;base64,' + btoa(`
            class AudioProcessor extends AudioWorkletProcessor {
              constructor() {
                super();
                this.bufferSize = 1024;
                this.buffer = new Float32Array(this.bufferSize);
                this.bufferIndex = 0;
              }
              
              process(inputs, outputs, parameters) {
                const input = inputs[0];
                if (input.length > 0) {
                  const channelData = input[0];
                  
                  for (let i = 0; i < channelData.length; i++) {
                    this.buffer[this.bufferIndex++] = channelData[i];
                    
                    if (this.bufferIndex >= this.bufferSize) {
                      // Convert to PCM16 and send
                      const pcm16 = new Int16Array(this.bufferSize);
                      for (let j = 0; j < this.bufferSize; j++) {
                        const s = Math.max(-1, Math.min(1, this.buffer[j]));
                        pcm16[j] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                      }
                      
                      this.port.postMessage(pcm16.buffer);
                      this.bufferIndex = 0;
                    }
                  }
                }
                return true;
              }
            }
            
            registerProcessor('audio-processor', AudioProcessor);
          `)
        );
        
        this.audioWorklet = new AudioWorkletNode(this.audioContext, 'audio-processor');
        this.audioWorklet.port.onmessage = (event) => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            // Convert ArrayBuffer to base64
            const uint8Array = new Uint8Array(event.data);
            let binary = '';
            const chunkSize = 0x8000;
            
            for (let i = 0; i < uint8Array.length; i += chunkSize) {
              const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
              binary += String.fromCharCode.apply(null, Array.from(chunk));
            }
            
            const base64 = btoa(binary);
            
            this.ws.send(JSON.stringify({
              type: 'input_audio_buffer.append',
              audio: base64
            }));
          }
        };
        
        const source = this.audioContext.createMediaStreamSource(this.mediaStream);
        source.connect(this.audioWorklet);
        
        console.log('✅ Audio worklet setup complete');
        
      } catch (workletError) {
        console.warn('⚠️ Audio worklet failed, falling back to ScriptProcessor:', workletError);
        await this.setupScriptProcessorFallback();
      }
    } catch (error) {
      throw new Error(`Failed to access microphone: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async setupScriptProcessorFallback() {
    if (!this.audioContext || !this.mediaStream) return;
    
    const source = this.audioContext.createMediaStreamSource(this.mediaStream);
    const processor = this.audioContext.createScriptProcessor(4096, 1, 1);
    
    processor.onaudioprocess = (event) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        const inputData = event.inputBuffer.getChannelData(0);
        
        // Convert to PCM16
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        
        // Convert to base64
        const uint8Array = new Uint8Array(pcm16.buffer);
        let binary = '';
        const chunkSize = 0x8000;
        
        for (let i = 0; i < uint8Array.length; i += chunkSize) {
          const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
          binary += String.fromCharCode.apply(null, Array.from(chunk));
        }
        
        const base64 = btoa(binary);
        
        this.ws.send(JSON.stringify({
          type: 'input_audio_buffer.append',
          audio: base64
        }));
      }
    };
    
    source.connect(processor);
    processor.connect(this.audioContext.destination);
    
    console.log('✅ ScriptProcessor fallback setup complete');
  }

  stopTranscription() {
    console.log('🛑 Stopping transcription...');
    
    this.isRecording = false;
    
    // Commit final audio buffer
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'input_audio_buffer.commit'
      }));
    }
    
    // Clean up audio resources
    if (this.audioWorklet) {
      this.audioWorklet.disconnect();
      this.audioWorklet = null;
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    
    // Close WebSocket
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.onStatusChange('disconnected');
    console.log('✅ Transcription stopped');
  }

  clearTranscript() {
    console.log('🧹 Clearing transcript');
    // This is handled at the UI level
  }

  isActive(): boolean {
    return this.isRecording && this.ws?.readyState === WebSocket.OPEN;
  }
}