import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { createPcmStream } from "@/lib/audio/pcm16";
import { detectDevice } from "@/utils/DeviceDetection";

export type DeepgramPreviewStatus = 'idle' | 'connecting' | 'connected' | 'recording' | 'reconnecting' | 'error' | 'stopped';

interface UseDeepgramRealtimePreviewReturn {
  liveTranscript: string;
  fullTranscript: string;
  status: DeepgramPreviewStatus;
  isActive: boolean;
  error: string | null;
  chunkCount: number;
  reconnectAttempts: number;
  startPreview: (meetingId: string, externalStream?: MediaStream, options?: { preserveTranscript?: boolean }) => Promise<void>;
  stopPreview: () => void;
  clearTranscript: () => void;
}

const MAX_WORDS = 100; // Keep last 100 words for live preview
const MAX_RECONNECT_ATTEMPTS = 8; // Increased for iOS resilience
const INITIAL_RECONNECT_DELAY = 1000; // 1 second
const MAX_RECONNECT_DELAY = 30000; // 30 seconds
const KEEPALIVE_INTERVAL_MS = 15000; // 15s keepalive ping
const isIOSDevice = detectDevice().isIOS;

// Hook must be called unconditionally - all useState/useRef at top level
export const useDeepgramRealtimePreview = (): UseDeepgramRealtimePreviewReturn => {
  const [liveTranscript, setLiveTranscript] = useState<string>("");
  const [fullTranscript, setFullTranscript] = useState<string>("");
  const [status, setStatus] = useState<DeepgramPreviewStatus>('idle');
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chunkCount, setChunkCount] = useState(0);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const pcmStreamRef = useRef<{ stop: () => void } | null>(null);
  const meetingIdRef = useRef<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const lastExternalStreamRef = useRef<MediaStream | undefined>(undefined);
  const chunkCounterRef = useRef<number>(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const keepaliveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const intentionalStopRef = useRef<boolean>(false);
  const reconnectAttemptsRef = useRef<number>(0);

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

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (keepaliveIntervalRef.current) {
      clearInterval(keepaliveIntervalRef.current);
      keepaliveIntervalRef.current = null;
    }
  }, []);

  // Internal reconnect function
  const attemptReconnect = useCallback(async () => {
    if (intentionalStopRef.current) {
      console.log('🔌 Deepgram: Skipping reconnect - intentional stop');
      return;
    }

    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      console.error('❌ Deepgram: Max reconnection attempts reached');
      setError(`Connection lost after ${MAX_RECONNECT_ATTEMPTS} reconnection attempts`);
      setStatus('error');
      setIsActive(false);
      return;
    }

    const meetingId = meetingIdRef.current;
    if (!meetingId) {
      console.log('🔌 Deepgram: No meeting ID for reconnect');
      return;
    }

    reconnectAttemptsRef.current += 1;
    setReconnectAttempts(reconnectAttemptsRef.current);

    // Exponential backoff with jitter
    const delay = Math.min(
      INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttemptsRef.current - 1) + Math.random() * 500,
      MAX_RECONNECT_DELAY
    );

    console.log(`🔄 Deepgram: Reconnecting in ${Math.round(delay)}ms (attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})`);
    setStatus('reconnecting');
    setError(null);

    reconnectTimeoutRef.current = setTimeout(async () => {
      try {
        // Clean up old connection first
        if (wsRef.current) {
          wsRef.current.close();
          wsRef.current = null;
        }
        if (pcmStreamRef.current) {
          pcmStreamRef.current.stop();
          pcmStreamRef.current = null;
        }

        // Connect to Deepgram streaming WebSocket — token in query string
        // because browsers can't set Authorization headers on WebSockets.
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;
        if (!accessToken) {
          console.error('❌ Deepgram: No access token for reconnect');
          setStatus('error');
          setError('Not authenticated — please sign in again.');
          return;
        }
        const wsUrl = `wss://dphcnbricafkbtizkoal.supabase.co/functions/v1/deepgram-streaming?token=${encodeURIComponent(accessToken)}`;
        console.log('📡 Deepgram: Reconnecting to WebSocket');

        wsRef.current = new WebSocket(wsUrl);
        wsRef.current.binaryType = 'arraybuffer';

        wsRef.current.onopen = async () => {
          console.log('✅ Deepgram: WebSocket reconnected');
          setStatus('connected');
          reconnectAttemptsRef.current = 0;
          setReconnectAttempts(0);
          setError(null);

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
              console.log('✅ Deepgram: Session resumed after reconnect');
              setStatus('recording');
              setIsActive(true);

              // Restart keepalive ping
              if (keepaliveIntervalRef.current) clearInterval(keepaliveIntervalRef.current);
              keepaliveIntervalRef.current = setInterval(() => {
                if (wsRef.current?.readyState === WebSocket.OPEN) {
                  try {
                    wsRef.current.send(JSON.stringify({ type: 'keepalive' }));
                  } catch {
                    console.warn('🔌 Deepgram: Keepalive send failed after reconnect');
                    attemptReconnect();
                  }
                } else if (wsRef.current?.readyState !== WebSocket.CONNECTING) {
                  attemptReconnect();
                }
              }, KEEPALIVE_INTERVAL_MS);

              // Start PCM audio capture (use external stream if available)
              try {
                pcmStreamRef.current = await createPcmStream((pcmBuffer) => {
                  if (wsRef.current?.readyState === WebSocket.OPEN) {
                    wsRef.current.send(pcmBuffer);
                  }
                }, lastExternalStreamRef.current);
                console.log('✅ Deepgram: PCM audio capture resumed', lastExternalStreamRef.current ? '(external stream)' : '(mic)');
              } catch (audioError) {
                console.error('❌ Deepgram: Audio capture failed on reconnect:', audioError);
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
              console.log('🔌 Deepgram: Session terminated during reconnect');
              attemptReconnect();
              return;
            }

          } catch (parseError) {
            console.error('❌ Deepgram: Parse error:', parseError);
          }
        };

        wsRef.current.onerror = (err) => {
          console.error('❌ Deepgram: WebSocket error during reconnect:', err);
          attemptReconnect();
        };

        wsRef.current.onclose = (event) => {
          console.log('🔌 Deepgram: WebSocket closed during/after reconnect', event.code, event.reason);
          
          if (!intentionalStopRef.current && event.code !== 1000) {
            attemptReconnect();
          } else if (event.code === 1000) {
            setStatus('stopped');
            setIsActive(false);
          }
        };

      } catch (err) {
        console.error('❌ Deepgram: Reconnection attempt failed:', err);
        attemptReconnect();
      }
    }, delay);
  }, [updateTranscript]);

  const startPreview = useCallback(async (
    meetingId: string,
    externalStream?: MediaStream,
    options?: { preserveTranscript?: boolean }
  ) => {
    // Store the external stream for reconnection
    lastExternalStreamRef.current = externalStream;
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
      intentionalStopRef.current = false;
      reconnectAttemptsRef.current = 0;
      setReconnectAttempts(0);

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

            // Start keepalive ping to detect dead connections early (critical for iOS)
            if (keepaliveIntervalRef.current) clearInterval(keepaliveIntervalRef.current);
            keepaliveIntervalRef.current = setInterval(() => {
              if (wsRef.current?.readyState === WebSocket.OPEN) {
                try {
                  wsRef.current.send(JSON.stringify({ type: 'keepalive' }));
                } catch {
                  console.warn('🔌 Deepgram: Keepalive send failed, connection may be dead');
                  attemptReconnect();
                }
              } else if (wsRef.current?.readyState !== WebSocket.CONNECTING) {
                console.warn('🔌 Deepgram: WebSocket not open during keepalive check, reconnecting...');
                attemptReconnect();
              }
            }, KEEPALIVE_INTERVAL_MS);

            // Start PCM audio capture using existing utility (use external stream if available)
            try {
              pcmStreamRef.current = await createPcmStream((pcmBuffer) => {
                if (wsRef.current?.readyState === WebSocket.OPEN) {
                  wsRef.current.send(pcmBuffer);
                }
              }, externalStream);
              console.log('✅ Deepgram: PCM audio capture started', externalStream ? '(external stream)' : '(mic)');
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
            // Server-side edge function timed out or Deepgram dropped the connection.
            // If we didn't intentionally stop, treat this as a reconnectable event
            // rather than a terminal state — prevents the 24-min gap bug.
            if (!intentionalStopRef.current && meetingIdRef.current) {
              console.log('🔌 Deepgram: Session terminated by server — reconnecting...');
              cleanup();
              attemptReconnect();
            } else {
              console.log('🔌 Deepgram: Session terminated (intentional stop)');
              setIsActive(false);
              setStatus('stopped');
            }
            return;
          }

        } catch (parseError) {
          console.error('❌ Deepgram: Parse error:', parseError);
        }
      };

      wsRef.current.onerror = (err) => {
        console.error('❌ Deepgram: WebSocket error:', err);
        setError('WebSocket connection error');
        // Don't set status to error immediately — let onclose handle reconnection
      };

      wsRef.current.onclose = (event) => {
        console.log('🔌 Deepgram: WebSocket closed', event.code, event.reason);

        // Clear keepalive
        if (keepaliveIntervalRef.current) {
          clearInterval(keepaliveIntervalRef.current);
          keepaliveIntervalRef.current = null;
        }

        // Don't trigger reconnect if this was an intentional stop
        if (intentionalStopRef.current) {
          setStatus('stopped');
          setIsActive(false);
          cleanup();
          return;
        }

        // Reconnect on ANY unexpected close (including code 1000 from server-side
        // edge function timeout or idle shutdown) as long as we have an active meeting.
        if (meetingIdRef.current) {
          const reason = event.code === 1000 ? 'clean close (server timeout)' : `unexpected (${event.code})`;
          console.log(`🔄 Deepgram: ${reason} disconnection, attempting reconnect...`);
          attemptReconnect();
        } else {
          setStatus('stopped');
          setIsActive(false);
          cleanup();
        }
      };

    } catch (err) {
      console.error('❌ Deepgram: Failed to start:', err);
      setError(err instanceof Error ? err.message : 'Failed to start');
      setStatus('error');
      setIsActive(false);
      cleanup();
    }
  }, [isActive, updateTranscript, cleanup, attemptReconnect]);

  const stopPreview = useCallback(() => {
    console.log('🛑 Deepgram: Stopping preview...');
    intentionalStopRef.current = true;
    
    // Clear any pending reconnect
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

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
    reconnectAttemptsRef.current = 0;
    setReconnectAttempts(0);
  }, []);

  // Visibility change listener — reconnect when page resumes from background (all devices)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      if (intentionalStopRef.current || !meetingIdRef.current) return;

      // Page just came back to foreground — check if WebSocket is dead
      const ws = wsRef.current;
      const isDead = !ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING;

      if (isDead) {
        console.log('📡 Deepgram: Page resumed from background, WebSocket dead — reconnecting...');
        // Reset reconnect counter so we get fresh attempts after resume
        reconnectAttemptsRef.current = 0;
        setReconnectAttempts(0);
        attemptReconnect();
      } else {
        console.log('📡 Deepgram: Page resumed, WebSocket still alive ✅');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [attemptReconnect]);

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
    reconnectAttempts,
    startPreview,
    stopPreview,
    clearTranscript
  };
};
