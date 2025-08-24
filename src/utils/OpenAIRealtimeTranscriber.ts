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
  private language: string = 'en';
  private medicalBias: boolean = false;
  private latencyStart: number = 0;
  private deepgramConfig: any = null;

  constructor(
    private onTranscription: (data: TranscriptData) => void,
    private onError: (error: string) => void,
    private onStatusChange: (status: ConnectionStatus, latency?: number) => void
  ) {}

  async startTranscription(language: string = 'en', medicalBias: boolean = false) {
    console.log('🎙️ Starting Deepgram Realtime Transcription...');
    this.language = language;
    this.medicalBias = medicalBias;
    
    try {
      this.onStatusChange('connecting');
      await this.setupDeepgramSession();
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

  private async setupDeepgramSession() {
    console.log('🔗 Setting up Deepgram session...');
    
    // Get Deepgram configuration from our edge function
    const { data, error } = await supabase.functions.invoke('openai-realtime-token', {
      body: {
        language: this.language,
        medicalBias: this.medicalBias
      }
    });

    if (error) {
      throw new Error(`Failed to get session token: ${error.message}`);
    }

    if (!data?.url) {
      throw new Error('No Deepgram URL received');
    }

    this.deepgramConfig = data;
    console.log('📡 Connecting to Deepgram...');

    // Connect to Deepgram WebSocket using the pre-configured URL with authentication
    this.ws = new WebSocket(this.deepgramConfig.url);

    this.ws.addEventListener('open', () => {
      console.log('🔌 Deepgram WebSocket connected successfully');
      this.onStatusChange('connected');
    });

    this.ws.addEventListener('message', (event) => {
      try {
        const message = JSON.parse(event.data);
        this.handleDeepgramMessage(message);
      } catch (error) {
        console.error('❌ Error parsing WebSocket message:', error);
      }
    });

    this.ws.addEventListener('error', (error) => {
      console.error('❌ Deepgram WebSocket error:', error);
      this.onError('Deepgram connection error occurred');
      this.onStatusChange('error');
    });

    this.ws.addEventListener('close', (event) => {
      console.log('🔌 Deepgram WebSocket disconnected:', event.code, event.reason);
      if (event.code !== 1000 && event.code !== 1001) {
        this.onError(`Connection closed unexpectedly (${event.code}): ${event.reason || 'Unknown reason'}`);
      }
      this.onStatusChange('disconnected');
    });

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout - please check your internet connection'));
      }, 15000);

      this.ws!.addEventListener('open', () => {
        clearTimeout(timeout);
        resolve();
      });

      this.ws!.addEventListener('error', (error) => {
        clearTimeout(timeout);
        reject(new Error('Failed to connect to Deepgram - please check your API key'));
      });
    });
  }

  private handleDeepgramMessage(message: any) {
    console.log('📥 Deepgram message:', message);

    // Deepgram sends different message structure
    if (message.channel?.alternatives) {
      const alternative = message.channel.alternatives[0];
      if (alternative?.transcript) {
        const isFinal = message.is_final || false;
        const text = alternative.transcript;
        
        if (text.trim()) {
          console.log(`📝 ${isFinal ? 'Final' : 'Interim'} transcript:`, text);
          
          if (isFinal && this.latencyStart) {
            const latency = Date.now() - this.latencyStart;
            this.onStatusChange('live', latency);
            this.latencyStart = 0;
          } else if (!isFinal && !this.latencyStart) {
            this.latencyStart = Date.now();
          }

          this.onTranscription({
            text,
            isFinal,
            confidence: alternative.confidence || 0.9,
            start: message.start,
            end: message.end,
            words: alternative.words?.map((word: any) => ({
              word: word.word,
              start: word.start,
              end: word.end,
              confidence: word.confidence || 0.9
            }))
          });
        }
      }
    } else if (message.type === 'Metadata') {
      console.log('📊 Deepgram metadata:', message);
    } else if (message.type === 'SpeechStarted') {
      console.log('🗣️ Speech detected');
      this.latencyStart = Date.now();
    } else if (message.type === 'UtteranceEnd') {
      console.log('🤫 Utterance ended');
    } else if (message.error) {
      console.error('❌ Deepgram error:', message.error);
      this.onError(message.error);
    } else {
      console.log('📥 Deepgram other message:', message);
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
          if (this.ws && this.ws.readyState === WebSocket.OPEN && this.isRecording) {
            // Send raw binary PCM16 data directly to Deepgram
            this.ws.send(event.data);
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
      if (this.ws && this.ws.readyState === WebSocket.OPEN && this.isRecording) {
        const inputData = event.inputBuffer.getChannelData(0);
        
        // Convert to PCM16 for Deepgram
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        
        // Send raw binary PCM16 data to Deepgram
        this.ws.send(pcm16.buffer);
      }
    };
    
    source.connect(processor);
    processor.connect(this.audioContext.destination);
    
    console.log('✅ ScriptProcessor fallback setup complete');
  }

  stopTranscription() {
    console.log('🛑 Stopping transcription...');
    
    this.isRecording = false;
    
    // Send close frame to Deepgram
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'CloseStream' }));
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