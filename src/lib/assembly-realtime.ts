// src/lib/assembly-realtime.ts

/**
 * AssemblyAI real-time client — AudioWorklet pipeline with PCM16 @ 16 kHz.
 *
 * - Connects via our Supabase Edge Function WebSocket proxy.
 * - Uses AudioWorklet (with ScriptProcessorNode fallback) for low-latency
 *   float32 → int16 PCM conversion.
 * - Sends raw PCM16 binary frames (not base64, not compressed audio).
 * - Supports keyterms for better proper-noun recognition.
 */

type Callbacks = {
  onOpen?: () => void;
  onPartial?: (text: string) => void;
  onFinal?: (text: string) => void;
  onClose?: (code: number, reason: string) => void;
  onError?: (err: Error) => void;
  onReconnecting?: () => void;
  onReconnected?: () => void;
};

const PROXY_WS_URL =
  "wss://dphcnbricafkbtizkoal.supabase.co/functions/v1/assemblyai-realtime";

const RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_ATTEMPTS = 5;

export class AssemblyRealtimeClient {
  private ws?: WebSocket;

  private stream?: MediaStream;
  private externalStream?: MediaStream;
  private ownsStream = true;
  private audioCtx?: AudioContext;
  private sources: MediaStreamAudioSourceNode[] = [];
  // AudioWorklet path
  private worklet?: AudioWorkletNode;
  // ScriptProcessorNode fallback
  private processor?: ScriptProcessorNode;
  private muteGain?: GainNode;

  private sending = false;
  private readonly sampleRateTarget = 16000;

  // Reconnection state
  private shouldReconnect = false;
  private reconnectAttempts = 0;
  private isReconnecting = false;
  private manualStop = false;

  // Keyterms for better recognition
  private keyterms: string[] = [];

  constructor(private cb: Callbacks = {}) {}

  /** Set keyterms before calling start(). */
  setKeyterms(terms: string[]) {
    this.keyterms = terms
      .filter(t => t.length > 0 && t.length <= 50)
      .slice(0, 100);
  }

