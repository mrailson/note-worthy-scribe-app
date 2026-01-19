// src/lib/assembly-realtime-worklet.ts
// Optional AudioWorklet-based implementation to replace deprecated ScriptProcessorNode
import { getAssemblyToken } from "./getAssemblyToken";

type Callbacks = {
  onOpen?: () => void;
  onPartial?: (text: string) => void;
  onFinal?: (text: string) => void;
  onClose?: (code: number, reason: string) => void;
  onError?: (err: any) => void;
};

export class AssemblyRealtimeClientWorklet {
  private ws?: WebSocket;
  private audioCtx?: AudioContext;
  private source?: MediaStreamAudioSourceNode;
  private worklet?: AudioWorkletNode;
  private sending = false;
  private sampleRateTarget = 16000;

  constructor(private cb: Callbacks = {}) {}

  async start() {
    const token = await getAssemblyToken();

    // Open v3 websocket with OTEWELL verbatim settings
    const wsUrl =
      `wss://streaming.assemblyai.com/v3/ws?sample_rate=${this.sampleRateTarget}` +
      `&token=${encodeURIComponent(token)}` +
      `&format_turns=true` +
      `&punctuate=false` +      // OTEWELL: verbatim capture
      `&format_text=false`;     // OTEWELL: no text cleanup
    this.ws = new WebSocket(wsUrl);
    this.ws.binaryType = "arraybuffer";

    this.ws.onopen = () => { this.cb.onOpen?.(); this.sending = true; };
    this.ws.onerror = (e) => this.cb.onError?.(e as any);
    this.ws.onclose = (ev) => { this.sending = false; this.cleanupAudio(); this.cb.onClose?.(ev.code, ev.reason || ""); };

    // Handle v3 messages
    this.ws.onmessage = (evt) => {
      try {
        const data = JSON.parse(typeof evt.data === "string" ? evt.data : new TextDecoder().decode(evt.data));
        if (data?.type === "Turn") {
          const text = data?.formatted?.text ?? data?.text ?? "";
          if (!text) return;
          if (data?.is_final === false) this.cb.onPartial?.(text);
          else this.cb.onFinal?.(text);
        }
      } catch (_) {
        // Ignore non-JSON frames
      }
    };

    // Setup AudioWorklet
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Load AudioWorklet module
    await this.audioCtx.audioWorklet.addModule('/worklets/pcm16-writer.js');
    
    this.source = this.audioCtx.createMediaStreamSource(stream);
    this.worklet = new AudioWorkletNode(this.audioCtx, 'pcm16-writer');
    
    // Accumulate PCM data and send in chunks
    let buffer16: Int16Array[] = [];
    let accLen = 0;
    const targetChunkMs = 100;
    const samplesPerChunk = Math.round(this.sampleRateTarget * (targetChunkMs / 1000));
    const bytesPerChunk = samplesPerChunk * 2;

    this.worklet.port.onmessage = (e) => {
      if (!this.sending || this.ws?.readyState !== WebSocket.OPEN) return;
      
      const pcm16 = new Int16Array(e.data as ArrayBuffer);
      buffer16.push(pcm16);
      accLen += pcm16.byteLength;

      // Send in ~100ms chunks
      while (accLen >= bytesPerChunk) {
        const payload = this.spliceBytes(buffer16, bytesPerChunk);
        if (payload) this.ws!.send(payload.buffer);
        accLen -= bytesPerChunk;
      }
    };

    this.source.connect(this.worklet).connect(this.audioCtx.destination);
  }

  stop() {
    try {
      this.sending = false;
      this.ws?.close();
    } catch {}
    this.cleanupAudio();
  }

  private cleanupAudio() {
    try {
      this.worklet?.disconnect();
      this.source?.disconnect();
      this.audioCtx?.close();
    } catch {}
    this.worklet = undefined;
    this.source = undefined;
    this.audioCtx = undefined;
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