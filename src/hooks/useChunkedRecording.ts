/**
 * useChunkedRecording — React hook
 * 
 * Drop-in hook that wraps ChunkedRecorder + ChunkedTranscriptionService.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ChunkedRecorder, AudioChunk } from '@/lib/audio/ChunkedRecorder';
import type { AudioBitrate } from '@/lib/audio/ChunkedRecorder';
import { ChunkedTranscriptionService, TranscriptionProgress, TranscriptionResult } from '@/lib/audio/ChunkedTranscriptionService';

interface UseChunkedRecordingOptions {
  chunkMinutes?: number;         // Default: 15
  audioBitrate?: AudioBitrate;   // Default: 32000
  language?: string;             // Default: 'en'
  prompt?: string;               // Context hint for Whisper
  autoTranscribe?: boolean;      // Default: true
}

interface UseChunkedRecordingReturn {
  isRecording: boolean;
  isSyncing: boolean;
  elapsedTime: string;
  chunksCompleted: number;
  progress: TranscriptionProgress | null;
  transcriptionResult: TranscriptionResult | null;
  error: string | null;
  startRecording: (sessionId?: string) => Promise<void>;
  stopRecording: () => Promise<AudioChunk[]>;
  transcribeChunks: (sessionId: string, chunks: AudioChunk[]) => Promise<TranscriptionResult>;
}

export function useChunkedRecording(options: UseChunkedRecordingOptions = {}): UseChunkedRecordingReturn {
  const { chunkMinutes = 15, audioBitrate = 32000, language = 'en', prompt, autoTranscribe = true } = options;

  const [isRecording, setIsRecording] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [elapsedTime, setElapsedTime] = useState('00:00');
  const [chunksCompleted, setChunksCompleted] = useState(0);
  const [progress, setProgress] = useState<TranscriptionProgress | null>(null);
  const [transcriptionResult, setTranscriptionResult] = useState<TranscriptionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<ChunkedRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionIdRef = useRef<string>('');

  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        if (recorderRef.current) setElapsedTime(formatDuration(recorderRef.current.elapsedMs));
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isRecording]);

  const startRecording = useCallback(async (sessionId?: string) => {
    setError(null); setTranscriptionResult(null); setChunksCompleted(0); setElapsedTime('00:00');
    sessionIdRef.current = sessionId || crypto.randomUUID();
    const recorder = new ChunkedRecorder({
      chunkDurationMs: chunkMinutes * 60 * 1000,
      audioBitrate,
      onChunkReady: (chunk) => {
        setChunksCompleted(prev => prev + 1);
        console.log(`[ChunkedRecording] Chunk ${chunk.index} ready: ${(chunk.sizeBytes / 1024 / 1024).toFixed(1)}MB, ${(chunk.durationMs / 1000).toFixed(0)}s`);
      },
      onStatusChange: (status) => console.log(`[ChunkedRecording] Status: ${status}`),
    });
    recorderRef.current = recorder;
    try { await recorder.start(); setIsRecording(true); }
    catch (err: any) { setError(`Microphone access failed: ${err.message}`); }
  }, [chunkMinutes, audioBitrate]);

  const transcribeChunks = useCallback(async (sessionId: string, chunks: AudioChunk[]): Promise<TranscriptionResult> => {
    setIsSyncing(true); setError(null);
    const service = new ChunkedTranscriptionService(supabase);
    try {
      const result = await service.transcribeSession(sessionId, chunks, { language, prompt, onProgress: (p) => setProgress(p), continueOnError: true });
      setTranscriptionResult(result);
      if (result.chunksFailed > 0) setError(`${result.chunksFailed} of ${result.chunksProcessed + result.chunksFailed} segments failed. Partial transcript available.`);
      return result;
    } catch (err: any) { setError(`Transcription failed: ${err.message}`); throw err; }
    finally { setIsSyncing(false); }
  }, [language, prompt]);

  const stopRecording = useCallback(async (): Promise<AudioChunk[]> => {
    if (!recorderRef.current) return [];
    const chunks = await recorderRef.current.stop();
    setIsRecording(false);
    console.log(`[ChunkedRecording] Stopped. ${chunks.length} chunks, total ${(chunks.reduce((s, c) => s + c.sizeBytes, 0) / 1024 / 1024).toFixed(1)}MB`);
    if (autoTranscribe && chunks.length > 0) transcribeChunks(sessionIdRef.current, chunks);
    return chunks;
  }, [autoTranscribe, transcribeChunks]);

  return { isRecording, isSyncing, elapsedTime, chunksCompleted, progress, transcriptionResult, error, startRecording, stopRecording, transcribeChunks };
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}
