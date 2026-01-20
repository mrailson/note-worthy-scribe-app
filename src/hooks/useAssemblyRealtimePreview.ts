import { useState, useRef, useCallback, useEffect } from "react";
import { AssemblyRealtimeClient } from "@/lib/assembly-realtime";

export type PreviewStatus = 'idle' | 'connecting' | 'connected' | 'recording' | 'error' | 'stopped';

interface UseAssemblyRealtimePreviewReturn {
  liveTranscript: string;
  fullTranscript: string;
  status: PreviewStatus;
  isActive: boolean;
  error: string | null;
  startPreview: (externalStream?: MediaStream, options?: { preserveTranscript?: boolean }) => Promise<void>;
  stopPreview: () => void;
}

const MAX_WORDS = 100; // Keep last 100 words for live preview

export const useAssemblyRealtimePreview = (): UseAssemblyRealtimePreviewReturn => {
  const [liveTranscript, setLiveTranscript] = useState<string>("");
  const [fullTranscript, setFullTranscript] = useState<string>("");
  const [status, setStatus] = useState<PreviewStatus>('idle');
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientRef = useRef<AssemblyRealtimeClient | null>(null);

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
        onClose: () => {
          console.log('🔌 AssemblyAI preview closed');
          setStatus('stopped');
          setIsActive(false);
        },
        onError: (err: Error) => {
          console.error('❌ AssemblyAI preview error:', err);
          setError(err.message);
          setStatus('error');
          setIsActive(false);
        },
        onReconnecting: () => {
          console.log('🔄 AssemblyAI preview reconnecting...');
          setStatus('connecting');
        },
        onReconnected: () => {
          console.log('✅ AssemblyAI preview reconnected');
          setStatus('recording');
        }
      });

      await clientRef.current.start(externalStream);
      console.log('🎤 AssemblyAI client started successfully');
      
    } catch (err) {
      console.error('❌ Failed to start AssemblyAI preview:', err);
      setError(err instanceof Error ? err.message : 'Failed to start preview');
      setStatus('error');
      setIsActive(false);
      clientRef.current = null;
    }
  }, [isActive, updateTranscript]);

  const stopPreview = useCallback(() => {
    console.log('🛑 Stopping AssemblyAI preview...');
    
    if (clientRef.current) {
      clientRef.current.stop();
      clientRef.current = null;
    }
    
    setStatus('stopped');
    setIsActive(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
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
    startPreview,
    stopPreview
  };
};
