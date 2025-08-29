// ============= v9-iterative-no-supabase WhisperTranscriber =============
const WHISPER_IMPL_VERSION = 'v9-iterative-no-supabase';

export interface TranscriptData {
  text: string;
  is_final: boolean;
  confidence: number;
  start?: number;
  end?: number;
  speaker?: string;
}

// === Non-recursive retry-safe networking + queue ===
const BACKOFF_MS = [250, 600, 1200];
const MAX_ATTEMPTS = 3;

type UploadItem = { blob: Blob; meta?: { chunkIndex?: number } };

export class WhisperTranscriber {
  private queue: UploadItem[] = [];
  private processing = false;

  constructor(
    private uploadUrl: string,
    private onTranscription: (payload: any) => void,
    private onError: (err: Error) => void
  ) {
    console.info('WHISPER IMPL', WHISPER_IMPL_VERSION, 'url=', this.uploadUrl);
  }

  /** Call from MediaRecorder.ondataavailable */
  enqueueChunk(blob: Blob, meta?: { chunkIndex?: number }) {
    if (!blob || !blob.size) return;
    this.queue.push({ blob, meta });
    this.drainQueue().catch(e => this.onError(e));
  }


  private async drainQueue() {
    if (this.processing) return;
    this.processing = true;
    try {
      while (this.queue.length) {
        const item = this.queue.shift()!;
        const res = await this.uploadWithRetry(() => this.uploadOnce(item));
        // IMPORTANT: onTranscription must not call enqueue/process again
        this.onTranscription(res);
      }
    } finally {
      this.processing = false;
    }
  }

  private async uploadWithRetry(doUpload: () => Promise<any>) {
    let lastErr: any;
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      try {
        return await doUpload();
      } catch (e) {
        lastErr = e;
        if (i < MAX_ATTEMPTS - 1) {
          const wait = BACKOFF_MS[i] ?? BACKOFF_MS[BACKOFF_MS.length - 1];
          console.warn(`❌ Upload attempt ${i + 1}/${MAX_ATTEMPTS} failed, retrying in ${wait}ms:`, e);
          await new Promise(r => setTimeout(r, wait));
        }
      }
    }
    console.error('❌ All retry attempts failed:', lastErr);
    throw lastErr;
  }

  /** Single network call. NO recursion. NO calls back into queue. */
  private async uploadOnce(item: UploadItem) {
    const { blob, meta } = item;
    const filename =
      typeof meta?.chunkIndex === 'number' ? `chunk-${meta.chunkIndex}.webm` : 'audio.webm';

    const fd = new FormData();
    fd.append('file', blob, filename);
    fd.append('response_format', 'verbose_json'); // get segments+text from Whisper
    // Optional:
    // fd.append('language', 'en');
    // fd.append('prompt', 'NHS, GP, ARRS, PCN, DES, QoF, SystmOne, EMIS, NG');

    // FORCE direct fetch (no Supabase client). Do not set Content-Type manually.
    const res = await fetch(this.uploadUrl, { method: 'POST', body: fd, headers: { 'x-client': 'lovable' } });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Whisper upload failed ${res.status}: ${text}`);
    }
    return res.json();
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
    this.queue = []; // Clear any pending uploads
    this.processing = false;
  }
  
  isActive() { 
    return this.processing || this.queue.length > 0; 
  }
  
  clearSummary() { 
    this.queue = []; // Clear the queue
    this.processing = false;
  }
}