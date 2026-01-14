import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BrowserSpeechTranscriber, TranscriptData } from '@/utils/BrowserSpeechTranscriber';

interface CompactMicButtonProps {
  onTranscriptUpdate: (text: string) => void;
  currentValue: string;
  disabled?: boolean;
  className?: string;
}

export const CompactMicButton: React.FC<CompactMicButtonProps> = ({
  onTranscriptUpdate,
  currentValue,
  disabled = false,
  className = ''
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState('idle');
  
  const transcriberRef = useRef<BrowserSpeechTranscriber | null>(null);
  const baseTextRef = useRef(currentValue);

  // Update base text when recording starts
  useEffect(() => {
    if (!isRecording) {
      baseTextRef.current = currentValue;
    }
  }, [isRecording, currentValue]);

  const handleTranscription = (data: TranscriptData) => {
    const separator = baseTextRef.current ? ' ' : '';
    if (data.is_final) {
      const newText = baseTextRef.current + separator + data.text;
      baseTextRef.current = newText;
      onTranscriptUpdate(newText);
    } else {
      onTranscriptUpdate(baseTextRef.current + separator + data.text);
    }
  };

  const handleError = (error: string) => {
    console.error('Browser speech error:', error);
    setStatus('error');
    setIsRecording(false);
    
    if (error.includes('not-allowed')) {
      alert('Microphone access denied. Please allow microphone access and try again.');
    } else if (error.includes('not supported')) {
      alert('Speech recognition not supported in this browser. Try Chrome or Edge.');
    }
  };

  const handleStatusChange = (newStatus: string) => {
    setStatus(newStatus.toLowerCase());
  };

  const startRecording = async () => {
    if (isRecording || disabled) return;

    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        throw new Error('Speech recognition not supported in this browser.');
      }

      setStatus('connecting...');
      baseTextRef.current = currentValue;
      
      transcriberRef.current = new BrowserSpeechTranscriber(
        handleTranscription,
        handleError,
        handleStatusChange
      );

      await transcriberRef.current.startTranscription();
      setIsRecording(true);
      
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

  useEffect(() => {
    return () => {
      if (transcriberRef.current) {
        transcriberRef.current.stopTranscription();
      }
    };
  }, []);

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
    <Button
      type="button"
      variant={isRecording ? "default" : "outline"}
      size="icon"
      className={cn(
        "shrink-0 transition-all duration-200",
        isRecording 
          ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse-gentle' 
          : status === 'connecting...' 
            ? 'bg-amber-500 hover:bg-amber-600 text-white' 
            : status === 'error'
              ? 'bg-red-100 hover:bg-red-200 text-red-600'
              : '',
        className
      )}
      onClick={toggleRecording}
      disabled={disabled || status === 'connecting...'}
      title={
        isRecording 
          ? 'Stop recording' 
          : status === 'connecting...' 
            ? 'Starting...' 
            : 'Start voice input'
      }
    >
      {status === 'connecting...' ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isRecording ? (
        <MicOff className="h-4 w-4" />
      ) : (
        <Mic className="h-4 w-4" />
      )}
    </Button>
  );
};
