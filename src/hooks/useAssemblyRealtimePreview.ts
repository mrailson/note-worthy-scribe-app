import { useState, useRef, useCallback, useEffect } from "react";
import { AssemblyRealtimeClient } from "@/lib/assembly-realtime";

export type PreviewStatus = 'idle' | 'connecting' | 'connected' | 'recording' | 'error' | 'stopped';

interface UseAssemblyRealtimePreviewReturn {
  liveTranscript: string;
  status: PreviewStatus;
  isActive: boolean;
  error: string | null;
  startPreview: () => Promise<void>;
  stopPreview: () => void;
}

const MAX_WORDS = 100; // Keep last 100 words to prevent memory bloat

export const useAssemblyRealtimePreview = (): UseAssemblyRealtimePreviewReturn => {
  const [liveTranscript, setLiveTranscript] = useState<string>("");
  const [status, setStatus] = useState<PreviewStatus>('idle');
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const clientRef = useRef<AssemblyRealtimeClient | null>(null);

  // Rolling transcript update - keeps only last N words
  const updateTranscript = useCallback((newText: string, isFinal: boolean) => {
    if (!newText.trim()) return;
    
    setLiveTranscript(prev => {
      if (isFinal) {
        // For final transcripts, append and trim to max words
        const combined = (prev + ' ' + newText).trim();
        const words = combined.split(/\s+/);
        return words.slice(-MAX_WORDS).join(' ');
      } else {
        // For partial transcripts, replace the last partial segment
        // Find the last final segment and append the partial
        const words = prev.split(/\s+/).slice(-MAX_WORDS);
        return words.join(' ') + (prev ? ' ' : '') + newText;
      }
    });
  }, []);

  const startPreview = useCallback(async () => {
    if (clientRef.current || isActive) {
      console.log('🎤 Preview already active, skipping start');
      return;
    }

    try {
      setStatus('connecting');
      setError(null);
      setLiveTranscript("");
      
      console.log('🎤 Starting AssemblyAI real-time preview...');
      
      clientRef.current = new AssemblyRealtimeClient({
        onOpen: () => {
          console.log('✅ AssemblyAI preview connected');
          setStatus('recording');
          setIsActive(true);
        },
        onPartial: (text: string) => {
          // Partial transcripts - real-time feedback
          updateTranscript(text, false);
        },
        onFinal: (text: string) => {
          // Final transcripts - confirmed text
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
        }
      });

      await clientRef.current.start();
      
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
    status,
    isActive,
    error,
    startPreview,
    stopPreview
  };
};
