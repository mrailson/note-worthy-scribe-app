import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface DeepgramStreamingMicProps {
  onTranscriptUpdate: (text: string) => void;
  disabled?: boolean;
  className?: string;
}

export const DeepgramStreamingMic: React.FC<DeepgramStreamingMicProps> = ({
  onTranscriptUpdate,
  disabled = false,
  className = ''
}) => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [status, setStatus] = useState('idle');
  const [pendingText, setPendingText] = useState('');
  const [committedText, setCommittedText] = useState('');

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Deepgram streaming parameters optimized for clinical use
  const DG_PARAMS = new URLSearchParams({
    model: 'nova-2-conversationalai',
    language: 'en-GB',
    punctuate: 'true',
    interim_results: 'true',
    smart_format: 'true',
    vad_events: 'true',
    endpointing: '300',
    encoding: 'opus',
    // Add medical keywords for better accuracy
    keywords: 'NHS:2,clinical:2,prescription:2,medication:2,patient:2,treatment:2,diagnosis:2,referral:2',
  });

  const startStreaming = async () => {
    if (isStreaming || disabled) return;

    try {
      setStatus('connecting...');

      // Get secure token from our edge function
      const { data: tokenData, error: tokenError } = await supabase.functions.invoke('deepgram-token');
      
      if (tokenError || !tokenData?.token) {
        throw new Error('Failed to get Deepgram token: ' + (tokenError?.message || 'No token received'));
      }

      console.log('✅ Got Deepgram token, connecting...');

      // Get microphone access
      mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 48000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // Connect to Deepgram WebSocket
      const wsUrl = `wss://api.deepgram.com/v1/listen?${DG_PARAMS.toString()}`;
      wsRef.current = new WebSocket(wsUrl, ['token', tokenData.token]);

      wsRef.current.onopen = () => {
        console.log('🎙️ Deepgram WebSocket connected');
        setStatus('listening...');
        setIsStreaming(true);
      };

      wsRef.current.onerror = (error) => {
        console.error('❌ Deepgram WebSocket error:', error);
        stopStreaming();
        setStatus('connection error');
      };

      wsRef.current.onclose = (event) => {
        console.log('🔌 Deepgram WebSocket closed:', event.code, event.reason);
        setStatus('idle');
        setIsStreaming(false);
      };

      // Handle transcription results
      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (!data?.channel?.alternatives?.[0]) return;

          const transcript = data.channel.alternatives[0].transcript || '';
          
          if (data.is_final === false) {
            // Interim results - show live preview
            setPendingText(transcript);
            const fullText = committedText + (transcript ? (committedText ? ' ' : '') + transcript : '');
            onTranscriptUpdate(fullText);
          } else if (data.is_final === true && transcript.trim()) {
            // Final results - commit to permanent text
            const newCommittedText = (committedText ? committedText + ' ' : '') + transcript.trim();
            setCommittedText(newCommittedText);
            setPendingText('');
            onTranscriptUpdate(newCommittedText);
            console.log('✅ Final transcript:', transcript);
          }

          // Handle speech detection events
          if (data.speech_final === true) {
            console.log('🎯 Speech segment completed');
          }
        } catch (error) {
          console.error('❌ Error parsing Deepgram message:', error);
        }
      };

      // Set up audio streaming with MediaRecorder
      const options = { mimeType: 'audio/webm;codecs=opus', bitsPerSecond: 64000 };
      mediaRecorderRef.current = new MediaRecorder(mediaStreamRef.current, options);

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0 && wsRef.current?.readyState === WebSocket.OPEN) {
          // Send audio chunks directly to Deepgram
          event.data.arrayBuffer().then(buffer => {
            wsRef.current?.send(buffer);
          });
        }
      };

      // Start recording with small chunks for low latency
      mediaRecorderRef.current.start(250);

    } catch (error) {
      console.error('❌ Error starting Deepgram streaming:', error);
      setStatus('mic blocked/unavailable');
      stopStreaming();
    }
  };

  const stopStreaming = () => {
    if (!isStreaming) return;

    try {
      // Stop MediaRecorder
      if (mediaRecorderRef.current?.state !== 'inactive') {
        mediaRecorderRef.current?.stop();
      }

      // Stop media stream tracks
      mediaStreamRef.current?.getTracks().forEach(track => track.stop());

      // Close WebSocket
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.close(1000);
      }

      console.log('🛑 Deepgram streaming stopped');
    } catch (error) {
      console.error('❌ Error stopping streaming:', error);
    } finally {
      setIsStreaming(false);
      setStatus('idle');
      // Keep committed text but clear pending
      setPendingText('');
    }
  };

  const toggleStreaming = () => {
    if (isStreaming) {
      stopStreaming();
    } else {
      startStreaming();
    }
  };

  const clearTranscript = () => {
    setCommittedText('');
    setPendingText('');
    onTranscriptUpdate('');
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopStreaming();
    };
  }, []);

  // Auto-stop on page hide
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && isStreaming) {
        stopStreaming();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isStreaming]);

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Button
        variant={isStreaming ? "default" : "ghost"}
        size="sm"
        className={cn(
          "h-8 w-8 p-0 transition-all duration-200",
          isStreaming 
            ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/30' 
            : status === 'connecting...' 
              ? 'bg-amber-500 hover:bg-amber-600 text-white' 
              : 'hover:bg-accent'
        )}
        onClick={toggleStreaming}
        disabled={disabled || status === 'connecting...'}
        title={
          isStreaming 
            ? 'Stop live transcription' 
            : status === 'connecting...' 
              ? 'Connecting to Deepgram...' 
              : 'Start live transcription'
        }
        aria-pressed={isStreaming}
      >
        {status === 'connecting...' ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : isStreaming ? (
          <MicOff className="w-4 h-4" />
        ) : (
          <Mic className="w-4 h-4" />
        )}
      </Button>

      {/* Status indicator */}
      <span className={cn(
        'text-xs transition-colors duration-200',
        isStreaming 
          ? 'text-red-600 font-medium' 
          : status === 'connecting...' 
            ? 'text-amber-600' 
            : 'text-muted-foreground'
      )}>
        {status}
      </span>

      {/* Clear button when there's committed text */}
      {committedText && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearTranscript}
          className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
          disabled={disabled}
        >
          Clear
        </Button>
      )}
    </div>
  );
};
