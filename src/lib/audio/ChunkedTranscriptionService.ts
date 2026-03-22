/**
 * ChunkedTranscriptionService
 * 
 * Orchestrates upload → transcribe → stitch pipeline for chunked recordings.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { buildWhisperPrompt } from './whisperPromptBuilder';
import { AudioChunk } from './ChunkedRecorder';

export interface TranscriptionProgress {
  phase: 'uploading' | 'transcribing' | 'stitching' | 'complete' | 'error';
  currentChunk: number;
  totalChunks: number;
  percentComplete: number;
  message: string;
}

export interface ChunkTranscript {
  chunkIndex: number;
  text: string;
  segments: TranscriptSegment[];
  wordCount: number;
  success: boolean;
  error?: string;
}

export interface TranscriptSegment {
  start: number;  // seconds from recording start
  end: number;
  text: string;
}

export interface TranscriptionResult {
  sessionId: string;
  fullTranscript: string;
  segments: TranscriptSegment[];
  chunkResults: ChunkTranscript[];
  totalDurationMs: number;
  totalWords: number;
  chunksProcessed: number;
  chunksFailed: number;
}

export interface TranscribeOptions {
  onProgress?: (progress: TranscriptionProgress) => void;
  language?: string;
  maxRetries?: number;          // Default: 2
  continueOnError?: boolean;    // Default: true
  prompt?: string;              // Context hint for Whisper
}

const STORAGE_BUCKET = 'recordings';

export class ChunkedTranscriptionService {
  constructor(private supabase: SupabaseClient) {}

  async transcribeSession(
    sessionId: string,
    chunks: AudioChunk[],
    options: TranscribeOptions = {}
  ): Promise<TranscriptionResult> {
    const { onProgress, language = 'en', maxRetries = 2, continueOnError = true, prompt } = options;
    const totalChunks = chunks.length;
    const chunkResults: ChunkTranscript[] = [];

    // Phase 1: Upload all chunks
    onProgress?.({ phase: 'uploading', currentChunk: 0, totalChunks, percentComplete: 0, message: `Uploading ${totalChunks} audio segment${totalChunks > 1 ? 's' : ''}…` });
    const storagePaths: string[] = [];
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const paddedIndex = String(chunk.index).padStart(3, '0');
      const storagePath = `${sessionId}/chunk_${paddedIndex}.webm`;
      const uploaded = await this.uploadWithRetry(storagePath, chunk.blob, maxRetries);
      if (!uploaded) {
        if (!continueOnError) throw new Error(`Failed to upload chunk ${chunk.index}`);
        storagePaths.push('');
      } else {
        storagePaths.push(storagePath);
      }
      onProgress?.({ phase: 'uploading', currentChunk: i + 1, totalChunks, percentComplete: Math.round(((i + 1) / totalChunks) * 30), message: `Uploaded segment ${i + 1} of ${totalChunks}` });
    }

    // Phase 2: Transcribe each chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const storagePath = storagePaths[i];
      onProgress?.({ phase: 'transcribing', currentChunk: i + 1, totalChunks, percentComplete: 30 + Math.round(((i + 1) / totalChunks) * 60), message: `Transcribing segment ${i + 1} of ${totalChunks}…` });

      if (!storagePath) {
        chunkResults.push({ chunkIndex: chunk.index, text: '', segments: [], wordCount: 0, success: false, error: 'Upload failed' });
        continue;
      }
      const result = await this.transcribeChunkWithRetry(storagePath, chunk, language, prompt, maxRetries);
      chunkResults.push(result);
    }

    // Phase 3: Stitch
    onProgress?.({ phase: 'stitching', currentChunk: totalChunks, totalChunks, percentComplete: 90, message: 'Assembling final transcript…' });
    const stitched = this.stitchTranscripts(chunkResults, chunks);

    const result: TranscriptionResult = {
      sessionId, fullTranscript: stitched.text, segments: stitched.segments, chunkResults,
      totalDurationMs: chunks.reduce((sum, c) => Math.max(sum, c.endTimeMs), 0),
      totalWords: stitched.text.split(/\s+/).filter(Boolean).length,
      chunksProcessed: chunkResults.filter(r => r.success).length,
      chunksFailed: chunkResults.filter(r => !r.success).length,
    };

    onProgress?.({ phase: 'complete', currentChunk: totalChunks, totalChunks, percentComplete: 100, message: `Transcription complete — ${result.totalWords} words` });
    return result;
  }

  private async uploadWithRetry(path: string, blob: Blob, maxRetries: number): Promise<boolean> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const { error } = await this.supabase.storage.from(STORAGE_BUCKET).upload(path, blob, { contentType: 'audio/webm', upsert: true });
        if (!error) return true;
        console.warn(`Upload attempt ${attempt + 1} failed for ${path}:`, error.message);
      } catch (err) { console.warn(`Upload attempt ${attempt + 1} threw for ${path}:`, err); }
      if (attempt < maxRetries) await this.sleep(1000 * Math.pow(2, attempt));
    }
    return false;
  }

  private async transcribeChunkWithRetry(
    storagePath: string, chunk: AudioChunk, language: string, prompt: string | undefined, maxRetries: number
  ): Promise<ChunkTranscript> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const { data, error } = await this.supabase.functions.invoke('standalone-whisper', {
          body: { storagePath, language, prompt, responseFormat: 'verbose_json' },
        });
        if (error) throw error;
        const whisperResponse = data;
        const offsetSeconds = chunk.startTimeMs / 1000;
        const segments: TranscriptSegment[] = (whisperResponse.segments || []).map((seg: any) => ({
          start: seg.start + offsetSeconds, end: seg.end + offsetSeconds, text: seg.text?.trim() || '',
        }));
        return { chunkIndex: chunk.index, text: whisperResponse.text || '', segments, wordCount: (whisperResponse.text || '').split(/\s+/).filter(Boolean).length, success: true };
      } catch (err: any) {
        console.warn(`Transcribe attempt ${attempt + 1} failed for chunk ${chunk.index}:`, err);
        if (attempt < maxRetries) await this.sleep(2000 * Math.pow(2, attempt));
      }
    }
    return { chunkIndex: chunk.index, text: '', segments: [], wordCount: 0, success: false, error: `Failed after ${maxRetries + 1} attempts` };
  }

  private stitchTranscripts(results: ChunkTranscript[], _chunks: AudioChunk[]): { text: string; segments: TranscriptSegment[] } {
    const successfulResults = results.filter(r => r.success && r.text).sort((a, b) => a.chunkIndex - b.chunkIndex);
    if (successfulResults.length === 0) return { text: '', segments: [] };
    if (successfulResults.length === 1) return { text: successfulResults[0].text, segments: successfulResults[0].segments };

    const allSegments: TranscriptSegment[] = [];
    let lastEndTime = 0;
    for (const result of successfulResults) {
      for (const seg of result.segments) {
        if (seg.end <= lastEndTime + 0.5) continue; // skip overlap duplicates
        allSegments.push(seg);
        lastEndTime = Math.max(lastEndTime, seg.end);
      }
    }
    const fullText = allSegments.map(s => s.text).join(' ').replace(/\s+/g, ' ').trim();
    return { text: fullText, segments: allSegments };
  }

  private sleep(ms: number): Promise<void> { return new Promise(resolve => setTimeout(resolve, ms)); }
}
