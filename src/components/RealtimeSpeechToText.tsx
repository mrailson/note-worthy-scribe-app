import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { StreamingTranscriber } from '@/utils/StreamingTranscriber';

interface RealtimeSpeechToTextProps {
  onTranscription: (text: string, isPartial?: boolean) => void;
  onFinalTranscription?: (text: string) => void;
  className?: string;
  size?: 'sm' | 'default' | 'lg';
  placeholder?: string;
}

export const RealtimeSpeechToText: React.FC<RealtimeSpeechToTextProps> = ({ 
  onTranscription, 
  onFinalTranscription,
  className = '',
  size = 'default',
  placeholder = ''
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [accumulatedText, setAccumulatedText] = useState('');
  
  const transcriberRef = useRef<StreamingTranscriber | null>(null);

  const handleTranscriptionEvent = useCallback((event: any) => {
    console.log('Transcription event:', event);
    
    if (event.type === 'partial') {
      setCurrentTranscript(event.text);
      onTranscription(event.text, true);
    } else if (event.type === 'final') {
      setCurrentTranscript('');
      setAccumulatedText(prev => {
        const newText = prev ? prev + ' ' + event.text : event.text;
        onTranscription(event.text, false);
        onFinalTranscription?.(newText);
        return newText;
      });
    }
  }, [onTranscription, onFinalTranscription]);

  const handleError = useCallback((error: string) => {
    console.error('Transcription error:', error);
    toast.error(error);
    setIsRecording(false);
    setIsConnecting(false);
  }, []);

  const startRecording = useCallback(async () => {
    try {
      setIsConnecting(true);
      console.log('Starting streaming transcription...');
      
      transcriberRef.current = new StreamingTranscriber(
        handleTranscriptionEvent,
        handleError
      );
      
      await transcriberRef.current.start();
      
      setIsRecording(true);
      setIsConnecting(false);
      setCurrentTranscript('');
      setAccumulatedText('');
      
      console.log('Streaming transcription started');
      toast.success('Recording started - speak naturally');
    } catch (error) {
      console.error('Error starting recording:', error);
      setIsConnecting(false);
      toast.error('Failed to start recording. Please check microphone permissions.');
    }
  }, [handleTranscriptionEvent, handleError]);

  const stopRecording = useCallback(() => {
    if (transcriberRef.current) {
      transcriberRef.current.stop();
      transcriberRef.current = null;
    }
    
    setIsRecording(false);
    setCurrentTranscript('');
    
    console.log('Streaming transcription stopped');
    toast.info('Recording stopped');
  }, []);

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (transcriberRef.current) {
        transcriberRef.current.stop();
      }
    };
  }, []);

  return (
    <div className="flex flex-col gap-2">
      <Button
        onClick={toggleRecording}
        disabled={isConnecting}
        variant={isRecording ? "destructive" : "outline"}
        size={size}
        className={className}
      >
        {isConnecting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isRecording ? (
          <MicOff className="h-4 w-4" />
        ) : (
          <Mic className="h-4 w-4" />
        )}
        {size !== 'sm' && (
          <span className="ml-2">
            {isConnecting 
              ? 'Connecting...' 
              : isRecording 
                ? 'Stop Recording' 
                : 'Record'
            }
          </span>
        )}
      </Button>
      
      {currentTranscript && (
        <div className="text-xs text-muted-foreground italic">
          Speaking: "{currentTranscript}"
        </div>
      )}
      
      {accumulatedText && (
        <div className="text-xs text-foreground bg-muted p-2 rounded">
          Final: "{accumulatedText}"
        </div>
      )}
    </div>
  );
};