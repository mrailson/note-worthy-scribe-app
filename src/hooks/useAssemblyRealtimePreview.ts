import { useState, useRef, useCallback, useEffect } from "react";
import { AssemblyRealtimeClient } from "@/lib/assembly-realtime";

export type PreviewStatus = 'idle' | 'connecting' | 'connected' | 'recording' | 'error' | 'stopped';

interface UseAssemblyRealtimePreviewReturn {
  liveTranscript: string;
  fullTranscript: string;
  status: PreviewStatus;
  isActive: boolean;
  error: string | null;
  startPreview: () => Promise<void>;
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
  // Track the base text (all confirmed finals) and current partial separately
  const baseTranscriptRef = useRef<string>("");
  const currentPartialRef = useRef<string>("");

  // Update transcripts - rolling for live preview, full accumulation for tab
  const updateTranscript = useCallback((newText: string, isFinal: boolean) => {
    if (!newText.trim()) return;
    
    console.log(`🎤 AssemblyAI ${isFinal ? 'FINAL' : 'partial'}: "${newText.substring(0, 50)}..."`);
    
    if (isFinal) {
      // Append final to full transcript
      setFullTranscript(prev => (prev + ' ' + newText).trim());
      
      // Append final to base transcript and clear partial
      baseTranscriptRef.current = (baseTranscriptRef.current + ' ' + newText).trim();
      currentPartialRef.current = "";
      
      // Update live preview with base only (no partial pending)
      const words = baseTranscriptRef.current.split(/\s+/).slice(-MAX_WORDS);
      setLiveTranscript(words.join(' '));
    } else {
      // Replace the current partial (don't accumulate partials)
      currentPartialRef.current = newText;
      
      // Live preview = base + current partial
      const combined = (baseTranscriptRef.current + ' ' + newText).trim();
      const words = combined.split(/\s+/).slice(-MAX_WORDS);
      setLiveTranscript(words.join(' '));
    }
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
      setFullTranscript("");
      baseTranscriptRef.current = "";
      currentPartialRef.current = "";
      
      console.log('🎤 Starting AssemblyAI real-time preview...');
      
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
        }
      });

      await clientRef.current.start();
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
