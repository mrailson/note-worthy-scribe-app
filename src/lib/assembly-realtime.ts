// src/lib/assembly-realtime.ts
import { getAssemblyToken } from "./getAssemblyToken";

type Callbacks = {
  onOpen?: () => void;
  onPartial?: (text: string) => void;  // use for live/ongoing text (if you prefer)
  onFinal?: (text: string) => void;    // end-of-turn text
  onClose?: (code: number, reason: string) => void;
  onError?: (err: any) => void;
};

export class AssemblyRealtimeClient {
  private ws?: WebSocket;
  private audioCtx?: AudioContext;
  private source?: MediaStreamAudioSourceNode;
  private processor?: ScriptProcessorNode;
  private sending = false;
  private sampleRateTarget = 16000;

  constructor(private cb: Callbacks = {}) {}

  async start() {
    // 1) Get temp token (server → AAI /v3/token)
    const token = await getAssemblyToken();

    // 2) Open v3 websocket
    const wsUrl =
      `wss://streaming.assemblyai.com/v3/ws?sample_rate=${this.sampleRateTarget}` +
      `&token=${encodeURIComponent(token)}` +
      `&format_turns=true`; // optional nicer formatting
    this.ws = new WebSocket(wsUrl);
    this.ws.binaryType = "arraybuffer";

    this.ws.onopen = () => { this.cb.onOpen?.(); this.sending = true; };
    this.ws.onerror = (e) => this.cb.onError?.(e as any);
    this.ws.onclose = (ev) => { this.sending = false; this.cleanupAudio(); this.cb.onClose?.(ev.code, ev.reason || ""); };

    // 3) Handle v3 messages (session + turns)
    this.ws.onmessage = (evt) => {
      try {
        const data = JSON.parse(typeof evt.data === "string" ? evt.data : new TextDecoder().decode(evt.data));
        // Common shapes:
        // { type: "SessionBegins", id, expires_at }
        // { type: "Turn", text, formatted?: { text }, is_final?: boolean, ... }
        if (data?.type === "Turn") {
          const text = data?.formatted?.text ?? data?.text ?? "";
          if (!text) return;
          if (data?.is_final === false) this.cb.onPartial?.(text);
          else this.cb.onFinal?.(text);
        }
      } catch (_) {
        // Ignore non-JSON frames (shouldn't receive binary from server)
      }
    };

    // 4) Capture mic, downsample to 16 kHz PCM_s16le, send 50–1000 ms chunks
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.source = this.audioCtx.createMediaStreamSource(stream);
    this.processor = this.audioCtx.createScriptProcessor(4096, 1, 1);
    this.source.connect(this.processor);
    this.processor.connect(this.audioCtx.destination);

    // We'll accumulate ~100 ms of audio before sending (≈3200 bytes)
    let buffer16: Int16Array[] = [];
    let accLen = 0;
    const targetChunkMs = 100;
    const samplesPerChunk = Math.round(this.sampleRateTarget * (targetChunkMs / 1000)); // 1600 samples
    const bytesPerChunk = samplesPerChunk * 2; // 3200 bytes

    this.processor.onaudioprocess = (e) => {
      if (!this.sending || this.ws?.readyState !== WebSocket.OPEN) return;
      const input = e.inputBuffer.getChannelData(0); // Float32 at device rate
      const resampled = this.resampleTo16k(input, this.audioCtx!.sampleRate);
      const pcm16 = this.floatToPCM16(resampled);

      buffer16.push(pcm16);
      accLen += pcm16.byteLength;

      // Send in ~100ms slices (50–1000ms allowed by API)
      while (accLen >= bytesPerChunk) {
        const payload = this.spliceBytes(buffer16, bytesPerChunk);
        if (payload) this.ws!.send(payload.buffer); // send ArrayBuffer (binary)
        accLen -= bytesPerChunk;
      }
    };
  }

  stop() {
    try {
      this.sending = false;
      // Optional: you can also send a termination message, but closing the socket is fine
      this.ws?.close();
    } catch {}
    this.cleanupAudio();
  }

  private cleanupAudio() {
    try {
      this.processor?.disconnect();
      this.source?.disconnect();
      this.audioCtx?.close();
    } catch {}
    this.processor = undefined; this.source = undefined; this.audioCtx = undefined;
  }

  private resampleTo16k(input: Float32Array, srcRate: number): Float32Array {
    if (srcRate === this.sampleRateTarget) return input;
    const ratio = srcRate / this.sampleRateTarget;
    const newLen = Math.round(input.length / ratio);
    const out = new Float32Array(newLen);
    let pos = 0;
    for (let i = 0; i < newLen; i++) { out[i] = input[Math.floor(pos)] || 0; pos += ratio; }
    return out;
    // (If you want nicer quality, swap to a proper low-pass + resampler later.)
  }

  private floatToPCM16(f32: Float32Array): Int16Array {
    const out = new Int16Array(f32.length);
    for (let i = 0; i < f32.length; i++) {
      const s = Math.max(-1, Math.min(1, f32[i]));
      out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return out;
  }

  // spliceBytes pulls ~bytesNeeded from the accumulated Int16 chunks
  private spliceBytes(chunks: Int16Array[], bytesNeeded: number): Int16Array | null {
    const samplesNeeded = bytesNeeded / 2;
    let need = samplesNeeded;
    const toConcat: Int16Array[] = [];
    while (need > 0 && chunks.length) {
      const head = chunks[0];
      if (head.length <= need) { toConcat.push(head); chunks.shift(); need -= head.length; }
      else {
        toConcat.push(head.subarray(0, need));
        chunks[0] = head.subarray(need);
        need = 0;
      }
    }
    if (need > 0) return null;
    const total = toConcat.reduce((a, c) => a + c.length, 0);
    const out = new Int16Array(total);
    let off = 0; for (const c of toConcat) { out.set(c, off); off += c.length; }
    return out;
  }
}