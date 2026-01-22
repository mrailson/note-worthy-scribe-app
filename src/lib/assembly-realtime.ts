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
  /** Fired when attempting to reconnect after a disconnect */
  onReconnecting?: () => void;
  /** Fired when reconnection succeeds */
  onReconnected?: () => void;
};

const PROXY_WS_URL =
  "wss://dphcnbricafkbtizkoal.supabase.co/functions/v1/assemblyai-realtime";

// Edge functions timeout after ~150-400 seconds, so we need to reconnect
const RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_ATTEMPTS = 5;

export class AssemblyRealtimeClient {
  private ws?: WebSocket;

  private stream?: MediaStream;
  private externalStream?: MediaStream; // Optional external stream (e.g., combined mic+system)
  private ownsStream = true; // Whether we created the stream (and should stop it on cleanup)
  private audioCtx?: AudioContext;
  private sources: MediaStreamAudioSourceNode[] = [];
  private processor?: ScriptProcessorNode;
  private muteGain?: GainNode;

  private sending = false;
  private readonly sampleRateTarget = 16000;
  
  // Reconnection state
  private shouldReconnect = false;
  private reconnectAttempts = 0;
  private isReconnecting = false;
  private manualStop = false;

  constructor(private cb: Callbacks = {}) {}

  /**
   * Start the real-time transcription session.
   * @param externalStream Optional MediaStream to use instead of capturing mic directly.
   *                       Useful for combined mic+system audio streams.
   */
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
      
      // If this wasn't a manual stop and we should reconnect, attempt reconnection
      if (!this.manualStop && this.shouldReconnect && this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        console.log(`🔄 AssemblyRealtimeClient: will attempt reconnect (attempt ${this.reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS})`);
        this.attemptReconnect();
        return;
      }
      