  async start(externalStream?: MediaStream) {
    this.externalStream = externalStream;
    console.log("🎧 AssemblyRealtimeClient: connecting to proxy", PROXY_WS_URL,
      externalStream ? "(using external stream)" : "(capturing mic)");

    this.ws = new WebSocket(PROXY_WS_URL);
    this.ws.binaryType = "arraybuffer";

    // Wait for proxy socket to open
    await new Promise<void>((resolve, reject) => {
      const ws = this.ws;
      if (!ws) return reject(new Error("WebSocket not initialised"));

      const onOpen = () => { cleanup(); resolve(); };
      const onError = (e: Event) => { cleanup(); reject(new Error("Failed to connect to AssemblyAI proxy")); };
      const onClose = (ev: CloseEvent) => { cleanup(); reject(new Error(`AssemblyAI proxy closed (${ev.code})`)); };
      const cleanup = () => {
        ws.removeEventListener("open", onOpen);
        ws.removeEventListener("error", onError);
        ws.removeEventListener("close", onClose);
      };
      ws.addEventListener("open", onOpen);
      ws.addEventListener("error", onError);
      ws.addEventListener("close", onClose);
    });

    // Send keyterms to proxy before session init
    if (this.keyterms.length > 0) {
      console.log(`🔑 Sending ${this.keyterms.length} keyterms to proxy`);
      this.ws!.send(JSON.stringify({ type: "configure", keyterms: this.keyterms }));
    }

    // Wait for proxy to signal session ready
    await new Promise<void>((resolve, reject) => {
      const ws = this.ws!;
      let resolved = false;

      const timeoutId = window.setTimeout(() => {
        if (!resolved) reject(new Error("AssemblyAI session did not start in time"));
      }, 15000);

      const handleMessage = (evt: MessageEvent) => {
        try {
          const raw = typeof evt.data === "string" ? evt.data : new TextDecoder().decode(evt.data);
          const data = JSON.parse(raw);

          if (data?.type === "error") {
            cleanup();
            reject(new Error(data?.error || "AssemblyAI error"));
            return;
          }

          if (data?.type === "session_begins" || data?.message_type === "SessionBegins") {
            console.log("✅ AssemblyRealtimeClient: session_begins received");
            resolved = true;
            cleanup();
            resolve();
            return;
          }

          if (data?.type === "Turn") {
            console.log("ℹ️ AssemblyRealtimeClient: received Turn before session_begins (continuing)");
          }
        } catch { /* ignore */ }
      };

      const handleClose = (ev: CloseEvent) => { cleanup(); reject(new Error("AssemblyAI proxy closed")); };
      const handleError = () => { cleanup(); reject(new Error("AssemblyAI proxy error")); };

      const cleanup = () => {
        window.clearTimeout(timeoutId);
        ws.removeEventListener("message", handleMessage);
        ws.removeEventListener("close", handleClose);
        ws.removeEventListener("error", handleError);
      };

      ws.addEventListener("message", handleMessage);
      ws.addEventListener("close", handleClose);
      ws.addEventListener("error", handleError);
    });

    // Attach ongoing transcription handlers
    this.ws!.onmessage = (evt) => {
      try {
        const raw = typeof evt.data === "string" ? evt.data : new TextDecoder().decode(evt.data);
        const data = JSON.parse(raw);

        if (data?.type === "error") {
          this.cb.onError?.(new Error(data?.error || "AssemblyAI error"));
          return;
        }

        // v3 turn messages (no `type` field — detect by shape)
        if ('turn_order' in data || ('transcript' in data && 'end_of_turn' in data)) {
          const text = String(data?.transcript ?? "").trim();
          if (!text) return;
          if (data?.turn_is_formatted) {
            this.cb.onFinal?.(text);
          } else if (data?.end_of_turn) {
            return; // skip unformatted end-of-turn, formatted version follows
          } else {
            this.cb.onPartial?.(text);
          }
          return;
        }

        // Legacy v2 compat
        if (data?.message_type === "PartialTranscript") {
          const text = String(data?.text ?? "").trim();
          if (text) this.cb.onPartial?.(text);
          return;
        }
        if (data?.message_type === "FinalTranscript") {
          const text = String(data?.text ?? "").trim();
          if (text) this.cb.onFinal?.(text);
          return;
        }
      } catch { /* ignore non-json */ }
    };

    this.ws!.onclose = (ev) => {
      console.log("🔌 AssemblyRealtimeClient: proxy WS closed", ev.code, ev.reason);
      this.sending = false;

      if (!this.manualStop && this.shouldReconnect && this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        this.attemptReconnect();
        return;
      }

      this.cleanupAudio();
      this.cb.onClose?.(ev.code, ev.reason || "");
    };

    this.ws!.onerror = (e) => {
      console.error("❌ AssemblyRealtimeClient: proxy WS error", e);
      if (!this.shouldReconnect || this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        this.cb.onError?.(new Error("AssemblyAI proxy WebSocket error"));
      }
    };

    // Start audio capture (only on first connect, not on reconnect)
    if (!this.audioCtx) {
      await this.startAudioCapture();
    }
    this.sending = true;
    this.shouldReconnect = true;
    this.reconnectAttempts = 0;
    this.isReconnecting = false;

    if (this.isReconnecting) {
      this.cb.onReconnected?.();
    } else {
      this.cb.onOpen?.();
    }
    console.log("✅ AssemblyRealtimeClient: sending audio via AudioWorklet");
  }

