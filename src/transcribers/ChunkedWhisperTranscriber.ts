import { mergeByTimestamps, segmentsToPlainText, Segment } from '@/lib/segmentMerge';
import { WHISPER_CHUNKING as C } from '@/config/whisperChunking';

export class ChunkedWhisperTranscriber {
  private sessionId = crypto.randomUUID();
  private chunkIndex = 0;
  private mergedSegments: Segment[] = [];
  private fallbackText = '';

  constructor(
    private onTranscription: (data: any) => void,
    private onError: (error: string) => void,
    private onStatusChange: (status: string) => void,
    private onSummary?: (summary: string) => void
  ) {}

  async uploadWindow(blob: Blob, windowStartMs: number, windowEndMs: number) {
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

    if (segs.length) {
      this.mergedSegments = mergeByTimestamps(this.mergedSegments, segs);
      return {
        text: segmentsToPlainText(this.mergedSegments),
        segments: this.mergedSegments,
      };
    } else {
      // Fallback to simple tail-trim merge if only flat text arrives
      this.fallbackText = this.mergeWithOverlap(this.fallbackText, txt);
      return { text: this.fallbackText };
    }
  }

  private mergeWithOverlap(existing: string, incoming: string) {
    if (!existing) return incoming || '';
    if (!incoming) return existing;
    const tail = existing.slice(-30);
    return incoming.startsWith(tail)
      ? existing + incoming.slice(tail.length)
      : existing + ' ' + incoming;
  }

  // Placeholder methods for interface compatibility
  startTranscription() { 
    this.onStatusChange('Starting chunked transcription...');
  }
  
  stopTranscription() { 
    this.onStatusChange('Stopping chunked transcription...');
  }
  
  isActive() { 
    return false; 
  }
  
  clearSummary() { 
    this.mergedSegments = [];
    this.fallbackText = '';
    this.sessionId = crypto.randomUUID();
    this.chunkIndex = 0;
  }
}