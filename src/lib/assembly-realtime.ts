// src/lib/assembly-realtime.ts

/**
 * AssemblyAI real-time client used for the on-screen “Live Preview / Mic Check”.
 *
 * IMPORTANT:
 * - The browser connects ONLY to our Supabase Edge Function WebSocket proxy.
 * - The proxy connects to AssemblyAI and forwards messages back.
 * - This avoids CSP issues and keeps secrets server-side.
 */

type Callbacks = {
  /** Fired when the proxy reports the AssemblyAI session has begun and we start sending audio */
  onOpen?: () => void;
  onPartial?: (text: string) => void;
  onFinal?: (text: string) => void;
  onClose?: (code: number, reason: string) => void;
  onError?: (err: Error) => void;
};

const PROXY_WS_URL =
  "wss://dphcnbricafkbtizkoal.supabase.co/functions/v1/assemblyai-realtime";

export class AssemblyRealtimeClient {
  private ws?: WebSocket;

  private stream?: MediaStream;
  private audioCtx?: AudioContext;
  private source?: MediaStreamAudioSourceNode;
  private processor?: ScriptProcessorNode;
  private muteGain?: GainNode;

  private sending = false;
  private readonly sampleRateTarget = 16000;

  constructor(private cb: Callbacks = {}) {}

