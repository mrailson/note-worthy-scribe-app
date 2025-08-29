// ============= v9-iterative-no-supabase WhisperTranscriber =============
const WHISPER_IMPL_VERSION = 'v9-iterative-no-supabase';
const USE_DIRECT_FETCH = true; // force

export interface TranscriptData {
  text: string;
  is_final: boolean;
  confidence: number;
  start?: number;
  end?: number;
  speaker?: string;
}

export class WhisperTranscriber {
  private q: Array<{ blob: Blob, meta: any }> = [];
  private isDraining = false;
  private edgeUrl: string;
  private onPayload: (p: any) => void;
  private onError: (e: any) => void;
  private onStatusChange?: (status: string) => void;
  private useSupabaseClient = false;
  private accumulatedText = ''; // Add text accumulation

  constructor(edgeUrl: string, onPayload: (p: any) => void, onError: (e: any) => void, onStatusChange?: (status: string) => void) {
    if (!edgeUrl) throw new Error("WhisperTranscriber: edgeUrl required");
    this.edgeUrl = edgeUrl;
    this.onPayload = onPayload;
    this.onError = onError;
    this.onStatusChange = onStatusChange;

    // Kill any old Supabase path
    (this as any).supabaseClient = null;
    this.useSupabaseClient = false; // guard any legacy checks
    console.info("WHISPER IMPL v9: direct fetch only ->", this.edgeUrl);
    
    console.info("WHISPER CONFIG:", {
      useDirectFetch: USE_DIRECT_FETCH,
      edgeUrl: this.edgeUrl,
      hasSupabaseClient: !!(this as any).supabaseClient,
    });
  }

  /** Call from MediaRecorder.ondataavailable */
  enqueueChunk(blob: Blob, meta?: any) {
    if (!blob || !blob.size) return;
    console.debug("[Whisper] enqueueChunk", { size: blob.size, ...meta });
    this.q.push({ blob, meta });
    if (!this.isDraining) this.drainQueue();
  }

  private async drainQueue() {
    if (this.isDraining) return;
    this.isDraining = true;
    console.debug("[Whisper] drainQueue start; q=", this.q.length);

    try {
      while (this.q.length > 0) {
        const item = this.q.shift()!;
        await this.uploadWithRetry(item.blob, item.meta);
      }
    } catch (e) {
      this.onError?.(e);
      console.error("WHISPER: Queue processing error:", e);
    } finally {
      this.isDraining = false;
    }
  }

  private async uploadWithRetry(blob: Blob, meta?: any) {
    const backoff = [250, 600, 1200];
    let err: any;

    for (let i = 0; i < backoff.length; i++) {
      try {
        await this.uploadOnce(blob, meta);
        return;
      } catch (e) {
        err = e;
        console.warn(`Upload attempt ${i+1}/${backoff.length} failed, retrying in ${backoff[i]}ms:`, e);
        await new Promise(r => setTimeout(r, backoff[i]));
      }
    }
    throw err ?? new Error("Upload failed after retries");
  }

  private async uploadOnce(blob: Blob, meta?: any) {
    if (!USE_DIRECT_FETCH) throw new Error("Direct fetch disabled unexpectedly");

    console.log("🚀 WHISPER: Starting upload to edge function:", {
      blobSize: blob.size,
      blobType: blob.type,
      meta,
      edgeUrl: this.edgeUrl
    });

    const fd = new FormData();
    fd.append("audio", blob, `chunk-${Date.now()}.webm`);
    fd.append("response_format", "verbose_json");
    fd.append("language", "en");

    console.log("📡 WHISPER: Sending request to edge function...");

    const res = await fetch(this.edgeUrl, {
      method: "POST",
      body: fd,
      headers: { "x-client": "meetingmagic-web" },
    });

    console.log("📨 WHISPER: Edge function response:", {
      status: res.status,
      statusText: res.statusText,
      ok: res.ok,
      headers: Object.fromEntries(res.headers.entries())
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.error("❌ WHISPER: Edge function error:", {
        status: res.status,
        statusText: res.statusText,
        responseText: txt
      });
      throw new Error(`Edge STT ${res.status}: ${txt}`);
    }

    const payload = await res.json();
    console.log("✅ WHISPER: Successfully parsed response:", {
      hasSuccess: 'success' in payload,
      success: payload.success,
      hasTranscript: payload?.transcript ? true : false,
      textLength: payload?.transcript?.length || 0,
      textPreview: payload?.transcript?.slice(0, 100)
    });
    
    // Convert edge function response to expected format and accumulate text
    if (payload.success !== false && payload.transcript) {
      this.accumulatedText += (this.accumulatedText ? ' ' : '') + payload.transcript;
      const convertedPayload = {
        ok: true,
        data: {
          text: this.accumulatedText,
          segments: []
        }
      };
      this.onPayload?.(convertedPayload);
    } else if (payload.text) {
      // Handle speech-to-text-chunked format
      this.accumulatedText += (this.accumulatedText ? ' ' : '') + payload.text;
      const convertedPayload = {
        ok: true,
        data: {
          text: this.accumulatedText,
          segments: []
        }
      };
      this.onPayload?.(convertedPayload);
    } else {
      console.error("❌ WHISPER: Invalid response format:", payload);
      this.onError?.(new Error(payload.error || 'Invalid response format'));
    }
  }

  // Back-compat shims for old call sites:
  processChunk(blob: Blob, meta?: any) { 
    this.enqueueChunk(blob, meta); 
  }
  processChunkWithRetry(blob: Blob, meta?: any) { 
    this.enqueueChunk(blob, meta); 
  }

  // Placeholder methods for interface compatibility
  startTranscription() { 
    console.log('🎙️ WhisperTranscriber startTranscription - use external MediaRecorder');
  }
  
  stopTranscription() { 
    console.log('🛑 WhisperTranscriber stopTranscription - clearing queue');
    this.q = []; // Clear any pending uploads
    this.isDraining = false;
  }
  
  isActive() { 
    return this.isDraining || this.q.length > 0; 
  }
  
  clearSummary() { 
    this.q = []; // Clear the queue
    this.isDraining = false;
    this.accumulatedText = ''; // Reset accumulated text
  }
}