import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Loader2, MicOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface PatientVoiceRecorderProps {
  onTranscription: (text: string) => void;
  language: string;
  disabled?: boolean;
  phrases: {
    tapToSpeak?: string;
    recording?: string;
    transcribing?: string;
    voiceError?: string;
  };
  className?: string;
}

/**
 * Universal voice recorder component that works on all devices including iOS Safari.
 * Uses MediaRecorder API + Whisper transcription via edge function.
 */
export const PatientVoiceRecorder: React.FC<PatientVoiceRecorderProps> = ({
  onTranscription,
  language,
  disabled = false,
  phrases,
  className,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  // Get the best supported MIME type for the device
  const getSupportedMimeType = useCallback((): string => {
    const types = [
      'audio/mp4',      // iOS Safari prefers this
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/ogg',
    ];
    
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        console.log('🎤 PatientVoiceRecorder: Using MIME type:', type);
        return type;
      }
    }
    
    // Fallback - let browser decide
    console.log('🎤 PatientVoiceRecorder: No preferred MIME type supported, using default');
    return '';
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    audioChunksRef.current = [];

    try {
      console.log('🎤 PatientVoiceRecorder: Requesting microphone access...');
      
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      
      streamRef.current = stream;
      
      const mimeType = getSupportedMimeType();
      const options: MediaRecorderOptions = mimeType ? { mimeType } : {};
      
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        console.log('🎤 PatientVoiceRecorder: Recording stopped, processing...');
        await processRecording();
      };

      mediaRecorder.onerror = (event) => {
        console.error('🎤 PatientVoiceRecorder: MediaRecorder error:', event);
        setError(phrases.voiceError || 'Recording failed');
        stopRecording();
      };

      // Start recording with 1-second timeslices
      mediaRecorder.start(1000);
      setIsRecording(true);
      console.log('🎤 PatientVoiceRecorder: Recording started');
      
    } catch (err: any) {
      console.error('🎤 PatientVoiceRecorder: Failed to start recording:', err);
      
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError(phrases.voiceError || 'Microphone access denied');
      } else {
        setError(phrases.voiceError || 'Could not access microphone');
      }
    }
  }, [getSupportedMimeType, phrases.voiceError]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    
    // Clean up stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    setIsRecording(false);
  }, []);

  const processRecording = useCallback(async () => {
    if (audioChunksRef.current.length === 0) {
      console.log('🎤 PatientVoiceRecorder: No audio data to process');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Determine MIME type from recorded chunks
      const mimeType = audioChunksRef.current[0]?.type || 'audio/webm';
      const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
      
      console.log('🎤 PatientVoiceRecorder: Processing audio blob:', {
        size: audioBlob.size,
        type: mimeType,
        language,
      });

      // Convert to base64
      const base64Audio = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          // Remove data URL prefix to get just base64
          const base64 = result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(audioBlob);
      });

      console.log('🎤 PatientVoiceRecorder: Sending to Whisper API...');

      // Call the speech-to-text edge function
      const { data, error: transcriptionError } = await supabase.functions.invoke('speech-to-text', {
        body: {
          audio: base64Audio,
          mimeType,
          language, // Pass patient's language for accurate transcription
        },
      });

      if (transcriptionError) {
        console.error('🎤 PatientVoiceRecorder: Transcription error:', transcriptionError);
        throw new Error(transcriptionError.message || 'Transcription failed');
      }

      const transcribedText = data?.text?.trim();
      
      if (transcribedText && transcribedText.length > 0) {
        console.log('🎤 PatientVoiceRecorder: Transcription successful:', transcribedText);
        onTranscription(transcribedText);
      } else {
        console.log('🎤 PatientVoiceRecorder: No speech detected');
        // Don't show error for empty transcription - might just be silence
      }
      
    } catch (err: any) {
      console.error('🎤 PatientVoiceRecorder: Processing error:', err);
      setError(phrases.voiceError || 'Failed to transcribe');
    } finally {
      setIsProcessing(false);
      audioChunksRef.current = [];
    }
  }, [language, onTranscription, phrases.voiceError]);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  // Check if MediaRecorder is supported
  const isSupported = typeof MediaRecorder !== 'undefined';

  if (!isSupported) {
    return null; // Hide button if not supported
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <Button
        type="button"
        size="lg"
        variant={isRecording ? 'destructive' : error ? 'outline' : 'outline'}
        className={cn(
          'h-full aspect-square transition-all',
          isRecording && 'animate-pulse',
          error && 'border-destructive text-destructive'
        )}
        onClick={toggleRecording}
        disabled={disabled || isProcessing}
      >
        {isProcessing ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : isRecording ? (
          <MicOff className="h-5 w-5" />
        ) : (
          <Mic className="h-5 w-5" />
        )}
      </Button>
      
      {/* Status text below button */}
      {(isRecording || isProcessing || error) && (
        <span className={cn(
          'text-xs text-center',
          isRecording && 'text-destructive',
          isProcessing && 'text-muted-foreground',
          error && 'text-destructive'
        )}>
          {isProcessing 
            ? (phrases.transcribing || 'Transcribing...')
            : isRecording 
              ? (phrases.recording || 'Recording...')
              : error
          }
        </span>
      )}
    </div>
  );
};
