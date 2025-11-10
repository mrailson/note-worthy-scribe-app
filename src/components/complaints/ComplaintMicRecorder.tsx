import React, { useState, useRef, forwardRef, useImperativeHandle } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AssemblyRealtimeClient } from '@/lib/assembly-realtime';
import { useToast } from '@/hooks/use-toast';

interface ComplaintMicRecorderProps {
  onTranscriptUpdate: (text: string) => void;
  disabled?: boolean;
  className?: string;
}

export interface ComplaintMicRecorderRef {
  clearTranscript: () => void;
}

export const ComplaintMicRecorder = forwardRef<ComplaintMicRecorderRef, ComplaintMicRecorderProps>(({
  onTranscriptUpdate,
  disabled = false,
  className = ''
}, ref) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [status, setStatus] = useState<string>('');
  const clientRef = useRef<AssemblyRealtimeClient | null>(null);
  const lastFinalTextRef = useRef<string>('');
  const { toast } = useToast();

  useImperativeHandle(ref, () => ({
    clearTranscript: () => {
      lastFinalTextRef.current = '';
    }
  }));

  const startRecording = async () => {
    try {
      setIsConnecting(true);
      setStatus('Connecting...');

      const client = new AssemblyRealtimeClient({
        onOpen: () => {
          setIsConnecting(false);
          setIsRecording(true);
          setStatus('Recording...');
          console.log('AssemblyAI connection opened');
        },
        onPartial: (text) => {
          // Live partial transcripts (not sent to parent)
          console.log('Partial:', text);
        },
        onFinal: (text) => {
          // Compute delta vs last final to avoid repetitions like "some" -> "some changes" -> "some changes to"
          const next = text.trim();
          const prev = lastFinalTextRef.current;
          console.log('Final received:', { prev, next });

          let delta = '';
          if (!prev) {
            delta = next;
          } else if (next.startsWith(prev)) {
            delta = next.slice(prev.length).trimStart();
          } else if (prev.startsWith(next)) {
            // Model rewound or shortened — don't emit
            delta = '';
          } else {
            // Find longest common prefix
            let i = 0;
            const min = Math.min(prev.length, next.length);
            while (i < min && prev[i] === next[i]) i++;
            delta = next.slice(i).trimStart();
          }

          lastFinalTextRef.current = next;
          if (delta) onTranscriptUpdate(delta);
        },
        onClose: (code, reason) => {
          console.log('Connection closed:', code, reason);
          setIsRecording(false);
          setIsConnecting(false);
          setStatus('');
        },
        onError: (err) => {
          console.error('AssemblyAI error:', err);
          setIsRecording(false);
          setIsConnecting(false);
          setStatus('');
          toast({
            title: 'Recording Error',
            description: 'Failed to connect to transcription service. Please check your microphone permissions and try again.',
            variant: 'destructive'
          });
        }
      });

      clientRef.current = client;
      await client.start();
    } catch (error) {
      console.error('Failed to start recording:', error);
      setIsRecording(false);
      setIsConnecting(false);
      setStatus('');
      
      toast({
        title: 'Microphone Access Required',
        description: 'Please allow microphone access to use voice input.',
        variant: 'destructive'
      });
    }
  };

  const stopRecording = () => {
    if (clientRef.current) {
      clientRef.current.stop();
      clientRef.current = null;
    }
    setIsRecording(false);
    setIsConnecting(false);
    setStatus('');
    lastFinalTextRef.current = ''; // Reset for next recording session
  };

  const toggleRecording = () => {
    if (isRecording || isConnecting) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Button
        type="button"
        onClick={toggleRecording}
        disabled={disabled || isConnecting}
        variant={isRecording ? "destructive" : "outline"}
        size="sm"
        className={cn(
          "relative transition-all",
          isRecording && "animate-pulse"
        )}
      >
        {isConnecting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isRecording ? (
          <MicOff className="h-4 w-4" />
        ) : (
          <Mic className="h-4 w-4" />
        )}
        <span className="ml-2">
          {isConnecting ? 'Connecting...' : isRecording ? 'Stop Recording' : 'Voice Input'}
        </span>
      </Button>
      
      {status && (
        <span className="text-sm text-muted-foreground flex items-center gap-1">
          {isRecording && (
            <span className="inline-flex h-2 w-2 rounded-full bg-destructive animate-pulse" />
          )}
          {status}
        </span>
      )}
    </div>
  );
});

ComplaintMicRecorder.displayName = "ComplaintMicRecorder";
