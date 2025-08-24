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
    console.log('🎙️ Starting Speech Recognition (using browser fallback)...');
    this.language = language;
    this.medicalBias = medicalBias;
    
    try {
      this.onStatusChange('connecting');
      await this.setupBrowserSpeechRecognition();
      this.isRecording = true;
      this.onStatusChange('live');
      console.log('✅ Speech recognition started successfully');
    } catch (error) {
      console.error('❌ Failed to start speech recognition:', error);
      this.onError(error instanceof Error ? error.message : 'Failed to start speech recognition');
      this.onStatusChange('error');
    }
  }

  private recognition: any = null;

  private async setupBrowserSpeechRecognition() {
    console.log('🔗 Setting up browser speech recognition...');
    
    // Check if speech recognition is available
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      throw new Error('Speech recognition not supported in this browser');
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = this.language;

    this.recognition.onstart = () => {
      console.log('🎙️ Browser speech recognition started');
      this.onStatusChange('connected');
    };

    this.recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      if (finalTranscript) {
        console.log('📝 Final transcript:', finalTranscript);
        this.onTranscription({
          text: finalTranscript,
          isFinal: true,
          confidence: 0.9
        });
      } else if (interimTranscript) {
        console.log('📝 Interim transcript:', interimTranscript);
        this.onTranscription({
          text: interimTranscript,
          isFinal: false,
          confidence: 0.7
        });
      }
    };

    this.recognition.onerror = (event: any) => {
      console.error('❌ Speech recognition error:', event.error);
      if (event.error === 'not-allowed') {
        this.onError('Microphone access denied. Please allow microphone access.');
      } else {
        this.onError(`Speech recognition error: ${event.error}`);
      }
      this.onStatusChange('error');
    };

    this.recognition.onend = () => {
      console.log('🔚 Speech recognition ended');
      if (this.isRecording) {
        // Restart if we're still supposed to be recording
        setTimeout(() => {
          if (this.isRecording) {
            this.recognition.start();
          }
        }, 100);
      } else {
        this.onStatusChange('disconnected');
      }
    };

    this.recognition.start();
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
    console.log('🛑 Stopping speech recognition...');
    
    this.isRecording = false;
    
    // Stop browser speech recognition
    if (this.recognition) {
      this.recognition.stop();
      this.recognition = null;
    }
    
    this.onStatusChange('disconnected');
    console.log('✅ Speech recognition stopped');
  }

  clearTranscript() {
    console.log('🧹 Clearing transcript');
    // This is handled at the UI level
  }

  isActive(): boolean {
    return this.isRecording && this.recognition !== null;
  }
}