      this.cleanupAudio();
      this.cb.onClose?.(ev.code, ev.reason || "");
    };

    this.ws!.onerror = (e) => {
      console.error("❌ AssemblyRealtimeClient: proxy WS error", e);
      // Don't call onError if we're going to reconnect
      if (!this.shouldReconnect || this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        this.cb.onError?.(new Error("AssemblyAI proxy WebSocket error"));
      }
    };

    // Start microphone capture AFTER proxy session is ready (only on first connect)
    if (!this.audioCtx) {
      await this.startAudioCapture();
    }
    this.sending = true;
    this.shouldReconnect = true;
    this.reconnectAttempts = 0; // Reset on successful connection
    this.isReconnecting = false;
    
    if (this.isReconnecting) {
      this.cb.onReconnected?.();
    } else {
      this.cb.onOpen?.();
    }
    console.log("✅ AssemblyRealtimeClient: sending audio");
  }

  private async attemptReconnect() {
    if (this.isReconnecting || this.manualStop) return;
    
    this.isReconnecting = true;
    this.reconnectAttempts++;
    
    console.log(`🔄 AssemblyRealtimeClient: reconnecting (attempt ${this.reconnectAttempts})...`);
    this.cb.onReconnecting?.();
    
    // Wait before reconnecting
    await new Promise(resolve => setTimeout(resolve, RECONNECT_DELAY_MS));
    
    if (this.manualStop) {
      console.log("🛑 AssemblyRealtimeClient: manual stop during reconnect, aborting");
      return;
    }
    
    try {
      // Reconnect WebSocket only (audio capture is still running)
      await this.reconnectWebSocket();
    } catch (err) {
      console.error("❌ AssemblyRealtimeClient: reconnect failed", err);
      
      if (this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS && !this.manualStop) {
        // Try again
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
    console.log("🔗 AssemblyRealtimeClient: reconnecting WebSocket...");
    
    this.ws = new WebSocket(PROXY_WS_URL);
    this.ws.binaryType = "arraybuffer";

    // Wait for proxy socket to open
    await new Promise<void>((resolve, reject) => {
      const ws = this.ws;
      if (!ws) return reject(new Error("WebSocket not initialised"));

      const onOpen = () => {
        cleanup();
        console.log("✅ AssemblyRealtimeClient: reconnect - proxy WebSocket open");
        resolve();
      };
      const onError = (e: Event) => {
        cleanup();
        reject(new Error("Failed to reconnect to AssemblyAI proxy"));
      };
      const onClose = (ev: CloseEvent) => {
        cleanup();
        reject(new Error(`AssemblyAI proxy closed during reconnect (${ev.code})`));
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

    // Wait for session to be ready
    await new Promise<void>((resolve, reject) => {
      const ws = this.ws!;
      let resolved = false;

      const timeoutId = window.setTimeout(() => {
        if (!resolved) {
          reject(new Error("AssemblyAI session did not start in time during reconnect"));
        }
      }, 10000);

      const handleMessage = (evt: MessageEvent) => {
        try {
          const raw = typeof evt.data === "string" ? evt.data : new TextDecoder().decode(evt.data);
          const data = JSON.parse(raw);

          if (data?.type === "error") {
            cleanup();
            reject(new Error(data?.error || "AssemblyAI error during reconnect"));
            return;
          }

          if (data?.type === "session_begins" || data?.message_type === "SessionBegins") {
            console.log("✅ AssemblyRealtimeClient: reconnect - session_begins received");
            resolved = true;
            cleanup();
            resolve();
            return;
          }
        } catch {}
      };

      const handleClose = (ev: CloseEvent) => {
        cleanup();
        reject(new Error("AssemblyAI proxy closed during reconnect session init"));
      };

      const handleError = () => {
        cleanup();
        reject(new Error("AssemblyAI proxy error during reconnect"));
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

    // Re-attach handlers for ongoing transcription
    this.ws!.onmessage = (evt) => {
      try {
        const raw = typeof evt.data === "string" ? evt.data : new TextDecoder().decode(evt.data);
        const data = JSON.parse(raw);

        if (data?.type === "error") {
          const msg = data?.error || "AssemblyAI error";
          this.cb.onError?.(new Error(msg));
          return;
        }

        if (data?.type === "Turn") {
          const text = String(data?.transcript ?? data?.formatted?.text ?? data?.text ?? "").trim();
          if (!text) return;

          const isFinal = Boolean(data?.end_of_turn ?? false);
          if (isFinal) this.cb.onFinal?.(text);
          else this.cb.onPartial?.(text);
          return;
        }

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
      } catch {}
    };

    this.ws!.onclose = (ev) => {
      console.log("🔌 AssemblyRealtimeClient: proxy WS closed after reconnect", ev.code, ev.reason);
      this.sending = false;
      
      if (!this.manualStop && this.shouldReconnect && this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        console.log(`🔄 AssemblyRealtimeClient: will attempt reconnect again`);
        this.isReconnecting = false;
        this.attemptReconnect();
        return;
      }
      
      this.cleanupAudio();
      this.cb.onClose?.(ev.code, ev.reason || "");
    };

    this.ws!.onerror = (e) => {
      console.error("❌ AssemblyRealtimeClient: proxy WS error after reconnect", e);
    };

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

  private async startAudioCapture() {
    // Use external stream if provided, otherwise capture mic directly
    if (this.externalStream) {
      console.log("🎙️ AssemblyRealtimeClient: using external stream (mic+system)");
      this.stream = this.externalStream;
      this.ownsStream = false; // Don't stop this stream on cleanup - it's managed externally
    } else {
      console.log("🎙️ AssemblyRealtimeClient: capturing mic directly");
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.ownsStream = true;
    }

    this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();

    // Deprecated but OK for this simple preview.
    this.processor = this.audioCtx.createScriptProcessor(4096, 1, 1);

    // Avoid feedback by routing via a muted gain node.
    this.muteGain = this.audioCtx.createGain();
    this.muteGain.gain.value = 0;
    this.processor.connect(this.muteGain);
    this.muteGain.connect(this.audioCtx.destination);

    // IMPORTANT:
    // When a MediaStream contains multiple audio tracks (e.g. screen-share system audio + mic),
    // createMediaStreamSource(stream) can effectively capture only one track depending on browser.
    // To reliably capture *all* tracks, we create one source per track and let the Web Audio graph mix them.
    const audioTracks = this.stream.getAudioTracks();
    console.log(
      `🎛️ AssemblyRealtimeClient: audio capture initialising (${audioTracks.length} audio track(s))`
    );
    for (const t of audioTracks) {
      try {
        const settings = (t.getSettings?.() ?? {}) as MediaTrackSettings;
        console.log("🎚️ AssemblyRealtimeClient: track", {
          id: t.id,
          label: t.label,
          kind: t.kind,
          enabled: t.enabled,
          muted: (t as any).muted,
          readyState: t.readyState,
          settings,
        });
      } catch {
        // ignore
      }
    }

    this.sources = [];
    if (audioTracks.length > 1) {
      console.log(
        "🧩 AssemblyRealtimeClient: multiple audio tracks detected; mixing all tracks for transcription"
      );
      for (const track of audioTracks) {
        const perTrackStream = new MediaStream([track]);
        const src = this.audioCtx.createMediaStreamSource(perTrackStream);
        src.connect(this.processor);
        this.sources.push(src);
      }
    } else {
      const src = this.audioCtx.createMediaStreamSource(this.stream);
      src.connect(this.processor);
      this.sources.push(src);
    }

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
      this.sources.forEach((s) => {
        try {
          s.disconnect();
        } catch {}
      });
      this.muteGain?.disconnect();
      this.audioCtx?.close();
    } catch {}

    // Only stop stream tracks if we created the stream ourselves
    if (this.ownsStream) {
      try {
        this.stream?.getTracks().forEach((t) => t.stop());
      } catch {}
    }

    this.processor = undefined;
    this.sources = [];
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
