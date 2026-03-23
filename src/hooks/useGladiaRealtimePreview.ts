import { useState, useRef, useCallback, useEffect } from "react";
import { createPcmStream } from "@/lib/audio/pcm16";
import { supabase } from "@/integrations/supabase/client";

export type GladiaPreviewStatus = 'idle' | 'connecting' | 'connected' | 'recording' | 'reconnecting' | 'error' | 'stopped';

interface UseGladiaRealtimePreviewReturn {
  liveTranscript: string;
  fullTranscript: string;
  status: GladiaPreviewStatus;
  isActive: boolean;
  error: string | null;
  reconnectAttempts: number;
  startPreview: (meetingId: string, externalStream?: MediaStream, options?: { preserveTranscript?: boolean }) => Promise<void>;
  stopPreview: () => void;
  clearTranscript: () => void;
}

const MAX_WORDS = 100;
const MAX_RECONNECT_ATTEMPTS = 6;
const INITIAL_RECONNECT_DELAY = 1500;
const MAX_RECONNECT_DELAY = 30000;

export const useGladiaRealtimePreview = (): UseGladiaRealtimePreviewReturn => {
  const [liveTranscript, setLiveTranscript] = useState<string>("");
  const [fullTranscript, setFullTranscript] = useState<string>("");
  const [status, setStatus] = useState<GladiaPreviewStatus>('idle');
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const pcmStreamRef = useRef<{ stop: () => void } | null>(null);
  const meetingIdRef = useRef<string | null>(null);
  const lastExternalStreamRef = useRef<MediaStream | undefined>(undefined);
  const intentionalStopRef = useRef<boolean>(false);
  const reconnectAttemptsRef = useRef<number>(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const baseTranscriptRef = useRef<string>("");

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
  }, []);

  const updateTranscript = useCallback((text: string, isFinal: boolean) => {
    if (!text.trim()) return;

    console.log(`🎤 Gladia ${isFinal ? 'FINAL' : 'partial'}: "${text.substring(0, 50)}..."`);

    if (isFinal) {
      baseTranscriptRef.current = (baseTranscriptRef.current + ' ' + text).trim();
      setFullTranscript(baseTranscriptRef.current);
      const words = baseTranscriptRef.current.split(/\s+/).slice(-MAX_WORDS);
      setLiveTranscript(words.join(' '));
    } else {
      const combined = (baseTranscriptRef.current + ' ' + text).trim();
      const words = combined.split(/\s+/).slice(-MAX_WORDS);
      setLiveTranscript(words.join(' '));
    }
  }, []);

  const connectWebSocket = useCallback(async (meetingId: string, externalStream?: MediaStream) => {
    const wsUrl = `wss://dphcnbricafkbtizkoal.supabase.co/functions/v1/gladia-streaming`;
    console.log('📡 Gladia: Connecting to WebSocket:', wsUrl);

    wsRef.current = new WebSocket(wsUrl);
    wsRef.current.binaryType = 'arraybuffer';

    wsRef.current.onopen = () => {
      console.log('✅ Gladia: WebSocket connected');
      setStatus('connected');
      reconnectAttemptsRef.current = 0;
      setReconnectAttempts(0);
      setError(null);

      // Send session start — the edge function will init the Gladia v2 session
      wsRef.current?.send(JSON.stringify({ type: 'session.start' }));
    };

    wsRef.current.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'error') {
          const errMsg = data.error || 'Gladia error';
          // Treat proxy closes as transient
          if (/closed\s*\(\d+\)/i.test(String(errMsg))) {
            console.warn(`⚠️ Gladia transient error: ${errMsg}`);
            return;
          }
          console.error('❌ Gladia error:', errMsg);
          setError(`Gladia: ${errMsg}`);
          return;
        }

        if (data.type === 'session.started' || data.type === 'ready') {
          console.log('🎙️ Gladia: Session ready, starting audio capture');
          setStatus('recording');
          setIsActive(true);

          try {
            pcmStreamRef.current = await createPcmStream((pcmBuffer) => {
              if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(pcmBuffer);
              }
            }, externalStream);
            console.log('✅ Gladia: PCM audio capture started', externalStream ? '(external stream)' : '(mic)');
          } catch (audioError) {
            console.error('❌ Gladia: Audio capture failed:', audioError);
            setError('Audio capture failed');
          }
          return;
        }

        if (data.type === 'transcript') {
          const text = data.text || data.transcript || '';
          const isFinal = data.is_final ?? true;
          if (text.trim()) {
            updateTranscript(text.trim(), isFinal);
          }
          return;
        }

        if (data.type === 'session_terminated') {
          console.log('🔌 Gladia: Session terminated');
          if (!intentionalStopRef.current) {
            attemptReconnect();
          }
          return;
        }
      } catch (parseError) {
        console.error('❌ Gladia: Parse error:', parseError);
      }
    };

    wsRef.current.onerror = (err) => {
      console.error('❌ Gladia: WebSocket error:', err);
      if (!intentionalStopRef.current) {
        attemptReconnect();
      }
    };

    wsRef.current.onclose = (event) => {
      console.log('🔌 Gladia: WebSocket closed', event.code, event.reason);
      if (!intentionalStopRef.current && event.code !== 1000) {
        attemptReconnect();
      } else {
        setStatus('stopped');
        setIsActive(false);
      }
    };
  }, [updateTranscript]);

  const attemptReconnect = useCallback(() => {
    if (intentionalStopRef.current) return;
    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      console.error('❌ Gladia: Max reconnect attempts reached');
      setError(`Connection lost after ${MAX_RECONNECT_ATTEMPTS} attempts`);
      setStatus('error');
      setIsActive(false);
      return;
    }

    reconnectAttemptsRef.current += 1;
    setReconnectAttempts(reconnectAttemptsRef.current);

    const delay = Math.min(
      INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttemptsRef.current - 1) + Math.random() * 500,
      MAX_RECONNECT_DELAY
    );

    console.log(`🔄 Gladia: Reconnecting in ${Math.round(delay)}ms (attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})`);
    setStatus('reconnecting');

    // Clean up old connection
    if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    if (pcmStreamRef.current) { pcmStreamRef.current.stop(); pcmStreamRef.current = null; }

    reconnectTimeoutRef.current = setTimeout(() => {
      const mid = meetingIdRef.current;
      if (mid) connectWebSocket(mid, lastExternalStreamRef.current);
    }, delay);
  }, [connectWebSocket]);

  const startPreview = useCallback(async (
    meetingId: string,
    externalStream?: MediaStream,
    options?: { preserveTranscript?: boolean }
  ) => {
    lastExternalStreamRef.current = externalStream;
    const { preserveTranscript = false } = options || {};

    if (wsRef.current || isActive) {
      console.log('🎤 Gladia: Preview already active');
      return;
    }

    setStatus('connecting');
    setError(null);
    meetingIdRef.current = meetingId;
    intentionalStopRef.current = false;
    reconnectAttemptsRef.current = 0;
    setReconnectAttempts(0);

    if (!preserveTranscript) {
      setLiveTranscript("");
      setFullTranscript("");
      baseTranscriptRef.current = "";
    }

    await connectWebSocket(meetingId, externalStream);
  }, [isActive, connectWebSocket]);

  const stopPreview = useCallback(() => {
    console.log('⏹ Gladia: Stopping preview');
    intentionalStopRef.current = true;

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({ type: 'session.end' }));
      } catch { /* ignore */ }
    }

    cleanup();
    setIsActive(false);
    setStatus('stopped');
  }, [cleanup]);

  const clearTranscript = useCallback(() => {
    setLiveTranscript("");
    setFullTranscript("");
    baseTranscriptRef.current = "";
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      intentionalStopRef.current = true;
      cleanup();
    };
  }, [cleanup]);

  return {
    liveTranscript,
    fullTranscript,
    status,
    isActive,
    error,
    reconnectAttempts,
    startPreview,
    stopPreview,
    clearTranscript,
  };
};
