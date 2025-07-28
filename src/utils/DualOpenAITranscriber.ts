export interface DualOpenAIConfig {
  onTranscript?: (transcript: string, isFinal: boolean, source: 'microphone' | 'speaker') => void;
  onStatusChange?: (status: string) => void;
  onError?: (error: string) => void;
  onCombinedTranscript?: (transcript: string) => void;
}

export class DualOpenAITranscriber {
  private micWs: WebSocket | null = null;
  private speakerWs: WebSocket | null = null;
  private micAudioContext: AudioContext | null = null;
  private speakerAudioContext: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private speakerStream: MediaStream | null = null;
  private micProcessor: ScriptProcessorNode | null = null;
  private speakerProcessor: ScriptProcessorNode | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private speakerSource: MediaStreamAudioSourceNode | null = null;
  private isRecording = false;
  private micSessionReady = false;
  private speakerSessionReady = false;
  private micTranscript = '';
  private speakerTranscript = '';
  
  constructor(private config: DualOpenAIConfig = {}) {}

  async startRecording(): Promise<void> {
    if (this.isRecording) {
      throw new Error('Already recording');
    }

    try {
      this.config.onStatusChange?.('Starting dual OpenAI recording...');
      
      // Connect to OpenAI for both microphone and speaker
      await Promise.all([
        this.setupMicrophoneRecording(),
        this.setupSpeakerRecording()
      ]);
      
      this.isRecording = true;
      this.config.onStatusChange?.('Dual OpenAI recording active - mic + speaker');
      
    } catch (error) {
      console.error('Error starting dual OpenAI recording:', error);
      this.cleanup();
      throw error;
    }
  }

