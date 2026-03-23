console.log("🔧 AssemblyAI client v2 loaded");
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

const RECONNECT_DELAY_MS = 5000;
const MAX_RECONNECT_ATTEMPTS = 2;

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
  private setupInProgress = false;

  // Keyterms for better recognition
  private keyterms: string[] = [];

  // Diagnostic counters
  private totalMessageCount = 0;
  private endOfTurnCount = 0;
  private partialCount = 0;
  private audioFramesSent = 0;
  private lastDiagLogTime = 0;

  // Turn-order tracking with 30s safety timer
  private currentTurnOrder: number = -1;
  private currentTurnText: string = "";
  private committedWordCount: number = 0;
  private turnCommitTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly TURN_COMMIT_TIMEOUT_MS = 30000;

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
        this.totalMessageCount++;

        if (data?.type === "error") {
          const errMsg = String(data?.error || "AssemblyAI error");
          // Proxy disconnect errors (e.g. "AssemblyAI closed (1011)") are transient —
          // let the onclose handler trigger reconnection instead of treating as fatal
          if (/closed\s*\(\d+\)/i.test(errMsg) && this.shouldReconnect) {
            console.warn(`⚠️ AssemblyAI transient proxy error: ${errMsg} — will reconnect on close`);
            return;
          }
          this.cb.onError?.(new Error(errMsg));
          return;
        }

        // Detect v3 messages by shape (no 'type' field, has 'transcript' + 'end_of_turn')
        if ('transcript' in data && 'end_of_turn' in data) {
          const text = String(data.transcript ?? "").trim();
          if (!text) return;
          this.handleTurnMessage(data, text);
          return;
        }

        // Legacy v2 compat
        if (data?.message_type === "PartialTranscript") {
          const text = String(data?.text ?? "").trim();
          if (text) { this.partialCount++; this.cb.onPartial?.(text); }
          return;
        }
        if (data?.message_type === "FinalTranscript") {
          const text = String(data?.text ?? "").trim();
          if (text) { this.endOfTurnCount++; this.cb.onFinal?.(text); }
          return;
        }
      } catch { /* ignore non-json */ }
    };

    this.ws!.onclose = (ev) => {
      console.log(`🔌 AssemblyRealtimeClient: proxy WS closed ${ev.code} ${ev.reason} (msgs: ${this.totalMessageCount}, finals: ${this.endOfTurnCount}, partials: ${this.partialCount}, audioFrames: ${this.audioFramesSent})`);
      this.sending = false;

      if (!this.manualStop && this.shouldReconnect && this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        this.attemptReconnect();
        return;
      }

      if (this.manualStop) {
        this.cleanupAudio();
      }
      this.cb.onClose?.(ev.code, ev.reason || "");
    };

    this.ws!.onerror = (e) => {
      console.error("❌ AssemblyRealtimeClient: proxy WS error", e);
      if (!this.shouldReconnect || this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        this.cb.onError?.(new Error("AssemblyAI proxy WebSocket error"));
      }
    };

    // Start audio capture only if no live AudioContext exists
    if (!this.audioCtx || this.audioCtx.state === 'closed') {
      console.log('🔄 AssemblyRealtimeClient: creating/recreating audio pipeline');
      await this.startAudioCapture();
    } else {
      // Audio pipeline still alive — just reconnect the WebSocket output
      console.log('🔄 Reusing existing AudioContext for reconnect (state:', this.audioCtx.state, ')');
    }
    this.sending = true;
    this.shouldReconnect = true;
    this.reconnectAttempts = 0;

    // Preserve reconnect flag before clearing it, so we fire the right callback
    const wasReconnecting = this.isReconnecting;
    this.isReconnecting = false;

    if (wasReconnecting) {
      this.cb.onReconnected?.();
      console.log("✅ AssemblyRealtimeClient: reconnected and sending audio via AudioWorklet");
    } else {
      this.cb.onOpen?.();
      console.log("✅ AssemblyRealtimeClient: connected and sending audio via AudioWorklet");
    }
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
        if (this.manualStop) {
          this.cleanupAudio();
        }
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
        if (data?.type === "error") {
          const errMsg = String(data?.error || "AssemblyAI error");
          if (/closed\s*\(\d+\)/i.test(errMsg) && this.shouldReconnect) {
            console.warn(`⚠️ AssemblyAI transient proxy error (reconnect): ${errMsg}`);
            return;
          }
          this.cb.onError?.(new Error(errMsg));
          return;
        }
        if ('transcript' in data && 'end_of_turn' in data) {
          const text = String(data.transcript ?? "").trim();
          if (!text) return;
          this.handleTurnMessage(data, text);
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
      if (this.manualStop) {
        this.cleanupAudio();
      }
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
    console.log(`🛑 AssemblyRealtimeClient: stop (total msgs: ${this.totalMessageCount}, finals: ${this.endOfTurnCount}, partials: ${this.partialCount}, audioFrames: ${this.audioFramesSent})`);
    this.manualStop = true;
    this.shouldReconnect = false;

    // Flush any uncommitted turn text before stopping
    if (this.currentTurnText.trim()) {
      const remaining = this.getUncommittedText(this.currentTurnText);
      if (remaining) {
        console.log(`📚 AssemblyAI: Flushing ${remaining.split(/\s+/).length} uncommitted words on stop`);
        this.cb.onFinal?.(remaining);
      }
      this.currentTurnText = "";
      this.currentTurnOrder = -1;
      this.committedWordCount = 0;
    }
    if (this.turnCommitTimer) { clearTimeout(this.turnCommitTimer); this.turnCommitTimer = null; }

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

  // ── v3 message handler with 30s safety timer ──────────────────────────

  private handleTurnMessage(data: any, text: string) {
    const turnOrder = typeof data?.turn_order === 'number' ? data.turn_order : -1;

    // If end_of_turn fires, commit only the NEW portion and reset
    if (data?.end_of_turn === true) {
      this.endOfTurnCount++;
      const newText = this.getUncommittedText(text);
      if (newText) {
        console.log(`✅ AAI final #${this.endOfTurnCount}: "${newText.substring(0, 80)}..." turn:${turnOrder}`);
        this.cb.onFinal?.(newText);
      }
      this.currentTurnText = "";
      this.currentTurnOrder = -1;
      this.committedWordCount = 0;
      if (this.turnCommitTimer) { clearTimeout(this.turnCommitTimer); this.turnCommitTimer = null; }
      return;
    }

    // Turn order changed — commit remaining text from previous turn
    if (turnOrder !== -1 && turnOrder !== this.currentTurnOrder && this.currentTurnOrder !== -1) {
      const remaining = this.getUncommittedText(this.currentTurnText);
      if (remaining) {
        this.endOfTurnCount++;
        console.log(`🔄 AAI turn change ${this.currentTurnOrder}→${turnOrder}: "${remaining.substring(0, 80)}..."`);
        this.cb.onFinal?.(remaining);
      }
      this.committedWordCount = 0;
    }

    // New turn started
    if (turnOrder !== -1 && turnOrder !== this.currentTurnOrder) {
      this.currentTurnOrder = turnOrder;
      this.committedWordCount = 0;

      // 30-second safety timer — commit accumulated NEW text, keep tracking this turn
      if (this.turnCommitTimer) clearTimeout(this.turnCommitTimer);
      this.turnCommitTimer = setTimeout(() => this.handleTimerFlush(), this.TURN_COMMIT_TIMEOUT_MS);
    }

    // v3 sends full cumulative turn text — just track it
    this.currentTurnText = text;
    this.partialCount++;
    this.cb.onPartial?.(text);
  }

  private handleTimerFlush() {
    const newText = this.getUncommittedText(this.currentTurnText);
    if (newText) {
      this.endOfTurnCount++;
      console.log(`⏰ AAI 30s timer: committing ${newText.split(/\s+/).length} new words`);
      this.cb.onFinal?.(newText);
      this.committedWordCount = this.currentTurnText.trim().split(/\s+/).length;
    }
    // Re-arm if turn is still open
    if (this.currentTurnOrder !== -1) {
      this.turnCommitTimer = setTimeout(() => this.handleTimerFlush(), this.TURN_COMMIT_TIMEOUT_MS);
    }
  }

  /**
   * Extract only the words from `fullText` that haven't been committed yet.
   * v3 sends cumulative text, so we skip the first `committedWordCount` words.
   */
  private getUncommittedText(fullText: string): string {
    if (!fullText?.trim()) return "";
    if (this.committedWordCount === 0) return fullText.trim();
    const words = fullText.trim().split(/\s+/);
    if (words.length <= this.committedWordCount) return "";
    return words.slice(this.committedWordCount).join(' ');
  }

  // ── Audio capture ──────────────────────────────────────────────────────

  private async startAudioCapture() {
    this.setupInProgress = true;
    try {
      // Validate external stream tracks are still alive
      if (this.externalStream) {
        const activeTracks = this.externalStream.getAudioTracks().filter(t => t.readyState === 'live');
        if (activeTracks.length > 0) {
          console.log("🎙️ AssemblyRealtimeClient: using external stream", activeTracks.length, "active tracks");
          this.stream = this.externalStream;
          this.ownsStream = false;
        } else {
          console.warn("⚠️ External stream tracks ended — capturing fresh mic");
          this.externalStream = undefined;
          this.stream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 }
          });
          this.ownsStream = true;
        }
      } else {
        console.log("🎙️ AssemblyRealtimeClient: capturing mic directly");
        this.stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 }
        });
        this.ownsStream = true;
      }

      // Create AudioContext at browser default rate (typically 48 kHz).
      // The AudioWorklet resamples to 16 kHz internally.
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      await this.audioCtx.resume();
      const srcRate = this.audioCtx.sampleRate;
      console.log(`🎛️ AssemblyRealtimeClient: AudioContext @ ${srcRate}Hz (state: ${this.audioCtx.state}), resampling to ${this.sampleRateTarget}Hz`);

      const src = this.audioCtx.createMediaStreamSource(this.stream);
      this.sources = [src];

      // Try AudioWorklet first, fall back to ScriptProcessorNode
      const useWorklet = await this.tryAudioWorklet(src);
      if (!useWorklet) {
        if (this.audioCtx) {
          console.log("⚠️ AudioWorklet unavailable — falling back to ScriptProcessorNode");
          this.startScriptProcessorFallback(src);
        } else {
          console.error("❌ AudioContext destroyed — cannot start fallback");
          this.cb.onError?.(new Error("Audio capture failed: no AudioContext"));
        }
      }
    } finally {
      this.setupInProgress = false;
    }
  }

  /**
   * AudioWorklet path — preferred.
   * The worklet handles resampling (linear interpolation) and float32→int16 conversion
   * on the audio thread, sending raw PCM16 buffers to the main thread.
   */
  private async tryAudioWorklet(src: MediaStreamAudioSourceNode): Promise<boolean> {
    if (!this.audioCtx) {
      console.warn("⚠️ tryAudioWorklet: audioCtx is null, skipping");
      return false;
    }
    try {
      await this.audioCtx.audioWorklet.addModule('/worklets/pcm16-writer.js');
      console.log("✅ PCM16 worklet registered, AudioContext sampleRate:", this.audioCtx.sampleRate, "Hz");
      this.worklet = new AudioWorkletNode(this.audioCtx, 'pcm16-writer');

      // Accumulate PCM16 data and send in ~100ms chunks
      const buffer16: Int16Array[] = [];
      let accLen = 0;
      const samplesPerChunk = Math.round(this.sampleRateTarget * 0.1); // 100ms
      const bytesPerChunk = samplesPerChunk * 2;

      this.worklet.port.onmessage = (e) => {
        if (!this.sending || this.ws?.readyState !== WebSocket.OPEN) return;

        const pcm16 = new Int16Array(e.data as ArrayBuffer);

        // First-frame diagnostic to verify audio pipeline health
        if (this.audioFramesSent === 0) {
          const slice = Array.from(pcm16.slice(0, 100));
          const min = Math.min(...slice);
          const max = Math.max(...slice);
          const nonZero = slice.filter(v => v !== 0).length;
          console.log(`🔍 First PCM16 frame: ${pcm16.length} samples, range [${min}..${max}], ${nonZero}/100 non-zero in first 100 samples`);
        }

        buffer16.push(pcm16);
        accLen += pcm16.byteLength;

        while (accLen >= bytesPerChunk) {
          const payload = this.spliceBytes(buffer16, bytesPerChunk);
          if (payload) {
            this.ws!.send(payload.buffer as ArrayBuffer);
            this.audioFramesSent++;
            // Log every 100th frame for diagnostics
            if (this.audioFramesSent % 100 === 0) {
              const now = Date.now();
              const elapsed = this.lastDiagLogTime ? (now - this.lastDiagLogTime) / 1000 : 0;
              this.lastDiagLogTime = now;
              console.log(`📡 AssemblyAI audio: sent frame #${this.audioFramesSent}, ${payload.byteLength} bytes` +
                (elapsed ? `, ${elapsed.toFixed(1)}s since last log` : '') +
                `, msgs back: ${this.totalMessageCount} (${this.endOfTurnCount} finals, ${this.partialCount} partials)`);
            }
          }
          accLen -= bytesPerChunk;
        }
      };

      // Connect source → worklet → muted destination (needed for worklet to process)
      this.muteGain = this.audioCtx.createGain();
      this.muteGain.gain.value = 0;
      src.connect(this.worklet);
      this.worklet.connect(this.muteGain);
      this.muteGain.connect(this.audioCtx.destination);

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
        if (payload) {
          this.ws!.send(payload.buffer as ArrayBuffer);
          this.audioFramesSent++;
        }
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
