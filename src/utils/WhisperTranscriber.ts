// ============= Complete WebM Buffering WhisperTranscriber =============
import { hasAudioActivity } from './audioLevelDetection';
import { mergeByTimestamps, segmentsToPlainText, type Segment } from '@/lib/segmentMerge';

export interface TranscriptData {
  text: string;
  is_final: boolean;
  confidence: number;
  start?: number;
  end?: number;
  speaker?: string;
}

type UploadMeta = {
  isFinal: boolean;
  language?: string;
  meetingId?: string;
  sessionId?: string;
};

export class WhisperTranscriber {
  private edgeUrl: string;
  private onPayload: (p: any) => void;
  private onError: (e: any) => void;
  private onStatusChange?: (status: string) => void;
  
  // Complete WebM buffering approach
  private chunkBuffer: Blob[] = [];
  private flushTimer: number | null = null;
  private chunkIndex = 0;
  private isRecording = false;
  private mergedSegments: Segment[] = [];
  private sessionId = crypto.randomUUID();
  
  private readonly MIME = 'audio/webm;codecs=opus';
  private readonly FLUSH_INTERVAL_MS = 25000; // 25 seconds
  private readonly MAX_BUFFER_SIZE = 2_000_000; // 2MB

  constructor(edgeUrl: string, onPayload: (p: any) => void, onError: (e: any) => void, onStatusChange?: (status: string) => void) {
    if (!edgeUrl) throw new Error("WhisperTranscriber: edgeUrl required");
    this.edgeUrl = edgeUrl;
    this.onPayload = onPayload;
    this.onError = onError;
    this.onStatusChange = onStatusChange;
    
    console.log("🔧 STANDALONE WHISPER: Using complete WebM buffering with 25s intervals");
  }

  /** Call from MediaRecorder.ondataavailable */
  enqueueChunk(blob: Blob, meta?: any) {
    if (!blob || !blob.size) return;
    
    // Buffer raw chunks - MediaRecorder only puts WebM headers in first chunk!
    this.chunkBuffer.push(blob);
    const totalBytes = this.chunkBuffer.reduce((sum, b) => sum + b.size, 0);
    
    console.log(`📦 WHISPER: Buffered chunk ${this.chunkBuffer.length}, total: ${totalBytes} bytes`);
    
    // Optional: immediate size threshold flush
    if (totalBytes > this.MAX_BUFFER_SIZE) {
      console.log(`📏 WHISPER: Size threshold reached (${totalBytes}/${this.MAX_BUFFER_SIZE}), flushing...`);
      this.flushCompleteWebM(false).catch(console.error);
    }
  }

  startTranscription() {
    console.log('🎙️ WHISPER: Starting transcription - resetting state');
    this.isRecording = true;
    this.chunkBuffer = [];
    this.chunkIndex = 0;
    this.mergedSegments = [];
    this.sessionId = crypto.randomUUID();
    
    // Start periodic flush timer (every 25s)
    if (this.flushTimer) {
      window.clearInterval(this.flushTimer);
    }
    
    this.flushTimer = window.setInterval(() => {
      if (this.chunkBuffer.length > 0) {
        console.log(`⏰ WHISPER: Timer flush (${this.chunkBuffer.length} chunks buffered)`);
        this.flushCompleteWebM(false).catch(console.error);
      }
    }, this.FLUSH_INTERVAL_MS);
  }
  