  private async setupMicrophoneRecording(): Promise<void> {
    console.log('🎤 Setting up microphone OpenAI connection...');
    
    // Connect to OpenAI WebSocket for microphone
    this.micWs = new WebSocket('wss://dphcnbricafkbtizkoal.functions.supabase.co/openai-realtime-session');
    
    this.micWs.onopen = () => {
      console.log('Microphone WebSocket connected');
    };

    this.micWs.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('Mic received:', data.type);
        
        switch (data.type) {
          case 'session.created':
            console.log('Mic session created');
            break;
            
          case 'session.updated':
            console.log('Mic session updated, ready for audio');
            this.micSessionReady = true;
            break;
            
          case 'conversation.item.input_audio_transcription.completed':
            const transcript = data.transcript;
            console.log('Mic transcript:', transcript);
            this.micTranscript += `[MIC] ${transcript} `;
            this.config.onTranscript?.(transcript, true, 'microphone');
            this.updateCombinedTranscript();
            break;
        }
      } catch (error) {
        console.error('Error parsing mic WebSocket message:', error);
      }
    };

    this.micWs.onerror = (error) => {
      console.error('Mic WebSocket error:', error);
      this.config.onError?.('Microphone connection error');
    };

    // Wait for connection
    await new Promise<void>((resolve, reject) => {
      if (!this.micWs) return reject(new Error('Mic WebSocket not initialized'));
      
      const originalOnOpen = this.micWs.onopen;
      this.micWs.onopen = (event) => {
        if (originalOnOpen) originalOnOpen.call(this.micWs!, event);
        resolve();
      };
      
      const originalOnError = this.micWs.onerror;
      this.micWs.onerror = (error) => {
        if (originalOnError) originalOnError.call(this.micWs!, error);
        reject(error);
      };
    });

    // Set up microphone audio capture
    const micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: 24000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });

    this.micAudioContext = new AudioContext({ sampleRate: 24000 });
    this.micSource = this.micAudioContext.createMediaStreamSource(micStream);
    this.micProcessor = this.micAudioContext.createScriptProcessor(4096, 1, 1);
    
    this.micProcessor.onaudioprocess = (e) => {
      if (!this.micSessionReady || !this.micWs || this.micWs.readyState !== WebSocket.OPEN) {
        return;
      }
      
      const inputData = e.inputBuffer.getChannelData(0);
      const encodedAudio = this.encodeAudioForAPI(new Float32Array(inputData));
      
      const audioMessage = {
        type: 'input_audio_buffer.append',
        audio: encodedAudio
      };
      
      this.micWs.send(JSON.stringify(audioMessage));
    };

    this.micSource.connect(this.micProcessor);
    this.micProcessor.connect(this.micAudioContext.destination);
    this.micStream = micStream;
  }

  private async setupSpeakerRecording(): Promise<void> {
    console.log('🔊 Setting up speaker OpenAI connection...');
    
    // Connect to OpenAI WebSocket for speaker
    this.speakerWs = new WebSocket('wss://dphcnbricafkbtizkoal.functions.supabase.co/openai-realtime-session');
    
    this.speakerWs.onopen = () => {
      console.log('Speaker WebSocket connected');
    };

    this.speakerWs.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('Speaker received:', data.type);
        
        switch (data.type) {
          case 'session.created':
            console.log('Speaker session created');
            break;
            
          case 'session.updated':
            console.log('Speaker session updated, ready for audio');
            this.speakerSessionReady = true;
            break;
            
          case 'conversation.item.input_audio_transcription.completed':
            const transcript = data.transcript;
            console.log('Speaker transcript:', transcript);
            this.speakerTranscript += `[SPEAKER] ${transcript} `;
            this.config.onTranscript?.(transcript, true, 'speaker');
            this.updateCombinedTranscript();
            break;
        }
      } catch (error) {
        console.error('Error parsing speaker WebSocket message:', error);
      }
    };

    this.speakerWs.onerror = (error) => {
      console.error('Speaker WebSocket error:', error);
      this.config.onError?.('Speaker connection error');
    };

    // Wait for connection
    await new Promise<void>((resolve, reject) => {
      if (!this.speakerWs) return reject(new Error('Speaker WebSocket not initialized'));
      
      const originalOnOpen = this.speakerWs.onopen;
      this.speakerWs.onopen = (event) => {
        if (originalOnOpen) originalOnOpen.call(this.speakerWs!, event);
        resolve();
      };
      
      const originalOnError = this.speakerWs.onerror;
      this.speakerWs.onerror = (error) => {
        if (originalOnError) originalOnError.call(this.speakerWs!, error);
        reject(error);
      };
    });

    // Set up speaker audio capture
    try {
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
        console.warn('No speaker audio available, skipping speaker transcription');
        return;
      }

      this.speakerAudioContext = new AudioContext({ sampleRate: 24000 });
      this.speakerSource = this.speakerAudioContext.createMediaStreamSource(displayStream);
      this.speakerProcessor = this.speakerAudioContext.createScriptProcessor(4096, 1, 1);
      
      this.speakerProcessor.onaudioprocess = (e) => {
        if (!this.speakerSessionReady || !this.speakerWs || this.speakerWs.readyState !== WebSocket.OPEN) {
          return;
        }
        
        const inputData = e.inputBuffer.getChannelData(0);
        const encodedAudio = this.encodeAudioForAPI(new Float32Array(inputData));
        
        const audioMessage = {
          type: 'input_audio_buffer.append',
          audio: encodedAudio
        };
        
        this.speakerWs.send(JSON.stringify(audioMessage));
      };

      this.speakerSource.connect(this.speakerProcessor);
      this.speakerProcessor.connect(this.speakerAudioContext.destination);
      this.speakerStream = displayStream;
      
    } catch (error) {
      console.warn('Could not capture speaker audio:', error);
      // Continue without speaker audio
    }
  }

  private updateCombinedTranscript(): void {
    const combined = this.micTranscript + this.speakerTranscript;
    this.config.onCombinedTranscript?.(combined);
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

    this.config.onStatusChange?.('Stopping dual OpenAI recording...');
    
    try {
      // Send final audio buffer commits
      if (this.micWs && this.micWs.readyState === WebSocket.OPEN) {
        this.micWs.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
      }
      
      if (this.speakerWs && this.speakerWs.readyState === WebSocket.OPEN) {
        this.speakerWs.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
      }
      
      this.isRecording = false;
      this.cleanup();
      
      this.config.onStatusChange?.('Dual OpenAI recording stopped');
      
    } catch (error) {
      console.error('Error stopping dual OpenAI recording:', error);
      this.config.onError?.(`Error stopping recording: ${error.message}`);
    }
  }

  private cleanup(): void {
    // Clean up microphone
    if (this.micSource) {
      this.micSource.disconnect();
      this.micSource = null;
    }
    
    if (this.micProcessor) {
      this.micProcessor.disconnect();
      this.micProcessor = null;
    }
    
    if (this.micStream) {
      this.micStream.getTracks().forEach(track => track.stop());
      this.micStream = null;
    }
    
    if (this.micAudioContext) {
      this.micAudioContext.close();
      this.micAudioContext = null;
    }
    
    if (this.micWs) {
      this.micWs.close();
      this.micWs = null;
    }

    // Clean up speaker
    if (this.speakerSource) {
      this.speakerSource.disconnect();
      this.speakerSource = null;
    }
    
    if (this.speakerProcessor) {
      this.speakerProcessor.disconnect();
      this.speakerProcessor = null;
    }
    
    if (this.speakerStream) {
      this.speakerStream.getTracks().forEach(track => track.stop());
      this.speakerStream = null;
    }
    
    if (this.speakerAudioContext) {
      this.speakerAudioContext.close();
      this.speakerAudioContext = null;
    }
    
    if (this.speakerWs) {
      this.speakerWs.close();
      this.speakerWs = null;
    }
    
    this.micSessionReady = false;
    this.speakerSessionReady = false;
    this.micTranscript = '';
    this.speakerTranscript = '';
  }

  getRecordingStatus(): boolean {
    return this.isRecording;
  }

  getCombinedTranscript(): string {
    return this.micTranscript + this.speakerTranscript;
  }
}