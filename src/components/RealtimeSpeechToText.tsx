import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

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
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [accumulatedText, setAccumulatedText] = useState('');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const recordingTimeoutRef = useRef<number | null>(null);

  const processAudio = useCallback(async (audioBlob: Blob) => {
    if (audioBlob.size === 0) {
      console.log('No audio data to process');
      return;
    }
    
    setIsProcessing(true);
    console.log('Processing audio chunk, size:', audioBlob.size);
    
    try {
      // Convert blob to base64
      const arrayBuffer = await audioBlob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // Convert to base64 in chunks to prevent memory issues
      let binary = '';
      const chunkSize = 0x8000; // 32KB chunks
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
        binary += String.fromCharCode.apply(null, Array.from(chunk));
      }
      const base64Audio = btoa(binary);

      console.log('Sending to speech-to-text function...');
      
      // Send to speech-to-text edge function
      const { data, error } = await supabase.functions.invoke('speech-to-text', {
        body: { audio: base64Audio }
      });

      if (error) {
        console.error('Transcription error:', error);
        toast.error('Transcription failed');
        return;
      }

      if (data?.text && data.text.trim()) {
        const text = data.text.trim();
        console.log('Transcription result:', text);
        
        setCurrentTranscript(text);
        onTranscription(text, false);
        
        // Add to accumulated text
        setAccumulatedText(prev => {
          const newText = prev ? prev + ' ' + text : text;
          onFinalTranscription?.(newText);
          return newText;
        });
        
        toast.success('Speech converted to text!');
      } else {
        console.log('No speech detected in audio');
        toast.info('No speech detected');
      }
    } catch (error) {
      console.error('Error processing audio:', error);
      toast.error('Failed to process audio');
    } finally {
      setIsProcessing(false);
    }
  }, [onTranscription, onFinalTranscription]);

  const startRecording = useCallback(async () => {
    try {
      console.log('Starting recording...');
      
      // Get audio stream
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      streamRef.current = stream;
      audioChunksRef.current = [];

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      mediaRecorderRef.current = mediaRecorder;

      // Handle data available
      mediaRecorder.ondataavailable = (event) => {
        console.log('Audio data available, size:', event.data.size);
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      // Handle recording stop
      mediaRecorder.onstop = async () => {
        console.log('Recording stopped, processing audio...');
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await processAudio(audioBlob);
      };

      // Start recording
      mediaRecorder.start();
      setIsRecording(true);
      setCurrentTranscript('');
      
      console.log('Recording started successfully');
      toast.success('Recording started - speak now');
      
      // No auto-stop timeout for medical consultations - let recording continue until manually stopped
      
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Failed to start recording. Please check microphone permissions.');
    }
  }, [processAudio]);

  const stopRecording = useCallback(() => {
    console.log('Stopping recording...');
    
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log('Audio track stopped');
      });
      streamRef.current = null;
    }
    
    setIsRecording(false);
    toast.info('Processing audio...');
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
      if (recordingTimeoutRef.current) {
        clearTimeout(recordingTimeoutRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return (
    <div className="flex flex-col gap-2">
      <Button
        onClick={toggleRecording}
        disabled={isProcessing}
        variant={isRecording ? "destructive" : "outline"}
        size={size}
        className={className}
      >
        {isProcessing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isRecording ? (
          <MicOff className="h-4 w-4" />
        ) : (
          <Mic className="h-4 w-4" />
        )}
        {size !== 'sm' && (
          <span className="ml-2">
            {isProcessing 
              ? 'Processing...' 
              : isRecording 
                ? 'Stop Recording' 
                : 'Record'
            }
          </span>
        )}
      </Button>
      
      {currentTranscript && (
        <div className="text-sm text-foreground bg-muted p-2 rounded">
          <strong>Latest:</strong> "{currentTranscript}"
        </div>
      )}
      
      {accumulatedText && (
        <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
          <strong>All text:</strong> "{accumulatedText}"
        </div>
      )}
    </div>
  );
};