  stopTranscription() { 
    console.log('🛑 WHISPER: Stopping transcription - final flush');
    this.isRecording = false;
    
    // Clear timer
    if (this.flushTimer) {
      window.clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    
    // Final flush
    if (this.chunkBuffer.length > 0) {
      this.flushCompleteWebM(true).catch(console.error);
    }
  }
  
  /** Create complete WebM file from buffer and upload */
  private async flushCompleteWebM(isFinal: boolean) {
    if (!this.chunkBuffer.length) return;

    // Create a COMPLETED WebM file (with headers)
    const completeBlob = new Blob(this.chunkBuffer, { type: this.MIME });
    const bufferLength = this.chunkBuffer.length;
    
    // Reset buffer for next segment
    this.chunkBuffer = [];

    console.log(`🚀 WHISPER: Flushing complete WebM (${bufferLength} chunks, ${completeBlob.size} bytes, chunk #${this.chunkIndex})`);
    
    await this.uploadCompleteFile(completeBlob, { isFinal });
    this.chunkIndex += 1;
  }

  /** Upload complete WebM file to speech-to-text-chunked */
  private async uploadCompleteFile(blob: Blob, meta: UploadMeta) {
    // NOTE: Audio activity detection removed - WebM/Opus containers cannot be 
    // analyzed as raw PCM, causing valid speech to be incorrectly filtered out
    
    const formData = new FormData();
    formData.append('file', new File([blob], `chunk_${this.chunkIndex}.webm`, { type: this.MIME }));
    formData.append('chunkIndex', String(this.chunkIndex));
    formData.append('isFinal', meta.isFinal ? 'true' : 'false');
    formData.append('sessionId', this.sessionId);
    
    formData.append('language', meta.language || 'en');
    if (meta.meetingId) formData.append('meetingId', meta.meetingId);

    console.log(`📡 WHISPER: Uploading chunk ${this.chunkIndex} (${blob.size} bytes, isFinal: ${meta.isFinal})`);

    const response = await fetch(this.edgeUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwaGNuYnJpY2Fma2J0aXprb2FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3MzIyMzIsImV4cCI6MjA2ODMwODIzMn0.U3bJI6P1yzgRBz_k2s0zlJGu1GWiVRTHjYgv9QQggPs`,
        'apikey': `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwaGNuYnJpY2Fma2J0aXprb2FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3MzIyMzIsImV4cCI6MjA2ODMwODIzMn0.U3bJI6P1yzgRBz_k2s0zlJGu1GWiVRTHjYgv9QQggPs`
      },
      body: formData
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.error(`❌ WHISPER: Upload failed (${response.status}):`, text);
      throw new Error(`Upload failed (${response.status}): ${text}`);
    }

    const payload = await response.json();
    console.log(`✅ WHISPER: Chunk ${this.chunkIndex} transcribed:`, {
      textLength: payload.data?.text?.length || 0,
      textPreview: payload.data?.text?.slice(0, 50),
      segmentsCount: payload.data?.segments?.length || 0
    });
    
    // Use timestamp-based segment merging instead of simple concatenation
    if (payload.data?.segments?.length > 0) {
      // Convert Whisper segments to our Segment format
      const incomingSegments: Segment[] = payload.data.segments.map((seg: any) => ({
        start: seg.start || 0,
        end: seg.end || seg.start || 0,
        text: (seg.text || '').trim()
      })).filter((seg: Segment) => seg.text.length > 0);

      console.log(`🔗 WHISPER: Merging ${incomingSegments.length} segments with ${this.mergedSegments.length} existing segments`);
      
      // Merge segments using timestamp-based deduplication
      this.mergedSegments = mergeByTimestamps(this.mergedSegments, incomingSegments);
      
      // Generate clean plain text from merged segments
      const mergedText = segmentsToPlainText(this.mergedSegments);
      
      console.log(`📝 WHISPER: Merged text: ${mergedText.length} chars, ${this.mergedSegments.length} total segments`);
      
      const convertedPayload = {
        ok: true,
        data: {
          text: mergedText,
          segments: this.mergedSegments
        }
      };
      
      this.onPayload?.(convertedPayload);
      
      // Notify status update
      this.onStatusChange?.(`Segment #${this.chunkIndex} processed (${this.mergedSegments.length} segments)`);
    } else if (payload.data?.text) {
      // Fallback for responses without segments - create a basic segment
      console.log(`⚠️ WHISPER: No segments in response, creating fallback segment`);
      const fallbackSegment: Segment = {
        start: this.chunkIndex * 25, // Estimate based on 25s chunks
        end: (this.chunkIndex + 1) * 25,
        text: payload.data.text.trim()
      };
      
      this.mergedSegments = mergeByTimestamps(this.mergedSegments, [fallbackSegment]);
      const mergedText = segmentsToPlainText(this.mergedSegments);
      
      const convertedPayload = {
        ok: true,
        data: {
          text: mergedText,
          segments: this.mergedSegments
        }
      };
      
      this.onPayload?.(convertedPayload);
      this.onStatusChange?.(`Segment #${this.chunkIndex} processed (fallback)`);
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
  
  isActive() { 
    return this.isRecording; 
  }
  
  clearSummary() { 
    console.log('🧹 WHISPER: Clearing state');
    this.chunkBuffer = [];
    this.mergedSegments = [];
    this.chunkIndex = 0;
    this.sessionId = crypto.randomUUID();
    
    if (this.flushTimer) {
      window.clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }
}