  async start() {
    console.log("🎧 AssemblyRealtimeClient: connecting to proxy", PROXY_WS_URL);

    this.ws = new WebSocket(PROXY_WS_URL);
    this.ws.binaryType = "arraybuffer";

    // Wait for proxy socket to open
    await new Promise<void>((resolve, reject) => {
      const ws = this.ws;
      if (!ws) return reject(new Error("WebSocket not initialised"));

      const onOpen = () => {
        cleanup();
        console.log("✅ AssemblyRealtimeClient: proxy WebSocket open");
        resolve();
      };
      const onError = (e: Event) => {
        cleanup();
        console.error("❌ AssemblyRealtimeClient: proxy WS error before open", e);
        reject(new Error("Failed to connect to AssemblyAI proxy"));
      };
      const onClose = (ev: CloseEvent) => {
        cleanup();
        console.error(
          "❌ AssemblyRealtimeClient: proxy WS closed before open",
          ev.code,
          ev.reason
        );
        reject(new Error(`AssemblyAI proxy closed (${ev.code})`));
      };
      const cleanup = () => {
        ws.removeEventListener("open", onOpen);
        ws.removeEventListener("error", onError);
        ws.removeEventListener("close", onClose);
      };

      ws.addEventListener("open", onOpen);
      ws.addEventListener("error", onError);
      ws.addEventListener("close", onClose);
    });

    // Wait for proxy to signal the AssemblyAI session is ready
    await new Promise<void>((resolve, reject) => {
      const ws = this.ws!;
      let resolved = false;

      const timeoutId = window.setTimeout(() => {
        if (!resolved) {
          console.error("⏰ AssemblyRealtimeClient: timed out waiting for session");
          reject(new Error("AssemblyAI session did not start in time"));
        }
      }, 10000);

      const handleMessage = (evt: MessageEvent) => {
        try {
          const raw = typeof evt.data === "string" ? evt.data : new TextDecoder().decode(evt.data);
          const data = JSON.parse(raw);

          if (data?.type === "error") {
            const msg = data?.error || "AssemblyAI error";
            console.error("❌ AssemblyRealtimeClient: proxy error", msg);
            cleanup();
            reject(new Error(msg));
            return;
          }

          if (data?.type === "session_begins" || data?.message_type === "SessionBegins") {
            console.log("✅ AssemblyRealtimeClient: session_begins received");
            resolved = true;
            cleanup();
            resolve();
            return;
          }

          // If we receive actual Turn messages before session_begins, that's also fine.
          if (data?.type === "Turn") {
            console.log("ℹ️ AssemblyRealtimeClient: received Turn before session_begins (continuing)");
          }
        } catch {
          // ignore
        }
      };

      const handleClose = (ev: CloseEvent) => {
        console.error("❌ AssemblyRealtimeClient: proxy closed while waiting for session", ev.code);
        cleanup();
        reject(new Error("AssemblyAI proxy closed"));
      };

      const handleError = () => {
        console.error("❌ AssemblyRealtimeClient: proxy error while waiting for session");
        cleanup();
        reject(new Error("AssemblyAI proxy error"));
      };

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

    // After session is ready, attach handlers for ongoing transcription
    this.ws!.onmessage = (evt) => {
      try {
        const raw = typeof evt.data === "string" ? evt.data : new TextDecoder().decode(evt.data);
        const data = JSON.parse(raw);

        if (data?.type === "error") {
          const msg = data?.error || "AssemblyAI error";
          this.cb.onError?.(new Error(msg));
          return;
        }

        // AssemblyAI v3 Turn format (via proxy)
        if (data?.type === "Turn") {
          const text = String(data?.transcript ?? data?.formatted?.text ?? data?.text ?? "").trim();
          if (!text) return;

          const isFinal = Boolean(data?.end_of_turn ?? false);
          if (isFinal) this.cb.onFinal?.(text);
          else this.cb.onPartial?.(text);
          return;
        }

        // Legacy compatibility (if any)
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
      } catch {
        // ignore non-json
      }
    };

    this.ws!.onclose = (ev) => {
      console.log("🔌 AssemblyRealtimeClient: proxy WS closed", ev.code, ev.reason);
      this.sending = false;
      this.cleanupAudio();
      this.cb.onClose?.(ev.code, ev.reason || "");
    };

    this.ws!.onerror = (e) => {
      console.error("❌ AssemblyRealtimeClient: proxy WS error", e);
      this.cb.onError?.(new Error("AssemblyAI proxy WebSocket error"));
    };

    // Start microphone capture AFTER proxy session is ready
    await this.startAudioCapture();
    this.sending = true;
    this.cb.onOpen?.();
    console.log("✅ AssemblyRealtimeClient: sending audio");
  }

  stop() {
    console.log("🛑 AssemblyRealtimeClient: stop");

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

  private async startAudioCapture() {
    console.log("🎙️ AssemblyRealtimeClient: starting mic capture");

    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.source = this.audioCtx.createMediaStreamSource(this.stream);

    // Deprecated but OK for this simple preview.
    this.processor = this.audioCtx.createScriptProcessor(4096, 1, 1);

    // Avoid feedback by routing via a muted gain node.
    this.muteGain = this.audioCtx.createGain();
    this.muteGain.gain.value = 0;

    this.source.connect(this.processor);
    this.processor.connect(this.muteGain);
    this.muteGain.connect(this.audioCtx.destination);

    const buffer16: Int16Array[] = [];
    let accLen = 0;

    const targetChunkMs = 100;
    const samplesPerChunk = Math.round(this.sampleRateTarget * (targetChunkMs / 1000));
    const bytesPerChunk = samplesPerChunk * 2;

    this.processor.onaudioprocess = (e) => {
      if (!this.sending || this.ws?.readyState !== WebSocket.OPEN) return;

      const input = e.inputBuffer.getChannelData(0);
      const resampled = this.resampleToTarget(input, this.audioCtx!.sampleRate);
      const pcm16 = this.floatToPCM16(resampled);

      buffer16.push(pcm16);
      accLen += pcm16.byteLength;

      while (accLen >= bytesPerChunk) {
        const payload = this.spliceBytes(buffer16, bytesPerChunk);
        if (payload) this.ws!.send(payload.buffer);
        accLen -= bytesPerChunk;
      }
    };

    console.log("✅ AssemblyRealtimeClient: mic capture started");
  }

  private cleanupAudio() {
    try {
      this.processor?.disconnect();
      this.source?.disconnect();
      this.muteGain?.disconnect();
      this.audioCtx?.close();
    } catch {}

    try {
      this.stream?.getTracks().forEach((t) => t.stop());
    } catch {}

    this.processor = undefined;
    this.source = undefined;
    this.muteGain = undefined;
    this.audioCtx = undefined;
    this.stream = undefined;
  }

  private resampleToTarget(input: Float32Array, srcRate: number): Float32Array {
    if (srcRate === this.sampleRateTarget) return input;
    const ratio = srcRate / this.sampleRateTarget;
    const newLen = Math.round(input.length / ratio);
    const out = new Float32Array(newLen);
    let pos = 0;
    for (let i = 0; i < newLen; i++) {
      out[i] = input[Math.floor(pos)] || 0;
      pos += ratio;
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
