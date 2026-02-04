import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { createPcmStream } from "@/lib/audio/pcm16";

export type DeepgramPreviewStatus = 'idle' | 'connecting' | 'connected' | 'recording' | 'error' | 'stopped';

interface UseDeepgramRealtimePreviewReturn {
  liveTranscript: string;
  fullTranscript: string;
  status: DeepgramPreviewStatus;
  isActive: boolean;
  error: string | null;
  chunkCount: number;
  startPreview: (meetingId: string, externalStream?: MediaStream, options?: { preserveTranscript?: boolean }) => Promise<void>;
  stopPreview: () => void;
  clearTranscript: () => void;
}

const MAX_WORDS = 100; // Keep last 100 words for live preview

export const useDeepgramRealtimePreview = (): UseDeepgramRealtimePreviewReturn => {
  const [liveTranscript, setLiveTranscript] = useState<string>("");
  const [fullTranscript, setFullTranscript] = useState<string>("");
  const [status, setStatus] = useState<DeepgramPreviewStatus>('idle');
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chunkCount, setChunkCount] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const pcmStreamRef = useRef<{ stop: () => void } | null>(null);
  const meetingIdRef = useRef<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const chunkCounterRef = useRef<number>(0);

  // Track accumulated transcript
  const baseTranscriptRef = useRef<string>("");
  const currentPartialRef = useRef<string>("");
  const lastFinalSegmentRef = useRef<string>("");
  const lastFinalAtRef = useRef<number>(0);

  const normalise = (t: string) =>
    t
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]+/gu, " ")
      .replace(/\s+/g, " ")
      .trim();

  const replaceTrailingSegment = (full: string, oldSeg: string, newSeg: string) => {
    const t = full.trim();
    const oldT = oldSeg.trim();
    const newT = newSeg.trim();

    if (!oldT) return (t + ' ' + newT).trim();
    if (t === oldT) return newT;

    if (t.endsWith(' ' + oldT)) {
      return (t.slice(0, -(oldT.length + 1)) + ' ' + newT).trim();
    }

    if (t.endsWith(oldT)) {
      return (t.slice(0, -oldT.length) + newT).trim();
    }

    return (t + ' ' + newT).trim();
  };

  const shouldReplaceLastFinal = (newText: string) => {
    const last = lastFinalSegmentRef.current;
    if (!last) return false;

    const withinWindow = Date.now() - lastFinalAtRef.current < 2000;
    if (!withinWindow) return false;

    const a = normalise(last);
    const b = normalise(newText);
    if (!a || !b) return false;

    return a === b || a.startsWith(b) || b.startsWith(a);
  };

  // Save transcript chunk to database
  const saveChunkToDatabase = useCallback(async (text: string, confidence: number, isFinal: boolean) => {
    if (!meetingIdRef.current || !text.trim()) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.warn('🎤 Deepgram: No user for DB save');
        return;
      }

      chunkCounterRef.current += 1;
      const chunkNumber = chunkCounterRef.current;
      setChunkCount(chunkNumber);

      const { error: dbError } = await supabase
        .from('deepgram_transcriptions')
        .insert({
          meeting_id: meetingIdRef.current,
          user_id: user.id,
          session_id: sessionIdRef.current || meetingIdRef.current,
          chunk_number: chunkNumber,
          transcription_text: text.trim(),
          confidence: confidence,
          is_final: isFinal,
          word_count: text.trim().split(/\s+/).filter(w => w.length > 0).length
        });

      if (dbError) {
        console.error('❌ Deepgram: Failed to save chunk:', dbError);
      } else {
        console.log(`💾 Deepgram: Saved chunk #${chunkNumber} to DB`);
      }
    } catch (err) {
      console.error('❌ Deepgram: Exception saving chunk:', err);
    }
  }, []);

  // Update transcripts
  const updateTranscript = useCallback((newText: string, isFinal: boolean, confidence: number) => {
    if (!newText.trim()) return;

    console.log(`🎤 Deepgram ${isFinal ? 'FINAL' : 'partial'}: "${newText.substring(0, 50)}..."`);

    if (isFinal) {
      const now = Date.now();

      if (shouldReplaceLastFinal(newText)) {
        const prevSeg = lastFinalSegmentRef.current;
        setFullTranscript((prev) => replaceTrailingSegment(prev, prevSeg, newText));
        baseTranscriptRef.current = replaceTrailingSegment(baseTranscriptRef.current, prevSeg, newText);
        console.log('🔁 Deepgram: Replaced duplicate final segment');
      } else {
        setFullTranscript((prev) => (prev + ' ' + newText).trim());
        baseTranscriptRef.current = (baseTranscriptRef.current + ' ' + newText).trim();
      }

      lastFinalSegmentRef.current = newText;
      lastFinalAtRef.current = now;
      currentPartialRef.current = "";

      // Save final segments to database
      saveChunkToDatabase(newText, confidence, true);

      // Update live preview
      const words = baseTranscriptRef.current.split(/\s+/).slice(-MAX_WORDS);
      setLiveTranscript(words.join(' '));
      return;
    }

    // Partial - replace current partial
    currentPartialRef.current = newText;
    const combined = (baseTranscriptRef.current + ' ' + newText).trim();
    const words = combined.split(/\s+/).slice(-MAX_WORDS);
    setLiveTranscript(words.join(' '));
  }, [saveChunkToDatabase]);

  const cleanup = useCallback(() => {
    if (pcmStreamRef.current) {
      pcmStreamRef.current.stop();
      pcmStreamRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const startPreview = useCallback(async (
    meetingId: string,
    _externalStream?: MediaStream,
    options?: { preserveTranscript?: boolean }
  ) => {
    const { preserveTranscript = false } = options || {};

    if (wsRef.current || isActive) {
      console.log('🎤 Deepgram: Preview already active');
      return;
    }

    try {
      setStatus('connecting');
      setError(null);
      meetingIdRef.current = meetingId;
      sessionIdRef.current = meetingId;

      if (!preserveTranscript) {
        setLiveTranscript("");
        setFullTranscript("");
        baseTranscriptRef.current = "";
        currentPartialRef.current = "";
        lastFinalSegmentRef.current = "";
        lastFinalAtRef.current = 0;
        chunkCounterRef.current = 0;
        setChunkCount(0);
        console.log('🎤 Deepgram: Starting fresh preview');
      } else {
        currentPartialRef.current = "";
        console.log('🎤 Deepgram: Resuming preview (preserving transcript)');
      }

      // Connect to Deepgram streaming WebSocket
      const wsUrl = `wss://dphcnbricafkbtizkoal.supabase.co/functions/v1/deepgram-streaming`;
      console.log('📡 Deepgram: Connecting to WebSocket:', wsUrl);

      wsRef.current = new WebSocket(wsUrl);
      wsRef.current.binaryType = 'arraybuffer';

      wsRef.current.onopen = async () => {
        console.log('✅ Deepgram: WebSocket connected');
        setStatus('connected');

        // Send session start
        wsRef.current?.send(JSON.stringify({ type: 'session.start' }));
      };

      wsRef.current.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'error') {
            console.error('❌ Deepgram error:', data.error);
            setError(`Deepgram error: ${data.error}`);
            return;
          }

          if (data.type === 'session_begins') {
            console.log('✅ Deepgram: Session started, initialising audio...');
            setStatus('recording');
            setIsActive(true);

            // Start PCM audio capture using existing utility
            try {
              pcmStreamRef.current = await createPcmStream((pcmBuffer) => {
                if (wsRef.current?.readyState === WebSocket.OPEN) {
                  wsRef.current.send(pcmBuffer);
                }
              });
              console.log('✅ Deepgram: PCM audio capture started');
            } catch (audioError) {
              console.error('❌ Deepgram: Audio capture failed:', audioError);
              setError('Failed to capture audio: ' + (audioError instanceof Error ? audioError.message : 'Unknown error'));
            }
            return;
          }

          // Handle transcription results
          if (data.channel?.alternatives || data.results?.channels) {
            const channels = data.channel?.alternatives
              ? [{ alternatives: data.channel.alternatives }]
              : (data.results?.channels || []);

            for (const channel of channels) {
              const alternatives = channel.alternatives || [];
              if (alternatives.length > 0) {
                const bestAlt = alternatives[0];
                const transcript = bestAlt.transcript?.trim();

                if (transcript) {
                  const isFinal = data.is_final || data.speech_final || false;
                  const confidence = bestAlt.confidence || 0.9;
                  updateTranscript(transcript, isFinal, confidence);
                }
              }
            }
            return;
          }

          if (data.type === 'session_terminated') {
            console.log('🔌 Deepgram: Session terminated');
            setIsActive(false);
            setStatus('stopped');
            return;
          }

        } catch (parseError) {
          console.error('❌ Deepgram: Parse error:', parseError);
        }
      };

      wsRef.current.onerror = (err) => {
        console.error('❌ Deepgram: WebSocket error:', err);
        setError('WebSocket connection error');
        setStatus('error');
      };

      wsRef.current.onclose = (event) => {
        console.log('🔌 Deepgram: WebSocket closed', event.code, event.reason);
        setIsActive(false);

        if (event.code !== 1000) {
          setError(`Connection closed (${event.code})`);
          setStatus('error');
        } else {
          setStatus('stopped');
        }

        cleanup();
      };

    } catch (err) {
      console.error('❌ Deepgram: Failed to start:', err);
      setError(err instanceof Error ? err.message : 'Failed to start');
      setStatus('error');
      setIsActive(false);
      cleanup();
    }
  }, [isActive, updateTranscript, cleanup]);

  const stopPreview = useCallback(() => {
    console.log('🛑 Deepgram: Stopping preview...');

    // Send terminate message
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({ type: 'terminate' }));
      } catch (e) {
        console.log('Could not send terminate message:', e);
      }
    }

    cleanup();
    setStatus('stopped');
    setIsActive(false);
  }, [cleanup]);

  const clearTranscript = useCallback(() => {
    console.log('🧹 Deepgram: Clearing transcript state');
    setLiveTranscript("");
    setFullTranscript("");
    baseTranscriptRef.current = "";
    currentPartialRef.current = "";
    lastFinalSegmentRef.current = "";
    lastFinalAtRef.current = 0;
    chunkCounterRef.current = 0;
    setChunkCount(0);
    setError(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    liveTranscript,
    fullTranscript,
    status,
    isActive,
    error,
    chunkCount,
    startPreview,
    stopPreview,
    clearTranscript
  };
};
