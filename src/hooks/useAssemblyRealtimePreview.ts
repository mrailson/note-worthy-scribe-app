import { useState, useRef, useCallback, useEffect } from "react";
import { AssemblyRealtimeClient } from "@/lib/assembly-realtime";
import { supabase } from "@/integrations/supabase/client";

export type PreviewStatus = 'idle' | 'connecting' | 'connected' | 'recording' | 'reconnecting' | 'error' | 'stopped';

const MAX_RECENT_FINALS = 4;
const MAX_WORDS = 100;

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

export const useAssemblyRealtimePreview = (): UseAssemblyRealtimePreviewReturn => {
  const [liveTranscript, setLiveTranscript] = useState<string>("");
  const [fullTranscript, setFullTranscript] = useState<string>("");
  const [recentFinals, setRecentFinals] = useState<string[]>([]);
  const [currentPartial, setCurrentPartial] = useState<string>("");
  const [status, setStatus] = useState<PreviewStatus>('idle');
  const [isActive, _setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setIsActive = useCallback((v: boolean) => { isActiveRef.current = v; _setIsActive(v); }, []);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  const clientRef = useRef<AssemblyRealtimeClient | null>(null);
  const intentionalStopRef = useRef<boolean>(false);
  const isActiveRef = useRef<boolean>(false);
  const partialFallbackTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Track the base text (all confirmed finals) and current partial separately.
  const baseTranscriptRef = useRef<string>("");
  const currentPartialRef = useRef<string>("");

  // Update transcripts — partials REPLACE preview, finals ALWAYS APPEND
  const updateTranscript = useCallback((newText: string, isFinal: boolean) => {
    if (!newText.trim()) return;

    console.log(`🎤 AssemblyAI ${isFinal ? 'FINAL' : 'partial'}: "${newText.substring(0, 50)}..."`);

    if (isFinal) {
      if (partialFallbackTimerRef.current) { clearTimeout(partialFallbackTimerRef.current); partialFallbackTimerRef.current = null; }

      baseTranscriptRef.current = (baseTranscriptRef.current + ' ' + newText).trim();
      setFullTranscript(baseTranscriptRef.current);

      setRecentFinals(prev => [...prev, newText].slice(-MAX_RECENT_FINALS));

      currentPartialRef.current = "";
      setCurrentPartial("");

      const words = baseTranscriptRef.current.split(/\s+/).slice(-MAX_WORDS);
      setLiveTranscript(words.join(' '));
      return;
    }

    // PARTIAL: replace preview string (not appended to transcript)
    currentPartialRef.current = newText;
    setCurrentPartial(newText);

    const combined = (baseTranscriptRef.current + ' ' + newText).trim();
    setFullTranscript(combined);

    const words = combined.split(/\s+/).slice(-MAX_WORDS);
    setLiveTranscript(words.join(' '));
  }, []);

  const startPreview = useCallback(async (
    externalStream?: MediaStream,
    options?: { preserveTranscript?: boolean; keyterms?: string[] }
  ) => {
    const { preserveTranscript = false, keyterms = [] } = options || {};
    
    if (clientRef.current || isActiveRef.current) {
      console.log('🎤 AssemblyAI preview already active, skipping duplicate start');
      return;
    }

    try {
      setStatus('connecting');
      setError(null);
      intentionalStopRef.current = false;
      setReconnectAttempts(0);

      if (!preserveTranscript) {
        setLiveTranscript("");
        setFullTranscript("");
        setRecentFinals([]);
        setCurrentPartial("");
        baseTranscriptRef.current = "";
        currentPartialRef.current = "";
        console.log('🎤 Starting fresh AssemblyAI preview (transcripts cleared)');
      } else {
        currentPartialRef.current = "";
        console.log('🎤 Resuming AssemblyAI preview (preserving existing transcript)');
      }
      
      console.log('🎤 Starting AssemblyAI real-time preview...', 
        externalStream ? '(with external stream)' : '(mic only)');
      
      // Create a SINGLE client — let its internal reconnect own the lifecycle
      clientRef.current = new AssemblyRealtimeClient({
        onOpen: () => {
          console.log('✅ AssemblyAI preview WebSocket connected');
          setStatus('recording');
          setIsActive(true);
          setError(null);
        },
        onPartial: (text: string) => {
          updateTranscript(text, false);
        },
        onFinal: (text: string) => {
          updateTranscript(text, true);
        },
        onClose: (code: number, reason: string) => {
          // This only fires when the client has exhausted its internal reconnect
          // attempts, OR on a manual stop. No hook-level reconnect needed.
          console.log('🔌 AssemblyAI preview closed (final)', { code, reason });
          setIsActive(false);

          if (intentionalStopRef.current) {
            setStatus('stopped');
            return;
          }

          // Client exhausted its retries — surface as error
          const msg = `AssemblyAI disconnected (${code || 0})${reason ? `: ${reason}` : ''}`;
          console.warn(`⚠️ ${msg}`);
          setError(msg);
          setStatus('error');
        },
        onError: (err: Error) => {
          // Only fires for fatal errors (client exhausted retries or non-transient)
          console.error('❌ AssemblyAI preview error:', err);
          setError(err.message);

          if (intentionalStopRef.current) {
            setStatus('error');
            setIsActive(false);
          }
          // Don't set status to error for transient issues — client handles reconnect
        },
        onReconnecting: () => {
          console.log('🔄 AssemblyAI preview reconnecting (client-internal)...');
          setStatus('reconnecting');
          setReconnectAttempts(prev => prev + 1);
        },
        onReconnected: () => {
          console.log('✅ AssemblyAI preview reconnected (client-internal)');
          setStatus('recording');
          setIsActive(true);
          setReconnectAttempts(0);
          setError(null);
        }
      });

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

      try {
        clientRef.current?.stop();
      } catch {
        // ignore
      }
      clientRef.current = null;
    }
  }, [updateTranscript, setIsActive]);

  const stopPreview = useCallback(() => {
    console.log('🛑 Stopping AssemblyAI preview...');
    intentionalStopRef.current = true;

    if (partialFallbackTimerRef.current) {
      clearTimeout(partialFallbackTimerRef.current);
      partialFallbackTimerRef.current = null;
    }
    
    if (clientRef.current) {
      clientRef.current.stop();
      clientRef.current = null;
    }
    
    setStatus('stopped');
    setIsActive(false);
  }, []);

  const clearTranscript = useCallback(() => {
    console.log('🧹 Clearing AssemblyAI transcript state');
    setLiveTranscript("");
    setFullTranscript("");
    setRecentFinals([]);
    setCurrentPartial("");
    baseTranscriptRef.current = "";
    currentPartialRef.current = "";
    setError(null);
  }, []);

  // SAFETY NET: Periodically flush fullTranscript to meetings.assembly_ai_transcript
  const lastBackupRef = useRef<string>("");
  const backupIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isActive) {
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
