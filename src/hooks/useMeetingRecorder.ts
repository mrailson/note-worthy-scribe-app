import { useState, useEffect, useRef, useCallback } from 'react';
import { AudioService, AudioServiceCallbacks } from '@/services/AudioService';
import { TranscriptionService, TranscriptionServiceCallbacks, TranscriptData } from '@/services/TranscriptionService';
import { MeetingService, MeetingData, MeetingServiceCallbacks } from '@/services/MeetingService';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface UseMeetingRecorderOptions {
  initialSettings?: {
    title: string;
    description: string;
    meetingType: string;
  };
  onTranscriptUpdate?: (transcript: string) => void;
  onDurationUpdate?: (duration: string) => void;
  onWordCountUpdate?: (count: number) => void;
}

export interface MeetingRecorderState {
  isRecording: boolean;
  duration: number;
  transcript: string;
  wordCount: number;
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
  realtimeTranscripts: TranscriptData[];
  meetingSettings: {
    title: string;
    description: string;
    meetingType: string;
  };
}

export const useMeetingRecorder = (options: UseMeetingRecorderOptions = {}) => {
  const { user } = useAuth();
  const [state, setState] = useState<MeetingRecorderState>({
    isRecording: false,
    duration: 0,
    transcript: '',
    wordCount: 0,
    connectionStatus: 'disconnected',
    realtimeTranscripts: [],
    meetingSettings: options.initialSettings || {
      title: 'General Meeting',
      description: '',
      meetingType: 'general'
    }
  });

  // Service instances
  const audioServiceRef = useRef<AudioService | null>(null);
  const transcriptionServiceRef = useRef<TranscriptionService | null>(null);
  const meetingServiceRef = useRef<MeetingService | null>(null);
  
  // Timers and refs
  const durationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<Date | null>(null);
  const accumulatedTranscriptRef = useRef<string>('');

  // Service callbacks
  const audioCallbacks: AudioServiceCallbacks = {
    onError: (error) => {
      console.error('Audio service error:', error);
      setState(prev => ({ ...prev, connectionStatus: 'error' }));
      toast.error('Audio capture error');
    },
    onStatusChange: (status) => {
      setState(prev => ({ ...prev, connectionStatus: status }));
    }
  };

  const transcriptionCallbacks: TranscriptionServiceCallbacks = {
    onTranscript: (data) => {
      handleTranscriptData(data);
    },
    onError: (error) => {
      console.error('Transcription error:', error);
      toast.error('Transcription error');
    },
    onStatusChange: (status) => {
      setState(prev => ({ ...prev, connectionStatus: status }));
    }
  };

  const meetingCallbacks: MeetingServiceCallbacks = {
    onMeetingSaved: (meetingId) => {
      console.log('Meeting saved with ID:', meetingId);
    },
    onError: (error) => {
      console.error('Meeting service error:', error);
      toast.error('Meeting save error');
    }
  };

  // Initialize services
  useEffect(() => {
    audioServiceRef.current = new AudioService(audioCallbacks);
    transcriptionServiceRef.current = new TranscriptionService(transcriptionCallbacks);
    meetingServiceRef.current = new MeetingService(meetingCallbacks);

    return () => {
      // Cleanup services
      audioServiceRef.current?.stopCapture();
      transcriptionServiceRef.current?.stopTranscription();
      
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
      }
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
      }
    };
  }, []);

  // Handle transcript data
  const handleTranscriptData = useCallback((data: TranscriptData) => {
    setState(prev => {
      const newTranscripts = [...prev.realtimeTranscripts];
      
      // Update or add transcript segment
      const existingIndex = newTranscripts.findIndex(t => 
        Math.abs(new Date(t.timestamp).getTime() - new Date(data.timestamp).getTime()) < 1000
      );

      if (existingIndex !== -1) {
        newTranscripts[existingIndex] = data;
      } else {
        newTranscripts.push(data);
      }

      // Update accumulated transcript
      const fullTranscript = newTranscripts
        .filter(t => t.isFinal)
        .map(t => t.text)
        .join(' ');

      const wordCount = fullTranscript.split(' ').filter(word => word.length > 0).length;

      // Save transcript segment to meeting service
      if (data.isFinal && meetingServiceRef.current) {
        meetingServiceRef.current.addTranscriptSegment(data);
      }

      return {
        ...prev,
        realtimeTranscripts: newTranscripts,
        transcript: fullTranscript,
        wordCount
      };
    });
  }, []);

  // Start recording
  const startRecording = useCallback(async () => {
    if (!user) {
      toast.error('Please log in to start recording');
      return;
    }

    try {
      setState(prev => ({ ...prev, isRecording: true, connectionStatus: 'connecting' }));
      
      // Create new meeting
      const meetingData: Omit<MeetingData, 'id'> = {
        title: state.meetingSettings.title,
        description: state.meetingSettings.description,
        meetingType: state.meetingSettings.meetingType,
        startTime: new Date().toISOString(),
        duration: 0,
        status: 'in-progress',
        transcript: '',
        wordCount: 0,
        speakerCount: 1
      };

      const meetingId = await meetingServiceRef.current!.createMeeting(meetingData);
      
      // Start audio capture
      await audioServiceRef.current!.startCapture();
      
      // Start transcription
      await transcriptionServiceRef.current!.startTranscription();

      // Start duration timer
      startTimeRef.current = new Date();
      durationTimerRef.current = setInterval(() => {
        setState(prev => ({ ...prev, duration: prev.duration + 1 }));
      }, 1000);

      // Start auto-save timer
      autoSaveTimerRef.current = setInterval(() => {
        autoSaveMeeting();
      }, 30000); // Auto-save every 30 seconds

      toast.success('Recording started');

    } catch (error) {
      console.error('Failed to start recording:', error);
      setState(prev => ({ ...prev, isRecording: false, connectionStatus: 'error' }));
      toast.error('Failed to start recording');
    }
  }, [user, state.meetingSettings]);

  // Stop recording
  const stopRecording = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isRecording: false }));

      // Stop services
      audioServiceRef.current?.stopCapture();
      transcriptionServiceRef.current?.stopTranscription();

      // Stop timers
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }

      // Update meeting status
      const meetingId = meetingServiceRef.current?.getCurrentMeetingId();
      if (meetingId) {
        await meetingServiceRef.current!.updateMeeting(meetingId, {
          endTime: new Date().toISOString(),
          duration: state.duration,
          status: 'completed',
          transcript: state.transcript,
          wordCount: state.wordCount
        });
      }

      // Clear auto-saved data
      meetingServiceRef.current?.clearAutoSavedMeeting();

      toast.success('Recording stopped and saved');

    } catch (error) {
      console.error('Failed to stop recording:', error);
      toast.error('Failed to stop recording properly');
    }
  }, [state.duration, state.transcript, state.wordCount]);

  // Auto-save function
  const autoSaveMeeting = useCallback(() => {
    if (!state.isRecording || state.wordCount < 5) return;

    const autoSaveData: Partial<MeetingData> = {
      title: state.meetingSettings.title,
      duration: state.duration,
      transcript: state.transcript,
      wordCount: state.wordCount,
      status: 'in-progress'
    };

    meetingServiceRef.current?.autoSaveToLocalStorage(autoSaveData);
  }, [state]);

  // Update settings
  const updateSettings = useCallback((newSettings: Partial<typeof state.meetingSettings>) => {
    setState(prev => ({
      ...prev,
      meetingSettings: { ...prev.meetingSettings, ...newSettings }
    }));
  }, []);

  // Format duration for display
  const formatDuration = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Effect to call parent callbacks
  useEffect(() => {
    options.onTranscriptUpdate?.(state.transcript);
  }, [state.transcript, options.onTranscriptUpdate]);

  useEffect(() => {
    options.onDurationUpdate?.(formatDuration(state.duration));
  }, [state.duration, options.onDurationUpdate, formatDuration]);

  useEffect(() => {
    options.onWordCountUpdate?.(state.wordCount);
  }, [state.wordCount, options.onWordCountUpdate]);

  // Load auto-saved meeting on mount
  useEffect(() => {
    const autoSaved = meetingServiceRef.current?.loadAutoSavedMeeting();
    if (autoSaved && autoSaved.transcript) {
      setState(prev => ({
        ...prev,
        transcript: autoSaved.transcript || '',
        wordCount: autoSaved.wordCount || 0,
        duration: autoSaved.duration || 0,
        meetingSettings: {
          ...prev.meetingSettings,
          title: autoSaved.title || prev.meetingSettings.title
        }
      }));
      toast.info('Restored unsaved meeting data');
    }
  }, []);

  return {
    // State
    ...state,
    formattedDuration: formatDuration(state.duration),
    
    // Actions
    startRecording,
    stopRecording,
    updateSettings,
    
    // Services (for advanced usage)
    audioService: audioServiceRef.current,
    transcriptionService: transcriptionServiceRef.current,
    meetingService: meetingServiceRef.current
  };
};