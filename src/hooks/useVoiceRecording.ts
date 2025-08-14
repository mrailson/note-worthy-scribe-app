import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface VoiceRecordingState {
  isRecording: boolean;
  isProcessing: boolean;
  error: string | null;
}

export const useVoiceRecording = () => {
  const [state, setState] = useState<VoiceRecordingState>({
    isRecording: false,
    isProcessing: false,
    error: null
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isRecording: false, isProcessing: true, error: null }));

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 44100,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        console.log('Audio data available:', event.data.size, 'bytes');
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstart = () => {
        console.log('Recording started');
        setState(prev => ({ ...prev, isRecording: true, isProcessing: false }));
      };

      mediaRecorder.onstop = () => {
        console.log('Recording stopped, audio chunks collected:', audioChunksRef.current.length);
        stream.getTracks().forEach(track => track.stop());
        setState(prev => ({ ...prev, isRecording: false, isProcessing: true }));
      };

      mediaRecorderRef.current = mediaRecorder;
      // Start recording with timeslice to ensure we get data chunks
      mediaRecorder.start(100); // Collect data every 100ms

    } catch (error) {
      console.error('Error starting recording:', error);
        setState(prev => ({ 
          ...prev, 
          isRecording: false, 
          isProcessing: false, 
          error: 'Failed to access microphone' 
        }));
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && state.isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
  }, [state.isRecording]);

  const processRecording = useCallback(async (): Promise<string> => {
    console.log('Processing recording, chunks available:', audioChunksRef.current.length);
    
    if (audioChunksRef.current.length === 0) {
      throw new Error('No audio data recorded');
    }

    // Create audio blob
    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
    console.log('Created audio blob, size:', audioBlob.size, 'bytes');
    
    // Convert to base64
    const base64Audio = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(audioBlob);
    });

    // Send to speech-to-text service
    console.log('Sending audio to speech-to-text function...');
    const { data, error } = await supabase.functions.invoke('speech-to-text', {
      body: { audio: base64Audio }
    });

    console.log('Speech-to-text response:', { data, error });

    if (error) {
      console.error('Speech-to-text error:', error);
      throw new Error('Failed to convert speech to text');
    }

    setState(prev => ({ ...prev, isProcessing: false }));
    
    return data.text || '';
  }, []);

  const toggleRecording = useCallback(async (): Promise<string | null> => {
    if (state.isRecording) {
      stopRecording();
      try {
        const text = await processRecording();
        setState(prev => ({ ...prev, isProcessing: false }));
        return text;
      } catch (error) {
        console.error('Error processing recording:', error);
        setState(prev => ({ 
          ...prev, 
          isProcessing: false, 
          error: 'Failed to process recording' 
        }));
        return null;
      }
    } else {
      await startRecording();
      return null;
    }
  }, [state.isRecording, startRecording, stopRecording, processRecording]);

  return {
    ...state,
    toggleRecording
  };
};