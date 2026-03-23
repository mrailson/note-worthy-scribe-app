export interface TranscriptData {
  text: string;
  is_final: boolean;
  confidence: number;
  start?: number;
  end?: number;
  speaker?: string;
}

/**
 * Gladia real-time transcriber
 * Uses the Gladia WebSocket streaming API via our edge-function proxy.
 * Falls back gracefully if no proxy is available.
 */
export class GladiaRealtimeTranscriber {
  private ws: WebSocket | null = null;
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private isRecording = false;
  private shouldReconnect = true;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private fullTranscript = '';

  constructor(
    private onTranscription: (data: TranscriptData) => void,
    private onError: (error: string) => void,
    private onStatusChange: (status: string) => void,
    private onSummary?: (summary: string) => void
  ) {}

  async startTranscription(externalStream?: MediaStream) {
    console.log('🚀 Starting Gladia real-time transcription...');

    try {
      this.shouldReconnect = true;
      this.onStatusChange('Connecting...');

      // Use external stream or request mic
      if (externalStream) {
        this.mediaStream = externalStream;
      } else {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 16000 }
        });
      }

      // Connect to Gladia WebSocket proxy
      const wsUrl = `wss://dphcnbricafkbtizkoal.supabase.co/functions/v1/gladia-streaming`;
      console.log('📡 Connecting to Gladia WebSocket at:', wsUrl);

      this.ws = new WebSocket(wsUrl);
      this.ws.binaryType = 'arraybuffer';

      this.ws.onopen = async () => {
        console.log('✅ Connected to Gladia WebSocket proxy');
        this.onStatusChange('connected');
        this.reconnectAttempts = 0;

        // Send session config
        this.ws?.send(JSON.stringify({
          type: 'session.start',
          config: {
            encoding: 'raw',
            sample_rate: 16000,
            language: 'en',
            model: 'fast',
          }
        }));

        await this.startAudioCapture();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'transcript') {
            const isFinal = data.is_final === true;
            const text = data.transcript || data.text || '';
            const confidence = data.confidence ?? 0.9;

            if (text.trim()) {
              if (isFinal) {
                this.fullTranscript += (this.fullTranscript ? ' ' : '') + text.trim();
              }

              this.onTranscription({
                text: text.trim(),
                is_final: isFinal,
                confidence,
                start: data.time_begin,
                end: data.time_end,
                speaker: data.speaker ? `Speaker ${data.speaker}` : undefined,
              });
            }
          } else if (data.type === 'error') {
            const errMsg = data.error || data.message || 'Gladia error';
            if (/closed\s*\(\d+\)/i.test(String(errMsg)) && this.shouldReconnect) {
              console.warn(`⚠️ Gladia transient error: ${errMsg}`);
              return;
            }
            console.error('❌ Gladia error:', errMsg);
            this.onError(String(errMsg));
          } else if (data.type === 'session.started' || data.type === 'ready') {
            console.log('🎙️ Gladia session ready');
            this.onStatusChange('recording');
            this.isRecording = true;
          }
        } catch (e) {
          console.warn('⚠️ Failed to parse Gladia message:', e);
        }
      };

      this.ws.onclose = (event) => {
        console.log(`🔌 Gladia WebSocket closed: ${event.code} ${event.reason}`);
        this.isRecording = false;

        if (this.shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.attemptReconnect();
        } else {
          this.onStatusChange('disconnected');
        }
      };

      this.ws.onerror = (event) => {
        console.error('❌ Gladia WebSocket error:', event);
        if (!this.shouldReconnect) {
          this.onError('Gladia connection error');
        }
      };
    } catch (err: any) {
      console.error('❌ Gladia start error:', err);
      this.onError(err.message || 'Failed to start Gladia');
      this.onStatusChange('error');
    }
  }

  private async startAudioCapture() {
    if (!this.mediaStream || !this.ws) return;

    try {
      this.audioContext = new AudioContext({ sampleRate: 16000 });
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);

      // Use ScriptProcessor as fallback (simpler than AudioWorklet for cross-browser)
      const processor = this.audioContext.createScriptProcessor(4096, 1, 1);

      processor.onaudioprocess = (e) => {
        if (!this.isRecording || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        const inputData = e.inputBuffer.getChannelData(0);
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        this.ws.send(pcm16.buffer);
      };

      source.connect(processor);
      processor.connect(this.audioContext.destination);
      this.isRecording = true;
      this.onStatusChange('recording');
    } catch (err: any) {
      console.error('❌ Gladia audio capture error:', err);
      this.onError('Audio capture failed');
    }
  }

  private attemptReconnect() {
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 15000);
    console.log(`🔄 Gladia reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
    this.onStatusChange('reconnecting');

    this.reconnectTimeout = setTimeout(() => {
      if (this.shouldReconnect) {
        this.startTranscription(this.mediaStream || undefined);
      }
    }, delay);
  }

  stopTranscription() {
    console.log('⏹ Stopping Gladia transcription');
    this.shouldReconnect = false;
    this.isRecording = false;

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      try {
        this.ws.send(JSON.stringify({ type: 'session.end' }));
        this.ws.close(1000, 'Manual stop');
      } catch { /* ignore */ }
      this.ws = null;
    }

    if (this.audioContext) {
      try { this.audioContext.close(); } catch { /* ignore */ }
      this.audioContext = null;
    }

    // Don't close external streams
    this.onStatusChange('stopped');

    if (this.fullTranscript && this.onSummary) {
      this.onSummary(this.fullTranscript);
    }
  }

  getFullTranscript(): string {
    return this.fullTranscript;
  }
}