  private async attemptReconnect() {
    if (this.isReconnecting || this.manualStop) return;

    this.isReconnecting = true;
    this.reconnectAttempts++;

    console.log(`🔄 AssemblyRealtimeClient: reconnecting (attempt ${this.reconnectAttempts})...`);
    this.cb.onReconnecting?.();

    await new Promise(resolve => setTimeout(resolve, RECONNECT_DELAY_MS));

    if (this.manualStop) return;

    try {
      await this.reconnectWebSocket();
    } catch (err) {
      console.error("❌ AssemblyRealtimeClient: reconnect failed", err);

      if (this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS && !this.manualStop) {
        this.isReconnecting = false;
        this.attemptReconnect();
      } else {
        this.isReconnecting = false;
        this.cleanupAudio();
        this.cb.onError?.(new Error(`Failed to reconnect after ${MAX_RECONNECT_ATTEMPTS} attempts`));
      }
    }
  }

  private async reconnectWebSocket() {
    this.ws = new WebSocket(PROXY_WS_URL);
    this.ws.binaryType = "arraybuffer";

    await new Promise<void>((resolve, reject) => {
      const ws = this.ws;
      if (!ws) return reject(new Error("WebSocket not initialised"));
      const onOpen = () => { cleanup(); resolve(); };
      const onError = () => { cleanup(); reject(new Error("Failed to reconnect to AssemblyAI proxy")); };
      const onClose = (ev: CloseEvent) => { cleanup(); reject(new Error(`Proxy closed during reconnect (${ev.code})`)); };
      const cleanup = () => {
        ws.removeEventListener("open", onOpen);
        ws.removeEventListener("error", onError);
        ws.removeEventListener("close", onClose);
      };
      ws.addEventListener("open", onOpen);
      ws.addEventListener("error", onError);
      ws.addEventListener("close", onClose);
    });

    // Re-send keyterms on reconnect
    if (this.keyterms.length > 0) {
      this.ws!.send(JSON.stringify({ type: "configure", keyterms: this.keyterms }));
    }

    await new Promise<void>((resolve, reject) => {
      const ws = this.ws!;
      let resolved = false;

      const timeoutId = window.setTimeout(() => {
        if (!resolved) reject(new Error("Session did not start in time during reconnect"));
      }, 15000);

      const handleMessage = (evt: MessageEvent) => {
        try {
          const raw = typeof evt.data === "string" ? evt.data : new TextDecoder().decode(evt.data);
          const data = JSON.parse(raw);
          if (data?.type === "error") { cleanup(); reject(new Error(data?.error || "AssemblyAI error")); return; }
          if (data?.type === "session_begins" || data?.message_type === "SessionBegins") {
            resolved = true; cleanup(); resolve(); return;
          }
        } catch { /* ignore */ }
      };
      const handleClose = () => { cleanup(); reject(new Error("Proxy closed during reconnect init")); };
      const handleError = () => { cleanup(); reject(new Error("Proxy error during reconnect")); };
      const cleanup = () => {
        window.clearTimeout(timeoutId);
        ws.removeEventListener("message", handleMessage);
        ws.removeEventListener("close", handleClose);
        ws.removeEventListener("error", handleError);
      };
      ws.addEventListener("message", handleMessage);
      ws.addEventListener("close", handleClose);
      ws.addEventListener("error", handleError);
    });

    // Re-attach transcription handlers
    this.ws!.onmessage = (evt) => {
      try {
        const raw = typeof evt.data === "string" ? evt.data : new TextDecoder().decode(evt.data);
        const data = JSON.parse(raw);
        if (data?.type === "error") { this.cb.onError?.(new Error(data?.error || "AssemblyAI error")); return; }
        if ('turn_order' in data || ('transcript' in data && 'end_of_turn' in data)) {
          const text = String(data?.transcript ?? "").trim();
          if (!text) return;
          if (data?.turn_is_formatted) {
            this.cb.onFinal?.(text);
          } else if (data?.end_of_turn) {
            return;
          } else {
            this.cb.onPartial?.(text);
          }
          return;
        }
        if (data?.message_type === "PartialTranscript") { const t = String(data?.text ?? "").trim(); if (t) this.cb.onPartial?.(t); return; }
        if (data?.message_type === "FinalTranscript") { const t = String(data?.text ?? "").trim(); if (t) this.cb.onFinal?.(t); return; }
      } catch { /* ignore */ }
    };

    this.ws!.onclose = (ev) => {
      this.sending = false;
      if (!this.manualStop && this.shouldReconnect && this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        this.isReconnecting = false;
        this.attemptReconnect();
        return;
      }
      this.cleanupAudio();
      this.cb.onClose?.(ev.code, ev.reason || "");
    };

    this.ws!.onerror = () => { /* reconnect handler above will fire */ };

    this.sending = true;
    this.isReconnecting = false;
    this.reconnectAttempts = 0;
    this.cb.onReconnected?.();
    console.log("✅ AssemblyRealtimeClient: reconnected and sending audio");
  }

