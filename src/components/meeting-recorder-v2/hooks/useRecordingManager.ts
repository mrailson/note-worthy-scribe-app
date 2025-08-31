import { useState, useCallback, useRef, useEffect } from 'react';
import { useRecording } from '@/contexts/RecordingContext';
import { BrowserSpeechTranscriber } from '@/utils/BrowserSpeechTranscriber';
import { iPhoneWhisperTranscriber } from '@/utils/iPhoneWhisperTranscriber';
import { DesktopWhisperTranscriber } from '@/utils/DesktopWhisperTranscriber';
import { DeepgramTranscriber } from '@/utils/DeepgramTranscriber';
import { detectDevice } from '@/utils/DeviceDetection';
import { toast } from 'sonner';

export interface TranscriptData {
  text: string;
  speaker: string;
  confidence: number;
  timestamp: string;
  isFinal: boolean;
}

export interface RecordingState {
  isRecording: boolean;
  isStoppingRecording: boolean;
  duration: number;
  transcript: string;
  realtimeTranscripts: TranscriptData[];
  wordCount: number;
  speakerCount: number;
  isConnected: boolean;
  chunkCounter: number;
}

export interface RecordingSettings {
  transcriberService: 'whisper' | 'deepgram';
  title: string;
  description: string;
  meetingType: string;
  practiceId?: string;
  transcriberThresholds: {
    whisper: number;
    deepgram: number;
  };
}

export function useRecordingManager(
  onTranscriptUpdate: (transcript: string) => void,
  onDurationUpdate: (duration: string) => void,
  onWordCountUpdate: (count: number) => void,
  initialSettings?: Partial<RecordingSettings>
) {
  const [state, setState] = useState<RecordingState>({
    isRecording: false,
    isStoppingRecording: false,
    duration: 0,
    transcript: '',
    realtimeTranscripts: [],
    wordCount: 0,
    speakerCount: 1,
    isConnected: false,
    chunkCounter: 0
  });

  const [settings, setSettings] = useState<RecordingSettings>({
    transcriberService: 'whisper',
    title: '',
    description: '',
    meetingType: 'General Meeting',
    transcriberThresholds: {
      whisper: 0.5,
      deepgram: 0.8
    },
    ...initialSettings
  });

  const { isResourceOperationSafe } = useRecording();
  const transcriberRef = useRef<any>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<Date | null>(null);
  const isIOS = detectDevice().isIOS;

  const formatDuration = useCallback((seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const handleTranscriptData = useCallback((data: any) => {
    const newTranscript: TranscriptData = {
      text: data.text || '',
      speaker: data.speaker || 'Speaker',
      confidence: data.confidence || 0,
      timestamp: new Date().toISOString(),
      isFinal: data.is_final || false
    };

    setState(prev => {
      const updatedTranscripts = [...prev.realtimeTranscripts, newTranscript];
      const fullTranscript = updatedTranscripts
        .filter(t => t.isFinal)
        .map(t => t.text)
        .join(' ');
      
      const wordCount = fullTranscript.trim().split(/\s+/).filter(word => word.length > 0).length;
      
      return {
        ...prev,
        realtimeTranscripts: updatedTranscripts,
        transcript: fullTranscript,
        wordCount,
        chunkCounter: prev.chunkCounter + 1
      };
    });

    onTranscriptUpdate(newTranscript.text);
    onWordCountUpdate(state.wordCount);
  }, [onTranscriptUpdate, onWordCountUpdate, state.wordCount]);

  const createTranscriber = useCallback(() => {
    const onStatusChange = (status: string) => {
      setState(prev => ({ 
        ...prev, 
        isConnected: status === 'connected' || status === 'recording' 
      }));
    };

    const onError = (error: string) => {
      console.error('Transcriber error:', error);
      toast.error(`Transcription error: ${error}`);
    };

    if (settings.transcriberService === 'deepgram') {
      return new DeepgramTranscriber(
        handleTranscriptData,
        onError,
        onStatusChange
      );
    } else {
      if (isIOS) {
        return new iPhoneWhisperTranscriber(
          handleTranscriptData,
          onError,
          onStatusChange
        );
      } else {
        return new DesktopWhisperTranscriber(
          handleTranscriptData,
          onError,
          onStatusChange
        );
      }
    }
  }, [settings.transcriberService, isIOS, handleTranscriptData]);

  const startRecording = useCallback(async () => {
    if (!isResourceOperationSafe()) {
      toast.error('Cannot start recording while another operation is in progress');
      return false;
    }

    try {
      setState(prev => ({ ...prev, isRecording: true }));
      
      const transcriber = createTranscriber();
      transcriberRef.current = transcriber;
      
      await transcriber.startTranscription();
      
      startTimeRef.current = new Date();
      durationIntervalRef.current = setInterval(() => {
        if (startTimeRef.current) {
          const elapsed = Math.floor((Date.now() - startTimeRef.current.getTime()) / 1000);
          setState(prev => ({ ...prev, duration: elapsed }));
          onDurationUpdate(formatDuration(elapsed));
        }
      }, 1000);

      toast.success('Recording started');
      return true;
    } catch (error) {
      console.error('Failed to start recording:', error);
      toast.error('Failed to start recording');
      setState(prev => ({ ...prev, isRecording: false }));
      return false;
    }
  }, [isResourceOperationSafe, createTranscriber, onDurationUpdate, formatDuration]);

  const stopRecording = useCallback(async () => {
    setState(prev => ({ ...prev, isStoppingRecording: true }));

    try {
      if (transcriberRef.current) {
        await transcriberRef.current.stopTranscription();
        transcriberRef.current = null;
      }

      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }

      setState(prev => ({
        ...prev,
        isRecording: false,
        isStoppingRecording: false,
        isConnected: false
      }));

      toast.success('Recording stopped');
      return true;
    } catch (error) {
      console.error('Failed to stop recording:', error);
      toast.error('Failed to stop recording');
      setState(prev => ({ ...prev, isStoppingRecording: false }));
      return false;
    }
  }, []);

  const resetRecording = useCallback(() => {
    setState({
      isRecording: false,
      isStoppingRecording: false,
      duration: 0,
      transcript: '',
      realtimeTranscripts: [],
      wordCount: 0,
      speakerCount: 1,
      isConnected: false,
      chunkCounter: 0
    });
    
    onTranscriptUpdate('');
    onDurationUpdate('0:00');
    onWordCountUpdate(0);
  }, [onTranscriptUpdate, onDurationUpdate, onWordCountUpdate]);

  useEffect(() => {
    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      if (transcriberRef.current) {
        transcriberRef.current.stopTranscription();
      }
    };
  }, []);

  return {
    state,
    settings,
    setSettings,
    startRecording,
    stopRecording,
    resetRecording,
    formatDuration
  };
}