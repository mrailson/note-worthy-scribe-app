import { useState, useRef, useCallback, useEffect } from "react";
import { AssemblyRealtimeClient } from "@/lib/assembly-realtime";
import { detectDevice } from "@/utils/DeviceDetection";
import { supabase } from "@/integrations/supabase/client";

export type PreviewStatus = 'idle' | 'connecting' | 'connected' | 'recording' | 'reconnecting' | 'error' | 'stopped';

const MAX_RECENT_FINALS = 4;

interface UseAssemblyRealtimePreviewReturn {
  liveTranscript: string;
  fullTranscript: string;
  recentFinals: string[];
  currentPartial: string;
  status: PreviewStatus;
  isActive: boolean;
  error: string | null;
  reconnectAttempts: number;
  startPreview: (externalStream?: MediaStream, options?: { preserveTranscript?: boolean; keyterms?: string[] }) => Promise<void>;
  stopPreview: () => void;
  clearTranscript: () => void;
}

const MAX_WORDS = 100; // Keep last 100 words for live preview
const MAX_RECONNECT_ATTEMPTS = 5;
const INITIAL_RECONNECT_DELAY = 1000; // 1 second
const MAX_RECONNECT_DELAY = 30000; // 30 seconds

export const useAssemblyRealtimePreview = (): UseAssemblyRealtimePreviewReturn => {
  const [liveTranscript, setLiveTranscript] = useState<string>("");
  const [fullTranscript, setFullTranscript] = useState<string>("");
  const [recentFinals, setRecentFinals] = useState<string[]>([]);
  const [currentPartial, setCurrentPartial] = useState<string>("");
  const [status, setStatus] = useState<PreviewStatus>('idle');
  const [isActive, _setIsActive] = useState(false);
  const setIsActive = useCallback((v: boolean) => { isActiveRef.current = v; _setIsActive(v); }, []);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  const clientRef = useRef<AssemblyRealtimeClient | null>(null);
  const intentionalStopRef = useRef<boolean>(false);
  const isActiveRef = useRef<boolean>(false); // ref mirror of isActive for sync checks
  const reconnectAttemptsRef = useRef<number>(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastExternalStreamRef = useRef<MediaStream | null>(null);
  const partialFallbackTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Track the base text (all confirmed finals) and current partial separately.
  // NOTE: AssemblyAI v3 can emit *two* final turns for the same utterance
  // (e.g. raw + formatted), so we also track the last final segment to replace
  // rather than append when that happens.
  const baseTranscriptRef = useRef<string>("");
  const currentPartialRef = useRef<string>("");
  const lastFinalSegmentRef = useRef<string>("");
  const lastFinalAtRef = useRef<number>(0);

  const normalise = (t: string) =>
    t
      .toLowerCase()
      // remove punctuation/case differences so we can detect duplicate finals
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

  // Update transcripts - rolling for live preview, with partials surfaced in the main transcript view
  const updateTranscript = useCallback((newText: string, isFinal: boolean) => {
    if (!newText.trim()) return;

    console.log(`🎤 AssemblyAI ${isFinal ? 'FINAL' : 'partial'}: "${newText.substring(0, 50)}..."`);

    if (isFinal) {
      // Clear the partial fallback timer since we got a proper final
      if (partialFallbackTimerRef.current) { clearTimeout(partialFallbackTimerRef.current); partialFallbackTimerRef.current = null; }
      const now = Date.now();

      if (shouldReplaceLastFinal(newText)) {
        const prevSeg = lastFinalSegmentRef.current;
        const replaced = replaceTrailingSegment(baseTranscriptRef.current, prevSeg, newText);

        baseTranscriptRef.current = replaced;
        setFullTranscript(replaced);
        // Replace last entry in recentFinals
        setRecentFinals(prev => {
          const updated = [...prev];
          if (updated.length > 0) updated[updated.length - 1] = newText;
          else updated.push(newText);
          return updated.slice(-MAX_RECENT_FINALS);
        });
        console.log('🔁 Replaced duplicate final segment instead of appending');
      } else {
        baseTranscriptRef.current = (baseTranscriptRef.current + ' ' + newText).trim();
        setFullTranscript(baseTranscriptRef.current);
        // Add to rolling buffer of recent finals
        setRecentFinals(prev => [...prev, newText].slice(-MAX_RECENT_FINALS));
      }

      lastFinalSegmentRef.current = newText;
      lastFinalAtRef.current = now;
      currentPartialRef.current = "";
      setCurrentPartial("");

      const words = baseTranscriptRef.current.split(/\s+/).slice(-MAX_WORDS);
      setLiveTranscript(words.join(' '));
      return;
    }

    currentPartialRef.current = newText;
    setCurrentPartial(newText);

    // NOTE: Turn-based commit logic (turn_order tracking + 30s absolute timer)
    // is now handled inside AssemblyRealtimeClient itself, so no fallback timer here.

    const combined = (baseTranscriptRef.current + ' ' + newText).trim();
    setFullTranscript(combined);

    const words = combined.split(/\s+/).slice(-MAX_WORDS);
    setLiveTranscript(words.join(' '));
  }, []);

  // Internal reconnect function with exponential backoff
  const attemptReconnect = useCallback(async () => {
    if (intentionalStopRef.current) {
      console.log('🔌 AssemblyAI: Skipping reconnect - intentional stop');
      return;
    }

    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      console.error('❌ AssemblyAI: Max reconnection attempts reached');
      setError(`Connection lost after ${MAX_RECONNECT_ATTEMPTS} reconnection attempts`);
      setStatus('error');
      setIsActive(false);
      return;
    }

    reconnectAttemptsRef.current += 1;
    setReconnectAttempts(reconnectAttemptsRef.current);

    // Exponential backoff with jitter
    const delay = Math.min(
      INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttemptsRef.current - 1) + Math.random() * 500,
      MAX_RECONNECT_DELAY
    );

    console.log(`🔄 AssemblyAI: Reconnecting in ${Math.round(delay)}ms (attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})`);
    setStatus('reconnecting');
    setError(null);

    reconnectTimeoutRef.current = setTimeout(async () => {
      try {
        // Clean up old client
        if (clientRef.current) {
          try { clientRef.current.stop(); } catch { /* ignore */ }
          clientRef.current = null;
        }

        let stream = lastExternalStreamRef.current;
        // Validate stream tracks are still alive
        if (stream) {
          const activeTracks = stream.getAudioTracks().filter(t => t.readyState === 'live');
          if (activeTracks.length === 0) {
            console.warn('⚠️ AssemblyAI: Stored stream tracks ended — will capture fresh mic');
            lastExternalStreamRef.current = null;
            stream = null;
          }
        }

        console.log('📡 AssemblyAI: Attempting reconnection...', stream ? '(reusing stream)' : '(fresh mic)');

        clientRef.current = new AssemblyRealtimeClient({
          onOpen: () => {
            console.log('✅ AssemblyAI: WebSocket reconnected');
            setStatus('recording');
            setIsActive(true);
            reconnectAttemptsRef.current = 0;
            setReconnectAttempts(0);
            setError(null);
          },
          onPartial: (text: string) => {
            updateTranscript(text, false);
          },
          onFinal: (text: string) => {
            updateTranscript(text, true);
          },
          onClose: (code: number, reason: string) => {
            console.log('🔌 AssemblyAI: WebSocket closed during/after reconnect', { code, reason });

            if (intentionalStopRef.current) {
              setStatus('stopped');
              setIsActive(false);
              return;
            }

            // Any unexpected close (including 1000) triggers reconnect
            attemptReconnect();
          },
          onError: (err: Error) => {
            console.error('❌ AssemblyAI: Error during reconnect:', err);
            attemptReconnect();
          },
          onReconnecting: () => {
            console.log('🔄 AssemblyAI: Internal client reconnecting...');
            setStatus('reconnecting');
          },
          onReconnected: () => {
            console.log('✅ AssemblyAI: Internal client reconnected');
            setStatus('recording');
            reconnectAttemptsRef.current = 0;
            setReconnectAttempts(0);
          }
        });

        await clientRef.current.start(stream || undefined);
        console.log('🎤 AssemblyAI: Reconnection client started');

      } catch (err) {
        console.error('❌ AssemblyAI: Reconnection attempt failed:', err);
        attemptReconnect();
      }
    }, delay);
  }, [updateTranscript]);

  const startPreview = useCallback(async (
    externalStream?: MediaStream,
    options?: { preserveTranscript?: boolean; keyterms?: string[] }
  ) => {
    const { preserveTranscript = false, keyterms = [] } = options || {};
    
    // Use ref for sync check to avoid stale closure over isActive state
    if (clientRef.current || isActiveRef.current) {
      console.log('🎤 AssemblyAI preview already active, skipping duplicate start');
      return;
    }

    try {
      setStatus('connecting');
      setError(null);
      intentionalStopRef.current = false;
      reconnectAttemptsRef.current = 0;
      setReconnectAttempts(0);

      // Store the stream for reconnection
      if (externalStream) {
        lastExternalStreamRef.current = externalStream;
      }
      
      // Only clear transcripts if NOT preserving (i.e., fresh start)
      if (!preserveTranscript) {
        setLiveTranscript("");
        setFullTranscript("");
        setRecentFinals([]);
        setCurrentPartial("");
        baseTranscriptRef.current = "";
        currentPartialRef.current = "";
        lastFinalSegmentRef.current = "";
        lastFinalAtRef.current = 0;
        console.log('🎤 Starting fresh AssemblyAI preview (transcripts cleared)');
      } else {
        // Reset only partial tracking refs, keep accumulated text
        currentPartialRef.current = "";
        console.log('🎤 Resuming AssemblyAI preview (preserving existing transcript)');
      }
      
      console.log('🎤 Starting AssemblyAI real-time preview...', 
        externalStream ? '(with external stream)' : '(mic only)');
      
      clientRef.current = new AssemblyRealtimeClient({
        onOpen: () => {
          console.log('✅ AssemblyAI preview WebSocket connected');
          setStatus('recording');
          setIsActive(true);
        },
        onPartial: (text: string) => {
          updateTranscript(text, false);
        },
        onFinal: (text: string) => {
          updateTranscript(text, true);
        },
        onClose: (code: number, reason: string) => {
          console.log('🔌 AssemblyAI preview closed', { code, reason });
          setIsActive(false);

          // Only treat as intentional if WE initiated the stop
          if (intentionalStopRef.current) {
            setStatus('stopped');
            return;
          }

          // Any unexpected close (including code 1000 from server-side idle timeout
          // or token expiry) should trigger auto-reconnect
          const msg = `AssemblyAI disconnected (${code || 0})${reason ? `: ${reason}` : ''}`;
          console.warn(`⚠️ ${msg} - attempting auto-reconnect...`);
          setError(msg);
          attemptReconnect();
        },
        onError: (err: Error) => {
          console.error('❌ AssemblyAI preview error:', err);
          setError(err.message);
          setIsActive(false);

          // Attempt reconnect on error (unless intentionally stopped)
          if (!intentionalStopRef.current) {
            attemptReconnect();
          } else {
            setStatus('error');
          }
        },
        onReconnecting: () => {
          console.log('🔄 AssemblyAI preview reconnecting...');
          setStatus('reconnecting');
        },
        onReconnected: () => {
          console.log('✅ AssemblyAI preview reconnected');
          setStatus('recording');
          reconnectAttemptsRef.current = 0;
          setReconnectAttempts(0);
        }
      });

      // Set keyterms before starting
      if (keyterms.length > 0) {
        clientRef.current.setKeyterms(keyterms);
        console.log(`🔑 AssemblyAI: ${keyterms.length} keyterms configured`);
      }

      await clientRef.current.start(externalStream);
      console.log('🎤 AssemblyAI client started successfully');
      
    } catch (err) {
      console.error('❌ Failed to start AssemblyAI preview:', err);
      setError(err instanceof Error ? err.message : 'Failed to start preview');
      setStatus('error');
      setIsActive(false);

      // Ensure we fully clean up any half-open sockets/audio contexts.
      try {
        clientRef.current?.stop();
      } catch {
        // ignore
      }
      clientRef.current = null;
    }
  }, [updateTranscript, attemptReconnect, setIsActive]);

  const stopPreview = useCallback(() => {
    console.log('🛑 Stopping AssemblyAI preview...');
    intentionalStopRef.current = true;

    // Clear any pending reconnect and fallback timers
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (partialFallbackTimerRef.current) {
      clearTimeout(partialFallbackTimerRef.current);
      partialFallbackTimerRef.current = null;
    }
    
    if (clientRef.current) {
      clientRef.current.stop();
      clientRef.current = null;
    }
    
    lastExternalStreamRef.current = null;
    setStatus('stopped');
    setIsActive(false);
  }, []);

  // Clear all transcript state (for meeting reset)
  const clearTranscript = useCallback(() => {
    console.log('🧹 Clearing AssemblyAI transcript state');
    setLiveTranscript("");
    setFullTranscript("");
    setRecentFinals([]);
    setCurrentPartial("");
    baseTranscriptRef.current = "";
    currentPartialRef.current = "";
    lastFinalSegmentRef.current = "";
    lastFinalAtRef.current = 0;
    setError(null);
  }, []);

  // Visibility change listener — reconnect when page resumes from background
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      if (intentionalStopRef.current) return;
      
      // Only reconnect if we had an active session (stream was stored)
      if (!lastExternalStreamRef.current) return;

      const client = clientRef.current;
      const isAlive = client && isActive;

      if (!isAlive) {
        console.log('📡 AssemblyAI: Page resumed from background, connection dead — reconnecting...');
        reconnectAttemptsRef.current = 0;
        setReconnectAttempts(0);
        attemptReconnect();
      } else {
        console.log('📡 AssemblyAI: Page resumed, connection still alive ✅');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isActive, attemptReconnect]);

  // SAFETY NET: Periodically flush fullTranscript to meetings.live_transcript_backup
  // so that if all other DB write paths fail, there's a recoverable copy
  const lastBackupRef = useRef<string>("");
  const backupIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isActive) {
      // Start 30-second backup flush
      backupIntervalRef.current = setInterval(async () => {
        const currentText = baseTranscriptRef.current.trim();
        if (!currentText || currentText === lastBackupRef.current) return;

        const meetingId = sessionStorage.getItem('currentMeetingId');
        if (!meetingId) return;

        try {
          const { error: backupError } = await supabase
            .from('meetings')
            .update({ assembly_ai_transcript: currentText })
            .eq('id', meetingId);

          if (!backupError) {
            lastBackupRef.current = currentText;
            console.log(`💾 AssemblyAI backup flushed (${currentText.length} chars)`);
          }
        } catch (err) {
          console.warn('⚠️ AssemblyAI backup flush failed:', err);
        }
      }, 30000);
    }

    return () => {
      if (backupIntervalRef.current) {
        clearInterval(backupIntervalRef.current);
        backupIntervalRef.current = null;
      }
    };
  }, [isActive]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      intentionalStopRef.current = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (backupIntervalRef.current) {
        clearInterval(backupIntervalRef.current);
        backupIntervalRef.current = null;
      }
      if (clientRef.current) {
        clientRef.current.stop();
        clientRef.current = null;
      }
    };
  }, []);

  return {
    liveTranscript,
    fullTranscript,
    recentFinals,
    currentPartial,
    status,
    isActive,
    error,
    reconnectAttempts,
    startPreview,
    stopPreview,
    clearTranscript
  };
};
