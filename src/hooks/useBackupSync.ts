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
  const deduplicateOverlap = (textA: string, textB: string): string => {
    if (!textA || !textB) return textB;

    const threshold = WHISPER_CHUNKING.deduplication.similarityThreshold;
    const sentenceCount = WHISPER_CHUNKING.deduplication.sentencesToCompare;

    // Split into sentences
    const sentencesA = textA.split(/[.!?]+/).map(s => s.trim()).filter(Boolean);
    const sentencesB = textB.split(/[.!?]+/).map(s => s.trim()).filter(Boolean);

    if (sentencesA.length === 0 || sentencesB.length === 0) return textB;

    // Compare last N sentences of A with first N sentences of B
    const tailA = sentencesA.slice(-sentenceCount);
    let overlapCount = 0;

    for (let i = 0; i < Math.min(sentenceCount, sentencesB.length); i++) {
      const bSentence = sentencesB[i].toLowerCase();
      const matchFound = tailA.some(aSentence => {
        const aLower = aSentence.toLowerCase();
        // Simple token overlap similarity
        const tokensA = new Set(aLower.split(/\s+/));
        const tokensB = new Set(bSentence.split(/\s+/));
        const intersection = [...tokensA].filter(t => tokensB.has(t)).length;
        const union = new Set([...tokensA, ...tokensB]).size;
        return union > 0 && intersection / union >= threshold;
      });

      if (matchFound) {
        overlapCount = i + 1;
      } else {
        break;
      }
    }

    if (overlapCount > 0) {
      // Remove overlapping sentences from start of B
      return sentencesB.slice(overlapCount).join('. ');
    }

    return textB;
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
          ? deduplicateOverlap(transcripts[i - 1], text)
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
