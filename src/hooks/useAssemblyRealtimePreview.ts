import { useState, useRef, useCallback, useEffect } from "react";
import { AssemblyRealtimeClient } from "@/lib/assembly-realtime";

export type PreviewStatus = 'idle' | 'connecting' | 'connected' | 'recording' | 'reconnecting' | 'error' | 'stopped';

interface UseAssemblyRealtimePreviewReturn {
  liveTranscript: string;
  fullTranscript: string;
  status: PreviewStatus;
  isActive: boolean;
  error: string | null;
  reconnectAttempts: number;
  startPreview: (externalStream?: MediaStream, options?: { preserveTranscript?: boolean }) => Promise<void>;
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
  const [status, setStatus] = useState<PreviewStatus>('idle');
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  const clientRef = useRef<AssemblyRealtimeClient | null>(null);
  const intentionalStopRef = useRef<boolean>(false);
  const reconnectAttemptsRef = useRef<number>(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastExternalStreamRef = useRef<MediaStream | null>(null);

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

  // Update transcripts - rolling for live preview, full accumulation for tab
  const updateTranscript = useCallback((newText: string, isFinal: boolean) => {
    if (!newText.trim()) return;

    console.log(`🎤 AssemblyAI ${isFinal ? 'FINAL' : 'partial'}: "${newText.substring(0, 50)}..."`);

    if (isFinal) {
      const now = Date.now();

      if (shouldReplaceLastFinal(newText)) {
        // Replace the last final segment (AssemblyAI often sends a formatted final after a raw final)
        const prevSeg = lastFinalSegmentRef.current;

        setFullTranscript((prev) => replaceTrailingSegment(prev, prevSeg, newText));
        baseTranscriptRef.current = replaceTrailingSegment(baseTranscriptRef.current, prevSeg, newText);

        console.log('🔁 Replaced duplicate final segment instead of appending');
      } else {
        // Append brand new final segment
        setFullTranscript((prev) => (prev + ' ' + newText).trim());
        baseTranscriptRef.current = (baseTranscriptRef.current + ' ' + newText).trim();
      }

      lastFinalSegmentRef.current = newText;
      lastFinalAtRef.current = now;

      // Clear partial
      currentPartialRef.current = "";

      // Update live preview with base only (no partial pending)
      const words = baseTranscriptRef.current.split(/\s+/).slice(-MAX_WORDS);
      setLiveTranscript(words.join(' '));
      return;
    }

    // Partial - replace the current partial (don't accumulate partials)
    currentPartialRef.current = newText;

    // Live preview = base + current partial
    const combined = (baseTranscriptRef.current + ' ' + newText).trim();
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

        const stream = lastExternalStreamRef.current;

        console.log('📡 AssemblyAI: Attempting reconnection...');

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

            if (intentionalStopRef.current || code === 1000) {
              setStatus('stopped');
              setIsActive(false);
              return;
            }

            // Unexpected close - try again
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
    options?: { preserveTranscript?: boolean }
  ) => {
    const { preserveTranscript = false } = options || {};
    
    if (clientRef.current || isActive) {
      console.log('🎤 Preview already active, skipping start');
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

          // Normal stop (we initiated termination)
          if (intentionalStopRef.current || code === 1000) {
            setStatus('stopped');
            return;
          }

          // Unexpected disconnection - attempt auto-reconnect
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
  }, [isActive, updateTranscript, attemptReconnect]);

  const stopPreview = useCallback(() => {
    console.log('🛑 Stopping AssemblyAI preview...');
    intentionalStopRef.current = true;

    // Clear any pending reconnect
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
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
    baseTranscriptRef.current = "";
    currentPartialRef.current = "";
    lastFinalSegmentRef.current = "";
    lastFinalAtRef.current = 0;
    setError(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      intentionalStopRef.current = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
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
    status,
    isActive,
    error,
    reconnectAttempts,
    startPreview,
    stopPreview,
    clearTranscript
  };
};
