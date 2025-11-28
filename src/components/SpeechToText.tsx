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

  // Auto-stop after 15 seconds of recording (reduced from 30)
  const AUTO_STOP_TIME = 15000; // 15 seconds
  const SILENCE_TIMEOUT = 2000; // 2 seconds of silence (reduced from 3)
  const MIN_CONFIDENCE = 0.7; // Minimum confidence threshold
  const MIN_SPEECH_LENGTH = 3; // Minimum characters to consider valid speech

  const startBrowserSTT = useCallback(async () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      throw new Error('Speech Recognition not supported');
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;

    recognition.continuous = true; // Enable continuous listening
    recognition.interimResults = true; // Get interim results to prevent cutting off
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1; // Only get the best match
    
    // More conservative settings to reduce false positives

    let finalTranscript = '';
    let interimTranscript = '';

    recognition.onstart = () => {
      setIsRecording(true);
      toast.success('🎙️ Ready to listen... (Auto-stops in 15s)');
      setCurrentText(''); // Clear any previous text
      
      // Focus input box
      if (inputRef?.current) {
        inputRef.current.focus();
      }

      // Auto-stop timer
      autoStopRef.current = setTimeout(() => {
        stopRecording();
        toast.info('Auto-stopped after 15 seconds');
      }, AUTO_STOP_TIME);
    };

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';
      
      // Process both interim and final results
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i][0];
        const transcript = result.transcript.trim();
        
        if (event.results[i].isFinal) {
          const confidence = result.confidence || 0;
          
          console.log('Final speech result:', { transcript, confidence });
          
          // Only accept high-confidence, meaningful speech for final results
          if (confidence >= MIN_CONFIDENCE && transcript.length >= MIN_SPEECH_LENGTH) {
            // Filter out common hallucinations
            const lowercaseText = transcript.toLowerCase();
            const isHallucination = [
              'thank you', 'thanks', 'bye', 'goodbye', 
              'you', 'the', 'a', 'an', 'and', 'or',
              'mm', 'hmm', 'uh', 'um', 'ah'
            ].some(phrase => lowercaseText === phrase || lowercaseText.split(' ').length <= 1);
            
            if (!isHallucination) {
              finalTranscript += transcript + ' ';
            }
          }
        } else {
          // Show interim results for user feedback
          interimTranscript += transcript + ' ';
        }
      }

      // Update current text with interim or final transcript
      const displayText = finalTranscript || interimTranscript;
      if (displayText.trim()) {
        setCurrentText(displayText.trim());
      }

      // If we have final transcript, send it and continue listening for more
      if (finalTranscript.trim()) {
        onTranscription(finalTranscript.trim());
        // Don't stop immediately, allow for more speech
        // Clear the timeout and set a new one for natural pauses
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        
        timeoutRef.current = setTimeout(() => {
          stopRecording();
        }, SILENCE_TIMEOUT);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsRecording(false);
      
      if (event.error === 'no-speech') {
        toast.info('No clear speech detected. Try speaking louder and clearer.');
      } else if (event.error === 'audio-capture') {
        toast.error('Microphone access denied');
      } else if (event.error === 'not-allowed') {
        toast.error('Microphone permission denied');
      } else {
        console.log('Speech recognition error (ignored):', event.error);
        // Don't show error for network issues or aborted recognition
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
      
      // Don't restart automatically to prevent hallucination loops
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
      
      toast.success('🎙️ Recording started (Speak clearly, auto-stops in 15s)');

      // Auto-stop after 30 seconds
      autoStopRef.current = setTimeout(() => {
        stopRecording();
        toast.info('Auto-stopped after 15 seconds');
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
      size="icon"
      className={`${className} ${isRecording ? 'bg-destructive hover:bg-destructive text-destructive-foreground' : ''} transition-all duration-200`}
      title={isRecording ? 'Stop recording' : 'Click to speak'}
    >
      {isProcessing ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isRecording ? (
        <StopCircle className="h-4 w-4" />
      ) : (
        <Mic className="h-4 w-4" />
      )}
    </Button>
  );
};