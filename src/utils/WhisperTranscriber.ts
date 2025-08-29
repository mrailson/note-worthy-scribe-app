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
  private audioChunks: Blob[] = []; // Accumulate audio chunks
  private chunkTimeout: NodeJS.Timeout | null = null;

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
    
    // Accumulate chunks - MediaRecorder only puts WebM headers in first chunk!
    this.audioChunks.push(blob);
    console.log(`📦 WHISPER: Accumulated ${this.audioChunks.length} chunks, total size: ${this.audioChunks.reduce((sum, b) => sum + b.size, 0)} bytes`);
    
    // Clear existing timeout
    if (this.chunkTimeout) {
      clearTimeout(this.chunkTimeout);
    }
    
    // Set timeout to process accumulated chunks after 1 second of silence  
    this.chunkTimeout = setTimeout(() => {
      this.processAccumulatedChunks();
    }, 1000);
  }

  private async processAccumulatedChunks() {
    if (this.audioChunks.length === 0) return;
    
    console.log(`🔧 WHISPER: Processing ${this.audioChunks.length} accumulated chunks`);
    
    // Combine all chunks into a single blob with proper WebM headers
    const combinedBlob = new Blob(this.audioChunks, { type: 'audio/webm;codecs=opus' });
    console.log(`✅ WHISPER: Combined blob size: ${combinedBlob.size} bytes`);
    
    // Clear chunks
    this.audioChunks = [];
    
    // Process the combined chunk
    this.q.push({ blob: combinedBlob, meta: { combined: true } });
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
    console.log("🚀 WHISPER: Starting upload to edge function:", {
      blobSize: blob.size,
      blobType: blob.type,
      meta,
      edgeUrl: this.edgeUrl
    });

    // Convert blob to base64 like DesktopWhisperTranscriber does
    const arrayBuffer = await blob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Convert to base64 in chunks to prevent memory issues
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    const base64Audio = btoa(binary);

    console.log("📡 WHISPER: Sending base64 audio to speech-to-text function...");

    // Use the working pattern from DesktopWhisperTranscriber
    const response = await fetch(this.edgeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwaGNuYnJpY2Fma2J0aXprb2FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3MzIyMzIsImV4cCI6MjA2ODMwODIzMn0.U3bJI6P1yzgRBz_k2s0zlJGu1GWiVRTHjYgv9QQggPs'}`,
        'apikey': `${import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwaGNuYnJpY2Fma2J0aXprb2FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3MzIyMzIsImV4cCI6MjA2ODMwODIzMn0.U3bJI6P1yzgRBz_k2s0zlJGu1GWiVRTHjYgv9QQggPs'}`
      },
      body: JSON.stringify({
        audio: base64Audio,
        temperature: 0.0,
        language: "en",
        condition_on_previous_text: false
      })
    });

    console.log("📨 WHISPER: Edge function response:", {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });

    if (!response.ok) {
      const txt = await response.text().catch(() => "");
      console.error("❌ WHISPER: Edge function error:", {
        status: response.status,
        statusText: response.statusText,
        responseText: txt
      });
      throw new Error(`Edge STT ${response.status}: ${txt}`);
    }

    const payload = await response.json();
    console.log("✅ WHISPER: Successfully parsed response:", {
      hasText: !!payload.text,
      textLength: payload.text?.length || 0,
      textPreview: payload.text?.slice(0, 100)
    });
    
    // Handle speech-to-text response format (not chunked version)
    if (payload.text) {
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
    this.audioChunks = []; // Clear accumulated chunks
    if (this.chunkTimeout) {
      clearTimeout(this.chunkTimeout);
      this.chunkTimeout = null;
    }
  }
}