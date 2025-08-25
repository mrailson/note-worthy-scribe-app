import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SimpleDeepgramMicProps {
  onTranscriptUpdate: (text: string) => void;
  disabled?: boolean;
  className?: string;
}

export const SimpleDeepgramMic: React.FC<SimpleDeepgramMicProps> = ({
  onTranscriptUpdate,
  disabled = false,
  className = ''
}) => {
  console.log('🚀 SimpleDeepgramMic component mounted');
  
  const [isStreaming, setIsStreaming] = useState(false);
  const [status, setStatus] = useState('idle');
  const [pendingText, setPendingText] = useState('');
  const [committedText, setCommittedText] = useState('');

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Debug logging
  useEffect(() => {
    console.log('🔧 SimpleDeepgramMic useEffect - component ready');
  }, []);

  const startStreaming = async () => {
    if (isStreaming || disabled) return;

    try {
      setStatus('connecting...');
      console.log('🎙️ Starting simple Deepgram transcription...');

      // Get microphone access first
      console.log('🔍 Requesting microphone access...');
      try {
        mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            sampleRate: 48000,
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
        console.log('✅ Microphone access granted, tracks:', mediaStreamRef.current.getTracks().length);
        
        // Check if tracks are active
        mediaStreamRef.current.getTracks().forEach((track, i) => {
          console.log(`🎵 Track ${i}:`, track.kind, track.enabled, track.readyState);
          
          // Listen for track ending
          track.onended = () => {
            console.log('❌ Audio track ended unexpectedly');
            stopStreaming();
          };
        });
        
      } catch (micError: any) {
        console.error('❌ Microphone access error:', micError);
        
        if (micError.name === 'NotAllowedError') {
          throw new Error('Microphone access denied. Please allow microphone access and try again.');
        } else if (micError.name === 'NotFoundError') {
          throw new Error('No microphone found. Please connect a microphone and try again.');
        } else if (micError.name === 'NotReadableError') {
          throw new Error('Microphone is busy or unavailable. Please close other apps using the microphone.');
        } else {
          throw new Error('Microphone error: ' + micError.message);
        }
      }

      // Connect directly to our edge function WebSocket
      const wsUrl = `wss://dphcnbricafkbtizkoal.supabase.co/functions/v1/deepgram-direct`;
      console.log('🔌 Connecting to WebSocket:', wsUrl);
      
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('🎙️ WebSocket connected to Deepgram proxy');
        setStatus('listening...');
        setIsStreaming(true);
        
        // Start recording audio
        startRecording();
      };

      wsRef.current.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        stopStreaming();
        setStatus('connection error');
      };

      wsRef.current.onclose = (event) => {
        console.log('🔌 WebSocket closed:', event.code, event.reason);
        setStatus('idle');
        setIsStreaming(false);
        
        // Auto-stop streaming when WebSocket closes
        if (isStreaming) {
          console.log('🛑 Auto-stopping due to WebSocket close');
          stopStreaming();
        }
      };

      // Handle transcription results
      wsRef.current.onmessage = (event) => {
        try {
          console.log('📨 Received message from Deepgram:', event.data);
          const data = JSON.parse(event.data);
          console.log('📊 Parsed Deepgram data:', data);
          
          if (data.error) {
            console.error('❌ Deepgram error:', data.error);
            return;
          }
          
          if (!data?.channel?.alternatives?.[0]) {
            console.log('⚠️ No transcript data in response');
            return;
          }

          const transcript = data.channel.alternatives[0].transcript || '';
          console.log('📝 Transcript received:', transcript, 'is_final:', data.is_final);
          
          if (data.is_final === false) {
            // Interim results - show live preview
            setPendingText(transcript);
            const fullText = committedText + (transcript ? (committedText ? ' ' : '') + transcript : '');
            console.log('🔄 Updating with interim:', fullText);
            onTranscriptUpdate(fullText);
          } else if (data.is_final === true && transcript.trim()) {
            // Final results - commit to permanent text
            const newCommittedText = (committedText ? committedText + ' ' : '') + transcript.trim();
            setCommittedText(newCommittedText);
            setPendingText('');
            console.log('✅ Final transcript committed:', newCommittedText);
            onTranscriptUpdate(newCommittedText);
          }

          // Handle speech detection events
          if (data.speech_final === true) {
            console.log('🎯 Speech segment completed');
          }
        } catch (error) {
          console.error('❌ Error parsing Deepgram message:', error, 'Raw data:', event.data);
        }
      };

    } catch (error: any) {
      console.error('❌ Error starting simple Deepgram streaming:', error);
      setStatus(error.message || 'connection failed');
      stopStreaming();
      
      // Show user-friendly error message
      if (error.message?.includes('Microphone access denied')) {
        alert('🎙️ Microphone Access Required\n\nPlease:\n1. Click the microphone icon in your browser address bar\n2. Select "Allow" for microphone access\n3. Refresh the page and try again');
      } else if (error.message?.includes('No microphone found')) {
        alert('🎙️ No Microphone Detected\n\nPlease:\n1. Connect a microphone to your device\n2. Refresh the page and try again');
      } else if (error.message?.includes('Microphone is busy')) {
        alert('🎙️ Microphone Unavailable\n\nPlease:\n1. Close other apps using the microphone (Zoom, Teams, etc.)\n2. Try again');
      }
    }
  };

  const startRecording = () => {
    if (!mediaStreamRef.current) return;

    try {
      console.log('🎵 Starting MediaRecorder...');
      
      // Try different codec options for better browser compatibility
      let options;
      
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        options = { mimeType: 'audio/webm;codecs=opus', bitsPerSecond: 64000 };
        console.log('✅ Using webm/opus codec');
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        options = { mimeType: 'audio/webm', bitsPerSecond: 64000 };
        console.log('✅ Using webm codec');
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        options = { mimeType: 'audio/mp4', bitsPerSecond: 64000 };
        console.log('✅ Using mp4 codec');
      } else {
        options = { bitsPerSecond: 64000 };
        console.log('⚠️ Using default codec');
      }
      
      mediaRecorderRef.current = new MediaRecorder(mediaStreamRef.current, options);
      console.log('📹 MediaRecorder created with options:', options);

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0 && wsRef.current?.readyState === WebSocket.OPEN) {
          console.log('🎵 Sending audio chunk, size:', event.data.size, 'type:', event.data.type);
          // Send audio chunks directly to WebSocket
          event.data.arrayBuffer().then(buffer => {
            console.log('📤 Sending buffer to WebSocket, size:', buffer.byteLength);
            wsRef.current?.send(buffer);
          }).catch(error => {
            console.error('❌ Error converting to buffer:', error);
          });
        } else {
          console.warn('⚠️ Audio data available but WebSocket not ready or no data, WS state:', wsRef.current?.readyState);
        }
      };

      mediaRecorderRef.current.onstart = () => {
        console.log('▶️ MediaRecorder started');
      };

      mediaRecorderRef.current.onstop = () => {
        console.log('⏹️ MediaRecorder stopped');
      };

      mediaRecorderRef.current.onerror = (error) => {
        console.error('❌ MediaRecorder error:', error);
      };

      // Start recording with small chunks for low latency
      mediaRecorderRef.current.start(250);
      console.log('🎵 Started recording audio with 250ms chunks');

    } catch (error) {
      console.error('❌ Error starting recording:', error);
      // Fallback: try with no options
      try {
        console.log('🔄 Trying MediaRecorder fallback without options...');
        mediaRecorderRef.current = new MediaRecorder(mediaStreamRef.current);
        mediaRecorderRef.current.ondataavailable = (event) => {
          if (event.data.size > 0 && wsRef.current?.readyState === WebSocket.OPEN) {
            event.data.arrayBuffer().then(buffer => {
              wsRef.current?.send(buffer);
            });
          }
        };
        mediaRecorderRef.current.start(250);
        console.log('✅ Fallback MediaRecorder started');
      } catch (fallbackError) {
        console.error('❌ Fallback MediaRecorder also failed:', fallbackError);
      }
    }
  };

  const stopStreaming = () => {
    if (!isStreaming) return;

    try {
      console.log('🛑 Stopping Deepgram streaming, current state:', {
        isStreaming,
        mediaRecorderState: mediaRecorderRef.current?.state,
        wsReadyState: wsRef.current?.readyState,
        trackCount: mediaStreamRef.current?.getTracks().length
      });

      // Stop MediaRecorder
      if (mediaRecorderRef.current?.state !== 'inactive') {
        console.log('🔴 Stopping MediaRecorder');
        mediaRecorderRef.current?.stop();
      }

      // Stop media stream tracks
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track, i) => {
          console.log(`🔇 Stopping track ${i}:`, track.kind);
          track.stop();
        });
      }

      // Close WebSocket
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        console.log('🔌 Closing WebSocket');
        wsRef.current.close(1000);
      }

    } catch (error) {
      console.error('❌ Error stopping streaming:', error);
    } finally {
      setIsStreaming(false);
      setStatus('idle');
      // Keep committed text but clear pending
      setPendingText('');
      console.log('✅ Streaming stopped, final state: idle');
    }
  };

  const toggleStreaming = () => {
    console.log('🎛️ Toggle streaming clicked, current state:', isStreaming);
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

      {/* Service indicator tag */}
      <div className="flex flex-col items-start gap-1">
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
        <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded-md font-medium border border-green-200">
          Deepgram Direct
        </span>
      </div>

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
