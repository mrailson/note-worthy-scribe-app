import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BrowserSpeechTranscriber, TranscriptData } from '@/utils/BrowserSpeechTranscriber';

interface SimpleBrowserMicProps {
  onTranscriptUpdate: (text: string) => void;
  onRecordingStart?: () => void;
  disabled?: boolean;
  className?: string;
}

export interface SimpleBrowserMicRef {
  clearTranscript: () => void;
}

export const SimpleBrowserMic = forwardRef<SimpleBrowserMicRef, SimpleBrowserMicProps>(({
  onTranscriptUpdate,
  onRecordingStart,
  disabled = false,
  className = ''
}, ref) => {
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState('idle');
  const [fullTranscript, setFullTranscript] = useState('');
  
  const transcriberRef = useRef<BrowserSpeechTranscriber | null>(null);

  const handleTranscription = (data: TranscriptData) => {
    if (data.is_final) {
      // For final results, append to the full transcript
      setFullTranscript(prev => {
        const newTranscript = prev ? `${prev} ${data.text}` : data.text;
        onTranscriptUpdate(newTranscript);
        return newTranscript;
      });
    } else {
      // For interim results, show preview with current text
      const previewText = fullTranscript ? `${fullTranscript} ${data.text}` : data.text;
      onTranscriptUpdate(previewText);
    }
  };

  const handleError = (error: string) => {
    console.error('Browser speech error:', error);
    setStatus('error');
    setIsRecording(false);
    
    // Don't show alerts for common, non-critical errors
    if (!error.includes('no-speech') && !error.includes('network')) {
      // Show user-friendly error messages
      if (error.includes('not-allowed')) {
        alert('Microphone access denied. Please allow microphone access and try again.');
      } else if (error.includes('not supported')) {
        alert('Speech recognition not supported in this browser. Try Chrome or Edge.');
      }
    }
  };

  const handleStatusChange = (newStatus: string) => {
    setStatus(newStatus.toLowerCase());
  };

  const startRecording = async () => {
    if (isRecording || disabled) return;

    try {
      // Check if browser supports speech recognition
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        throw new Error('Speech recognition not supported in this browser. Please use Chrome or Edge.');
      }

      setStatus('connecting...');
      
      transcriberRef.current = new BrowserSpeechTranscriber(
        handleTranscription,
        handleError,
        handleStatusChange,
        undefined, // onSummary
        undefined, // meetingId  
        undefined, // sessionId
        undefined, // userId
        undefined  // onChunkTracked - removed
      );

      await transcriberRef.current.startTranscription();
      setIsRecording(true);
      
      // Focus the input when recording starts
      onRecordingStart?.();
      
    } catch (error: any) {
      console.error('Error starting browser speech recognition:', error);
      handleError(error.message || 'Failed to start speech recognition');
    }
  };

  const stopRecording = () => {
    if (!isRecording) return;

    if (transcriberRef.current) {
      transcriberRef.current.stopTranscription();
      transcriberRef.current = null;
    }
    
    setIsRecording(false);
    setStatus('idle');
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const clearTranscript = () => {
    setFullTranscript('');
    onTranscriptUpdate('');
  };

  const getButtonContent = () => {
    if (status === 'connecting...') {
      return <Loader2 className="w-14 h-14 animate-spin" />;
    } else if (isRecording) {
      return <MicOff className="w-14 h-14" />;
    } else {
      return <Mic className="w-14 h-14" />;
    }
  };

  // Expose clearTranscript method through ref
  useImperativeHandle(ref, () => ({
    clearTranscript
  }));

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (transcriberRef.current) {
        transcriberRef.current.stopTranscription();
      }
    };
  }, []);

  // Stop recording when page becomes hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && isRecording) {
        stopRecording();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isRecording]);

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Button
        variant={isRecording ? "default" : "ghost"}
        size="sm"
        className={cn(
          "h-20 w-20 p-0 transition-all duration-200",
          isRecording 
            ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/30' 
            : status === 'connecting...' 
              ? 'bg-amber-500 hover:bg-amber-600 text-white' 
              : status === 'error'
                ? 'bg-red-100 hover:bg-red-200 text-red-600'
                : 'hover:bg-accent'
        )}
        onClick={toggleRecording}
        disabled={disabled || status === 'connecting...'}
        title={
          isRecording 
            ? 'Stop browser transcription' 
            : status === 'connecting...' 
              ? 'Starting browser speech recognition...' 
              : status === 'error'
                ? 'Speech recognition error - click to retry'
                : 'Start browser transcription'
        }
        aria-pressed={isRecording}
      >
        {getButtonContent()}
      </Button>
      
      {/* Clear button */}
      {fullTranscript && (
        <Button
          onClick={clearTranscript}
          variant="outline"
          size="sm"
        >
          Clear
        </Button>
      )}
      
    </div>
  );
});

SimpleBrowserMic.displayName = "SimpleBrowserMic";