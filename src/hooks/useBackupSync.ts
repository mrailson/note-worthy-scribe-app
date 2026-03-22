import { useState, useCallback, useEffect } from 'react';
import {
  getSession,
  getSegments,
  updateSession,
  deleteSession,
  listPendingSessions,
  type BackupSession,
} from '@/utils/offlineAudioStore';
import { supabase } from '@/integrations/supabase/client';
import { WHISPER_CHUNKING } from '@/config/whisperChunking';
import { uploadPendingBackups } from '@/utils/backupUploader';

export function useBackupSync() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0); // 0-100
  const [currentSegment, setCurrentSegment] = useState(0);
  const [totalSegments, setTotalSegments] = useState(0);
  const [pendingSessions, setPendingSessions] = useState<BackupSession[]>([]);

  const refreshPendingSessions = useCallback(async () => {
    const sessions = await listPendingSessions();
    setPendingSessions(sessions);
  }, []);

  // Auto-upload pending backups when online
  useEffect(() => {
    const tryUpload = async () => {
      await uploadPendingBackups();
      await refreshPendingSessions();
    };

    tryUpload();

    const onOnline = () => tryUpload();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [refreshPendingSessions]);

  const transcribeSegment = async (blob: Blob, mimeType: string): Promise<string> => {
    // Convert blob to base64
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    const { data, error } = await supabase.functions.invoke('speech-to-text', {
      body: {
        audio: base64,
        mimeType: mimeType || 'audio/webm;codecs=opus',
      },
    });

    if (error) throw new Error(`Transcription failed: ${error.message}`);
    return data?.text || data?.transcript || '';
  };

  /**
   * Simple overlap deduplication: if the end of text A and start of text B
   * share similar sentences, remove the duplicate prefix from B.
   */
  /**
   * Word-boundary overlap removal for chunk stitching.
   * Searches the first 50 words of the current chunk for phrases (min 8 words)
   * matching the last 80 words of the previous chunk.
   */
  const removeOverlapText = (currentTranscript: string, previousTranscript: string, chunkNumber: number): string => {
    if (!currentTranscript || !previousTranscript) return currentTranscript;

    const currentWords = currentTranscript.split(/\s+/);
    const previousWords = previousTranscript.split(/\s+/);

    // Only look at the last 80 words of the previous chunk
    const previousTail = previousWords.slice(-80).map(w => w.toLowerCase());
    const previousTailStr = previousTail.join(' ');

    // Only look at the first 50 words of the current chunk for overlap
    const searchWindow = Math.min(50, currentWords.length);

    let overlapEndIndex = 0;

    // Find longest matching phrase — minimum 8 words to avoid false positives
    for (let phraseLength = Math.min(30, searchWindow); phraseLength >= 8; phraseLength--) {
      for (let startIndex = 0; startIndex <= searchWindow - phraseLength; startIndex++) {
        const phrase = currentWords
          .slice(startIndex, startIndex + phraseLength)
          .map(w => w.toLowerCase())
          .join(' ');

        // Word-boundary matching via joined word arrays
        if (previousTailStr.includes(phrase)) {
          overlapEndIndex = startIndex + phraseLength;
          console.log(
            `🔍 Chunk ${chunkNumber}: Found ${phraseLength}-word overlap at position ${startIndex}`
          );
          break;
        }
      }
      if (overlapEndIndex > 0) break;
    }

    if (overlapEndIndex > 0) {
      const cleanedWords = currentWords.slice(overlapEndIndex);
      console.log(
        `✂️ Chunk ${chunkNumber}: Removed ${overlapEndIndex} overlapping words ` +
        `(${currentWords.length} → ${cleanedWords.length})`
      );
      return cleanedWords.join(' ');
    }

    return currentTranscript;
  };

  const processSession = useCallback(async (sessionId: string) => {
    if (!navigator.onLine) {
      throw new Error('No internet connection. Please try again when online.');
    }

    setIsProcessing(true);
    setProgress(0);

    try {
      const session = await getSession(sessionId);
      if (!session) throw new Error('Session not found');

      await updateSession(sessionId, { status: 'processing' });

      const segments = await getSegments(sessionId);
      setTotalSegments(segments.length);

      const transcripts: string[] = [];

      for (let i = 0; i < segments.length; i++) {
        setCurrentSegment(i + 1);
        setProgress(Math.round(((i) / segments.length) * 100));

        const text = await transcribeSegment(segments[i].blob, session.format);
        
        // Deduplicate overlap with previous segment
        const deduplicated = i > 0
          ? removeOverlapText(text, transcripts[i - 1], i)
          : text;

        transcripts.push(deduplicated);
      }

      const fullTranscript = transcripts.join(' ').trim();

      await updateSession(sessionId, {
        status: 'completed',
        transcript: fullTranscript,
      });

      setProgress(100);
      await refreshPendingSessions();

      return fullTranscript;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Processing failed';
      await updateSession(sessionId, { status: 'error', errorMessage: msg });
      await refreshPendingSessions();
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, [refreshPendingSessions]);

  const deleteBackupSession = useCallback(async (sessionId: string) => {
    await deleteSession(sessionId);
    await refreshPendingSessions();
  }, [refreshPendingSessions]);

  return {
    isProcessing,
    progress,
    currentSegment,
    totalSegments,
    pendingSessions,
    refreshPendingSessions,
    processSession,
    deleteBackupSession,
  };
}
