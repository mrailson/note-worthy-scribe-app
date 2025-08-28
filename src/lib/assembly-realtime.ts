// src/lib/assembly-realtime.ts
// Minimal Realtime client for AssemblyAI. Handles: get token, open WS, send base64 PCM16, receive partial/final.

type Callbacks = {
  onOpen?: () => void;
  onPartial?: (text: string) => void;
  onFinal?: (text: string) => void;
  onClose?: (code: number, reason: string) => void;
  onError?: (err: any) => void;
};

export class AssemblyRealtimeClient {
  private ws?: WebSocket;
  private audioCtx?: AudioContext;
  private source?: MediaStreamAudioSourceNode;
  private processor?: ScriptProcessorNode;
  private downsampleRatio = 44100 / 16000; // assume 44.1k input; we'll resample to 16k
  private sending = false;

  constructor(private callbacks: Callbacks = {}) {}

  async start() {
    try {
      console.log('[AssemblyAI-Realtime] Starting client...');
      
      // 1) Get short-lived token from your backend
      const { getAssemblyToken } = await import("./getAssemblyToken");
      const token = await getAssemblyToken();
      console.log('[AssemblyAI-Realtime] Token obtained successfully');

      // 2) Open realtime websocket
      const url = `wss://api.assemblyai.com/v2/realtime/ws?sample_rate=16000&token=${encodeURIComponent(token)}`;
      console.log('[AssemblyAI-Realtime] Connecting to WebSocket...');
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        console.log('[AssemblyAI-Realtime] WebSocket connected');
        this.callbacks.onOpen?.();
        this.sending = true;
      };

      this.ws.onerror = (e) => {
        console.error('[AssemblyAI-Realtime] WebSocket error:', e);
        this.callbacks.onError?.(e);
      };

      this.ws.onclose = (ev) => {
        console.log('[AssemblyAI-Realtime] WebSocket closed:', ev.code, ev.reason);
        this.sending = false;
        this.callbacks.onClose?.(ev.code, ev.reason || "");
        this.cleanupAudio();
      };

      this.ws.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data as string);
          console.log('[AssemblyAI-Realtime] Received message:', data);
          
          // AssemblyAI realtime commonly returns message types with transcripts, e.g.:
          // { "message_type": "PartialTranscript", "transcript": "..." }
          // { "message_type": "FinalTranscript", "transcript": "..." }
          const t = data?.transcript;
          if (!t) return;
          
          if (data?.message_type?.toLowerCase().includes("partial")) {
            this.callbacks.onPartial?.(t);
          } else if (data?.message_type?.toLowerCase().includes("final")) {
            this.callbacks.onFinal?.(t);
          }
        } catch (err) {
          console.error('[AssemblyAI-Realtime] Error parsing message:', err);
        }
      };

      // 3) Start mic + 16k mono PCM stream
      console.log('[AssemblyAI-Realtime] Starting microphone...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.source = this.audioCtx.createMediaStreamSource(stream);

      // ScriptProcessorNode is widely supported; AudioWorklet is nicer if you prefer.
      this.processor = this.audioCtx.createScriptProcessor(4096, 1, 1);
      this.source.connect(this.processor);
      this.processor.connect(this.audioCtx.destination);

      this.processor.onaudioprocess = (e) => {
        if (!this.sending || this.ws?.readyState !== WebSocket.OPEN) return;
        
        const input = e.inputBuffer.getChannelData(0); // Float32 44.1k or 48k
        const pcm16 = this.floatToInt16(this.resampleTo16k(input, this.audioCtx!.sampleRate));
        const base64 = this.toBase64(pcm16);
        
        // Send in the structure AssemblyAI expects
        this.ws!.send(JSON.stringify({ audio_data: base64 }));
      };
      
      console.log('[AssemblyAI-Realtime] Client started successfully');
      
    } catch (err) {
      console.error('[AssemblyAI-Realtime] Start error:', err);
      this.callbacks.onError?.(err);
      this.stop();
    }
  }

  stop() {
    try {
      console.log('[AssemblyAI-Realtime] Stopping client...');
      this.sending = false;
      
      // Tell server we're done (optional but nice)
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ terminate_session: true }));
      }
      this.ws?.close();
      this.cleanupAudio();
      
      console.log('[AssemblyAI-Realtime] Client stopped');
    } catch (err) {
      console.error('[AssemblyAI-Realtime] Stop error:', err);
    }
  }

  private cleanupAudio() {
    try {
      this.processor?.disconnect();
      this.source?.disconnect();
      this.audioCtx?.close();
    } catch (err) {
      console.error('[AssemblyAI-Realtime] Audio cleanup error:', err);
    }
    this.processor = undefined;
    this.source = undefined;
    this.audioCtx = undefined;
  }

  private resampleTo16k(input: Float32Array, sampleRate: number): Float32Array {
    if (sampleRate === 16000) return input;

    const ratio = sampleRate / 16000;
    const newLen = Math.round(input.length / ratio);
    const output = new Float32Array(newLen);
    let pos = 0;
    for (let i = 0; i < newLen; i++) {
      output[i] = input[Math.floor(pos)] || 0;
      pos += ratio;
    }
    return output;
  }

  private floatToInt16(buffer: Float32Array): Int16Array {
    const out = new Int16Array(buffer.length);
    for (let i = 0; i < buffer.length; i++) {
      const s = Math.max(-1, Math.min(1, buffer[i]));
      out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return out;
  }

  private toBase64(int16: Int16Array): string {
    // Convert Int16Array -> base64 quickly
    const buf = new Uint8Array(int16.buffer);
    let bin = "";
    for (let i = 0; i < buf.byteLength; i++) bin += String.fromCharCode(buf[i]);
    return btoa(bin);
  }
}