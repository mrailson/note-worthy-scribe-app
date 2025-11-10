import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { AssemblyRealtimeClientWorklet } from '@/lib/assembly-realtime-worklet';
import { createContentHash } from '@/utils/transcriptDeduplication';

interface ComplaintMicRecorderV2Props {
  onTranscriptUpdate: (text: string) => void;
  disabled?: boolean;
  className?: string;
}

export const ComplaintMicRecorderV2: React.FC<ComplaintMicRecorderV2Props> = ({
  onTranscriptUpdate,
  disabled,
  className,
}) => {
  const clientRef = useRef<AssemblyRealtimeClientWorklet | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const lastFinalRef = useRef<string>('');
  const seenSetRef = useRef<Set<string>>(new Set());
  const seenOrderRef = useRef<string[]>([]);

  const addSeenHash = (hash: string) => {
    if (!seenSetRef.current.has(hash)) {
      seenSetRef.current.add(hash);
      seenOrderRef.current.push(hash);
      if (seenOrderRef.current.length > 10) {
        const old = seenOrderRef.current.shift();
        if (old) seenSetRef.current.delete(old);
      }
    }
  };

  const start = async () => {
    if (disabled || isConnecting || isRecording) return;
    console.log('[V2 Mic] Starting…');
    setIsConnecting(true);

    const client = new AssemblyRealtimeClientWorklet({
      onOpen: () => {
        console.log('[V2 Mic] WebSocket open');
        setIsConnecting(false);
        setIsRecording(true);
      },
      onPartial: (text) => {
        // Optional: live preview locally only
        console.log('[V2 Mic] Partial:', text);
      },
      onFinal: (text) => {
        const next = (text || '').trim();
        const prev = lastFinalRef.current || '';
        const hash = createContentHash(next);

        if (!next) return;
        if (seenSetRef.current.has(hash)) {
          console.log('[V2 Mic] Dropping duplicate final (hash)');
          return;
        }

        let delta = '';
        if (!prev) {
          delta = next;
        } else if (next.startsWith(prev)) {
          delta = next.slice(prev.length).trimStart();
        } else if (prev.startsWith(next)) {
          // Model shortened previous output; ignore to avoid duplication
          delta = '';
        } else {
          let i = 0;
          const min = Math.min(prev.length, next.length);
          while (i < min && prev[i] === next[i]) i++;
          delta = next.slice(i).trimStart();
        }

        console.log('[V2 Mic] Final received', {
          prevLen: prev.length,
          nextLen: next.length,
          deltaLen: delta.length,
        });

        lastFinalRef.current = next;
        addSeenHash(hash);
        if (delta) onTranscriptUpdate(delta);
      },
      onClose: (code, reason) => {
        console.log('[V2 Mic] Closed:', code, reason);
        setIsConnecting(false);
        setIsRecording(false);
      },
      onError: (err) => {
        console.error('[V2 Mic] Error:', err);
      },
    });

    clientRef.current = client;
    try {
      await client.start();
    } catch (e) {
      console.error('[V2 Mic] Start failed:', e);
      setIsConnecting(false);
      setIsRecording(false);
    }
  };

  const stop = () => {
    console.log('[V2 Mic] Stopping…');
    try {
      clientRef.current?.stop();
    } catch {}
    clientRef.current = null;
    setIsRecording(false);
    setIsConnecting(false);
    lastFinalRef.current = '';
    seenSetRef.current.clear();
    seenOrderRef.current = [];
  };

  useEffect(() => {
    return () => {
      try { clientRef.current?.stop(); } catch {}
    };
  }, []);

  const handleClick = () => {
    if (isRecording) stop();
    else start();
  };

  return (
    <div className={className}>
      <Button
        onClick={handleClick}
        disabled={disabled || isConnecting}
        size="sm"
        variant={isRecording ? 'destructive' : 'secondary'}
      >
        {isRecording ? 'Stop Voice Input' : (isConnecting ? 'Connecting…' : 'Start Voice Input')}
      </Button>
    </div>
  );
};
