import { mergeByTimestamps, segmentsToPlainText, Segment } from '@/lib/segmentMerge';
import { WHISPER_CHUNKING as C } from '@/config/whisperChunking';
import { 
  deduplicateChunk, 
  createDeduplicationState, 
  DeduplicationState 
} from '@/lib/whisperDeduplication';
import { repairSentences, lightRepair } from '@/lib/sentenceRepair';
import { 
  evaluateConfidence, 
  createConfidenceGateState, 
  updateConfidenceGateState,
  ConfidenceGateState,
  ConfidenceResult
} from '@/lib/whisperConfidenceGate';

// === Non-recursive retry-safe networking + queue ===
const BACKOFF_MS = [250, 600, 1200];
const MAX_ATTEMPTS = 3;

type UploadItem = { blob: Blob; windowStartMs: number; windowEndMs: number };

export class ChunkedWhisperTranscriber {
  private sessionId = crypto.randomUUID();
  private chunkIndex = 0;
  private mergedSegments: Segment[] = [];
  private fallbackText = '';
  private queue: UploadItem[] = [];
  private processing = false;
  
  // Deduplication state
  private deduplicationState: DeduplicationState = createDeduplicationState();
  
  // Confidence gate state
  private confidenceState: ConfidenceGateState = createConfidenceGateState();

  constructor(
    private onTranscription: (data: any) => void,
    private onError: (error: string) => void,
    private onStatusChange: (status: string) => void,
    private onSummary?: (summary: string) => void
  ) {}

  /** Call this to enqueue a window for processing */
  enqueueWindow(blob: Blob, windowStartMs: number, windowEndMs: number) {
    if (!blob || !blob.size) return;
    this.queue.push({ blob, windowStartMs, windowEndMs });
    // Fire-and-forget; no awaits -> no accidental re-entrancy
    this.drainQueue().catch(e => this.onError(`Queue processing error: ${e.message}`));
  }

  private async drainQueue() {
    if (this.processing) return;
    this.processing = true;
    try {
      while (this.queue.length) {
        const item = this.queue.shift()!;
        const res = await this.uploadWithRetry(() => this.uploadOnce(item));
        // Handle the response and call onTranscription
        const result = this.handleProviderPayload(res);
        this.onTranscription(result);
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
          console.warn(`❌ Chunked upload attempt ${i + 1}/${MAX_ATTEMPTS} failed, retrying in ${wait}ms:`, e);
          await new Promise(r => setTimeout(r, wait));
        }
      }
    }
    console.error('❌ All chunked retry attempts failed:', lastErr);
    throw lastErr;
  }

  /** Single network call. Never calls drainQueue/uploadWithRetry/process* */
  private async uploadOnce(item: UploadItem) {
    const { blob, windowStartMs, windowEndMs } = item;
    
    const fd = new FormData();
    fd.append('file', blob, `chunk-${this.chunkIndex}.webm`);
    fd.append('mimeType', C.mimeType);
    fd.append('chunkIndex', String(this.chunkIndex));
    fd.append('windowStartMs', String(windowStartMs));
    fd.append('windowEndMs', String(windowEndMs));
    fd.append('sessionId', this.sessionId);
    fd.append('language', 'en');
    fd.append('prompt', 'NHS, GP, ARRS, PCN, DES, QoF, SystmOne, EMIS, NG');
    fd.append('response_format', 'verbose_json');

    const res = await fetch(C.uploadUrl, { 
      method: 'POST', 
      body: fd, 
      headers: { 'x-client': 'lovable' } 
    });
    
    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      throw new Error(`Whisper upload failed ${res.status}: ${errorText}`);
    }
    
    this.chunkIndex += 1;
    return res.json();
  }

  handleProviderPayload(payload: any) {
    const segs = (payload?.data?.segments as Segment[]) || [];
    const txt = (payload?.data?.text as string) || '';
    const confidence = payload?.confidence ?? 0.5;
    const noSpeechProbability = payload?.noSpeechProbability ?? 0;
    
    let finalText = '';
    let duplicatesRemoved = 0;

    if (segs.length) {
      // Mark all segments as final to prevent reprocessing loops
      const finalSegments = segs.map(seg => ({
        ...seg,
        isFinal: true
      }));
      
      // Use stricter merging with overlap detection
      this.mergedSegments = mergeByTimestamps(this.mergedSegments, finalSegments);
      
      finalText = segmentsToPlainText(this.mergedSegments);
    } else if (txt && txt.trim()) {
      // Fallback to simple tail-trim merge if only flat text arrives
      this.fallbackText = this.mergeWithOverlap(this.fallbackText, txt);
      finalText = this.fallbackText;
    }
    
    // Apply deduplication if enabled
    if (C.deduplication?.enabled && finalText) {
      const dedupeResult = deduplicateChunk(
        finalText, 
        this.deduplicationState, 
        this.chunkIndex - 1
      );
      finalText = dedupeResult.text;
      duplicatesRemoved = dedupeResult.duplicatesRemoved;
      this.deduplicationState = dedupeResult.state;
    }
    
    // Apply sentence repair if enabled
    if (C.sentenceRepair?.enabled && finalText) {
      // Use light repair for real-time (less aggressive)
      finalText = lightRepair(finalText);
    }
    
    // Evaluate confidence and update gate state
    let confidenceResult: ConfidenceResult | null = null;
    if (C.confidenceGate?.enabled) {
      confidenceResult = evaluateConfidence(
        finalText,
        confidence,
        noSpeechProbability,
        duplicatesRemoved,
        txt.length
      );
      this.confidenceState = updateConfidenceGateState(
        this.confidenceState,
        this.chunkIndex - 1,
        confidenceResult
      );
      
      if (confidenceResult.isLowConfidence) {
        console.log(`⚠️ Low confidence chunk ${this.chunkIndex - 1}: ${confidenceResult.reason}`);
      }
    }
    
    console.log(`📝 Chunked transcriber: processed chunk ${this.chunkIndex - 1}, ${finalText.length} chars` +
      (duplicatesRemoved > 0 ? `, ${duplicatesRemoved} duplicates removed` : ''));
    
    return {
      text: finalText,
      segments: this.mergedSegments,
      isFinal: true, // Always mark as final to prevent cascade reprocessing
      confidence,
      duplicatesRemoved,
      lowConfidence: confidenceResult?.isLowConfidence ?? false,
      requiresCrossCheck: confidenceResult?.requiresCrossCheck ?? false
    };
  }

  private mergeWithOverlap(existing: string, incoming: string) {
    if (!existing) return incoming || '';
    if (!incoming) return existing;
    const tail = existing.slice(-30);
    return incoming.startsWith(tail)
      ? existing + incoming.slice(tail.length)
      : existing + ' ' + incoming;
  }

  // Get confidence gate state for the session
  getConfidenceState(): ConfidenceGateState {
    return this.confidenceState;
  }

  // Placeholder methods for interface compatibility
  startTranscription() { 
    this.onStatusChange('Starting chunked transcription...');
  }
  
  stopTranscription() { 
    this.onStatusChange('Stopping chunked transcription...');
    this.queue = []; // Clear any pending uploads
    this.processing = false;
  }
  
  isActive() { 
    return this.processing || this.queue.length > 0; 
  }
  
  clearSummary() { 
    this.mergedSegments = [];
    this.fallbackText = '';
    this.sessionId = crypto.randomUUID();
    this.chunkIndex = 0;
    this.queue = []; // Clear the queue
    this.processing = false;
    // Reset deduplication and confidence states
    this.deduplicationState = createDeduplicationState();
    this.confidenceState = createConfidenceGateState();
  }
}