  stop() {
    console.log("🛑 AssemblyRealtimeClient: stop");
    this.manualStop = true;
    this.shouldReconnect = false;

    try {
      this.sending = false;
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "terminate" }));
      }
      this.ws?.close();
    } catch (err) {
      console.warn("⚠️ AssemblyRealtimeClient: stop error", err);
    }

    this.cleanupAudio();
  }

  // ── Audio capture ──────────────────────────────────────────────────────

  private async startAudioCapture() {
    if (this.externalStream) {
      console.log("🎙️ AssemblyRealtimeClient: using external stream");
      this.stream = this.externalStream;
      this.ownsStream = false;
    } else {
      console.log("🎙️ AssemblyRealtimeClient: capturing mic directly");
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          channelCount: 1,
        }
      });
      this.ownsStream = true;
    }

    // Create AudioContext at browser default rate (typically 48 kHz).
    // The AudioWorklet resamples to 16 kHz internally.
    this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const srcRate = this.audioCtx.sampleRate;
    console.log(`🎛️ AssemblyRealtimeClient: AudioContext @ ${srcRate}Hz`);

    const src = this.audioCtx.createMediaStreamSource(this.stream);
    this.sources = [src];

    // Try AudioWorklet first, fall back to ScriptProcessorNode
    const useWorklet = await this.tryAudioWorklet(src);
    if (!useWorklet) {
      console.log("⚠️ AudioWorklet unavailable — falling back to ScriptProcessorNode");
      this.startScriptProcessorFallback(src);
    }
  }

  /**
   * AudioWorklet path — preferred.
   * The worklet handles resampling (linear interpolation) and float32→int16 conversion
   * on the audio thread, sending raw PCM16 buffers to the main thread.
   */
  private async tryAudioWorklet(src: MediaStreamAudioSourceNode): Promise<boolean> {
    try {
      await this.audioCtx!.audioWorklet.addModule('/worklets/pcm16-writer.js');
      this.worklet = new AudioWorkletNode(this.audioCtx!, 'pcm16-writer');

      // Accumulate PCM16 data and send in ~100ms chunks
      const buffer16: Int16Array[] = [];
      let accLen = 0;
      const samplesPerChunk = Math.round(this.sampleRateTarget * 0.1); // 100ms
      const bytesPerChunk = samplesPerChunk * 2;

      this.worklet.port.onmessage = (e) => {
        if (!this.sending || this.ws?.readyState !== WebSocket.OPEN) return;

        const pcm16 = new Int16Array(e.data as ArrayBuffer);
        buffer16.push(pcm16);
        accLen += pcm16.byteLength;

        while (accLen >= bytesPerChunk) {
          const payload = this.spliceBytes(buffer16, bytesPerChunk);
          if (payload) this.ws!.send(payload.buffer as ArrayBuffer);
          accLen -= bytesPerChunk;
        }
      };

      // Connect source → worklet → muted destination (needed for worklet to process)
      this.muteGain = this.audioCtx!.createGain();
      this.muteGain.gain.value = 0;
      src.connect(this.worklet);
      this.worklet.connect(this.muteGain);
      this.muteGain.connect(this.audioCtx!.destination);

      console.log("✅ AssemblyRealtimeClient: AudioWorklet pipeline active");
      return true;
    } catch (err) {
      console.warn("AudioWorklet setup failed:", err);
      return false;
    }
  }

  /**
   * ScriptProcessorNode fallback — deprecated but widely supported.
   */
  private startScriptProcessorFallback(src: MediaStreamAudioSourceNode) {
    this.processor = this.audioCtx!.createScriptProcessor(4096, 1, 1);

    this.muteGain = this.audioCtx!.createGain();
    this.muteGain.gain.value = 0;
    this.processor.connect(this.muteGain);
    this.muteGain.connect(this.audioCtx!.destination);

    src.connect(this.processor);

    const buffer16: Int16Array[] = [];
    let accLen = 0;
    const samplesPerChunk = Math.round(this.sampleRateTarget * 0.1);
    const bytesPerChunk = samplesPerChunk * 2;

    this.processor.onaudioprocess = (e) => {
      if (!this.sending || this.ws?.readyState !== WebSocket.OPEN) return;

      const input = e.inputBuffer.getChannelData(0);
      const resampled = this.resampleLinear(input, this.audioCtx!.sampleRate);
      const pcm16 = this.floatToPCM16(resampled);

      buffer16.push(pcm16);
      accLen += pcm16.byteLength;

      while (accLen >= bytesPerChunk) {
        const payload = this.spliceBytes(buffer16, bytesPerChunk);
        if (payload) this.ws!.send(payload.buffer as ArrayBuffer);
        accLen -= bytesPerChunk;
      }
    };

    console.log("✅ AssemblyRealtimeClient: ScriptProcessorNode fallback active");
  }

  private cleanupAudio() {
    try {
      this.worklet?.disconnect();
      this.processor?.disconnect();
      this.sources.forEach(s => { try { s.disconnect(); } catch {} });
      this.muteGain?.disconnect();
      this.audioCtx?.close();
    } catch {}

    if (this.ownsStream) {
      try { this.stream?.getTracks().forEach(t => t.stop()); } catch {}
    }

    this.worklet = undefined;
    this.processor = undefined;
    this.sources = [];
    this.muteGain = undefined;
    this.audioCtx = undefined;
    this.stream = undefined;
  }

  // ── Audio helpers ──────────────────────────────────────────────────────

  /** Linear-interpolation resample (for ScriptProcessorNode fallback) */
  private resampleLinear(input: Float32Array, srcRate: number): Float32Array {
    if (srcRate === this.sampleRateTarget) return input;
    const ratio = srcRate / this.sampleRateTarget;
    const newLen = Math.floor(input.length / ratio);
    const out = new Float32Array(newLen);
    for (let i = 0; i < newLen; i++) {
      const srcIdx = i * ratio;
      const idx0 = Math.floor(srcIdx);
      const idx1 = Math.min(idx0 + 1, input.length - 1);
      const frac = srcIdx - idx0;
      out[i] = input[idx0] * (1 - frac) + input[idx1] * frac;
    }
    return out;
  }

  private floatToPCM16(f32: Float32Array): Int16Array {
    const out = new Int16Array(f32.length);
    for (let i = 0; i < f32.length; i++) {
      const s = Math.max(-1, Math.min(1, f32[i]));
      out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return out;
  }

  private spliceBytes(chunks: Int16Array[], bytesNeeded: number): Int16Array | null {
    const samplesNeeded = bytesNeeded / 2;
    let need = samplesNeeded;
    const toConcat: Int16Array[] = [];

    while (need > 0 && chunks.length) {
      const head = chunks[0];
      if (head.length <= need) {
        toConcat.push(head);
        chunks.shift();
        need -= head.length;
      } else {
        toConcat.push(head.subarray(0, need));
        chunks[0] = head.subarray(need);
        need = 0;
      }
    }

    if (need > 0) return null;

    const total = toConcat.reduce((a, c) => a + c.length, 0);
    const out = new Int16Array(total);
    let off = 0;
    for (const c of toConcat) {
      out.set(c, off);
      off += c.length;
    }
    return out;
  }
}
