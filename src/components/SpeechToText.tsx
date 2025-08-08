import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Loader2, StopCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface SpeechToTextProps {
  onTranscription: (text: string) => void;
  className?: string;
  size?: 'sm' | 'default' | 'lg';
  inputRef?: React.RefObject<HTMLTextAreaElement>;
}

export const SpeechToText: React.FC<SpeechToTextProps> = ({ 
  onTranscription, 
  className = '',
  size = 'default',
  inputRef
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentText, setCurrentText] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<any>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const autoStopRef = useRef<NodeJS.Timeout | null>(null);

  // Check if browser supports Speech Recognition
  const isBrowserSTTSupported = () => {
    return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
  };

  // Auto-stop after 30 seconds of recording
  const AUTO_STOP_TIME = 30000; // 30 seconds
  const SILENCE_TIMEOUT = 3000; // 3 seconds of silence

  const startBrowserSTT = useCallback(async () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      throw new Error('Speech Recognition not supported');
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    let finalTranscript = '';
    let interimTranscript = '';

    recognition.onstart = () => {
      setIsRecording(true);
      toast.success('🎙️ Listening... (Auto-stops in 30s or after 3s silence)');
      
      // Focus input box
      if (inputRef?.current) {
        inputRef.current.focus();
      }

      // Auto-stop timer
      autoStopRef.current = setTimeout(() => {
        stopRecording();
        toast.info('Auto-stopped after 30 seconds');
      }, AUTO_STOP_TIME);
    };

    recognition.onresult = (event: any) => {
      interimTranscript = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
        } else {
          interimTranscript += transcript;
        }
      }

      const combinedText = finalTranscript + interimTranscript;
      setCurrentText(combinedText);
      
      // Update input in real-time
      onTranscription(combinedText);

      // Reset silence timeout on speech
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      // Set new silence timeout
      timeoutRef.current = setTimeout(() => {
        if (finalTranscript.trim()) {
          stopRecording();
          toast.info('Auto-stopped due to silence');
        }
      }, SILENCE_TIMEOUT);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsRecording(false);
      
      if (event.error === 'no-speech') {
        toast.error('No speech detected. Try again.');
      } else if (event.error === 'audio-capture') {
        toast.error('Microphone access denied');
      } else {
        toast.error('Speech recognition error: ' + event.error);
      }
    };

    recognition.onend = () => {
      setIsRecording(false);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (autoStopRef.current) {
        clearTimeout(autoStopRef.current);
      }
    };

    try {
      recognition.start();
    } catch (error) {
      console.error('Failed to start speech recognition:', error);
      throw error;
    }
  }, [onTranscription, inputRef]);

  const startRecording = useCallback(async () => {
    try {
      // Clear any previous text
      setCurrentText('');
      
      // Try browser STT first for Chrome/Edge
      if (isBrowserSTTSupported()) {
        await startBrowserSTT();
        return;
      }

      // Fallback to manual recording + Whisper
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await processAudio(audioBlob);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      
      // Focus input box
      if (inputRef?.current) {
        inputRef.current.focus();
      }
      
      toast.success('🎙️ Recording started (Click again to stop)');

      // Auto-stop after 30 seconds
      autoStopRef.current = setTimeout(() => {
        stopRecording();
        toast.info('Auto-stopped after 30 seconds');
      }, AUTO_STOP_TIME);

    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Failed to start recording. Please check microphone permissions.');
    }
  }, [startBrowserSTT, inputRef]);

  const stopRecording = useCallback(() => {
    // Clear timers
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (autoStopRef.current) {
      clearTimeout(autoStopRef.current);
    }

    // Stop browser STT
    if (recognitionRef.current && isRecording) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
      return;
    }

    // Stop manual recording
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsProcessing(true);
      toast.info('Processing audio...');
    }
  }, [isRecording]);

  const processAudio = async (audioBlob: Blob) => {
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

      // Send to speech-to-text edge function
      const { data, error } = await supabase.functions.invoke('speech-to-text', {
        body: { audio: base64Audio }
      });

      if (error) {
        throw error;
      }

      if (data?.text) {
        onTranscription(data.text);
        toast.success('Speech converted to text!');
      } else {
        toast.error('No speech detected');
      }
    } catch (error) {
      console.error('Error processing audio:', error);
      toast.error('Failed to process audio');
    } finally {
      setIsProcessing(false);
    }
  };

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
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (autoStopRef.current) {
        clearTimeout(autoStopRef.current);
      }
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const isUsingBrowserSTT = isBrowserSTTSupported();

  return (
    <Button
      onClick={toggleRecording}
      disabled={isProcessing}
      variant={isRecording ? "destructive" : "outline"}
      size={size}
      className={`${className} ${isRecording ? 'animate-pulse' : ''}`}
      title={isUsingBrowserSTT ? 
        'Real-time speech recognition (Auto-stops after 30s or 3s silence)' : 
        'Record audio for transcription'
      }
    >
      {isProcessing ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isRecording ? (
        <StopCircle className="h-4 w-4" />
      ) : (
        <Mic className="h-4 w-4" />
      )}
      {size !== 'sm' && (
        <span className="ml-2">
          {isProcessing 
            ? 'Processing...' 
            : isRecording 
              ? (isUsingBrowserSTT ? 'Listening...' : 'Stop Recording')
              : (isUsingBrowserSTT ? 'Voice Input' : 'Record')
          }
        </span>
      )}
    </Button>
  );
};