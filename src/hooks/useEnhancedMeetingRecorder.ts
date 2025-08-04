import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { EnhancedTranscriptionService, TranscriptionResult, EnhancedTranscriptionCallbacks } from '@/services/EnhancedTranscriptionService';
import { supabase } from '@/integrations/supabase/client';

export interface UseEnhancedMeetingRecorderOptions {
  initialSettings?: {
    title: string;
    description: string;
    meetingType: string;
  };
  onTranscriptUpdate?: (transcript: string) => void;
  onDurationUpdate?: (duration: string) => void;
  onWordCountUpdate?: (count: number) => void;
  onChunkProcessed?: (result: TranscriptionResult) => void;
  contextPrompt?: string;
  enableSystemAudio?: boolean;
}

export interface EnhancedMeetingRecorderState {
  isRecording: boolean;
  duration: number;
  transcript: string;
  wordCount: number;
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
  chunksProcessed: number;
  totalChunks: number;
  currentMeetingId: string | null;
  sessionInfo: any;
  transcriptionResults: TranscriptionResult[];
  meetingSettings: {
    title: string;
    description: string;
    meetingType: string;
  };
}

export const useEnhancedMeetingRecorder = (options: UseEnhancedMeetingRecorderOptions = {}) => {
  const { user } = useAuth();
  const transcriptionServiceRef = useRef<EnhancedTranscriptionService | null>(null);
  const durationTimerRef = useRef<number | null>(null);
  const startTimeRef = useRef<Date | null>(null);

  const [state, setState] = useState<EnhancedMeetingRecorderState>({
    isRecording: false,
    duration: 0,
    transcript: '',
    wordCount: 0,
    connectionStatus: 'disconnected',
    chunksProcessed: 0,
    totalChunks: 0,
    currentMeetingId: null,
    sessionInfo: null,
    transcriptionResults: [],
    meetingSettings: {
      title: options.initialSettings?.title || '',
      description: options.initialSettings?.description || '',
      meetingType: options.initialSettings?.meetingType || 'general'
    }
  });

  // Initialize transcription service callbacks
  const transcriptionCallbacks: EnhancedTranscriptionCallbacks = {
    onTranscriptionResult: useCallback((result: TranscriptionResult) => {
      console.log('Received transcription result:', result);
      
      setState(prev => {
        const newResults = [...prev.transcriptionResults, result];
        
        // Update combined transcript
        const newTranscript = newResults
          .filter(r => !r.skipped && !r.error && r.transcript)
          .sort((a, b) => a.chunkNumber - b.chunkNumber)
          .map(r => r.transcript)
          .join(' ');
        
        const wordCount = newTranscript.split(/\s+/).filter(word => word.length > 0).length;
        
        return {
          ...prev,
          transcriptionResults: newResults,
          transcript: newTranscript,
          wordCount,
          chunksProcessed: prev.chunksProcessed + 1
        };
      });

      // Call external callback
      options.onChunkProcessed?.(result);
    }, [options.onChunkProcessed]),

    onError: useCallback((error: Error) => {
      console.error('Enhanced transcription error:', error);
      toast.error(`Transcription error: ${error.message}`);
    }, []),

    onStatusChange: useCallback((status) => {
      console.log('Transcription status changed:', status);
      setState(prev => ({ ...prev, connectionStatus: status }));
    }, []),

    onSessionUpdate: useCallback((sessionInfo) => {
      setState(prev => ({ ...prev, sessionInfo }));
    }, [])
  };

  // Create meeting in database
  const createMeeting = useCallback(async () => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('meetings')
      .insert({
        user_id: user.id,
        title: state.meetingSettings.title || 'Enhanced Recording',
        description: state.meetingSettings.description,
        meeting_type: state.meetingSettings.meetingType,
        start_time: new Date().toISOString(),
        status: 'in-progress'
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to create meeting: ${error.message}`);
    }

    return data.id;
  }, [user, state.meetingSettings]);

  // Start recording
  const startRecording = useCallback(async () => {
    if (!user) {
      toast.error('Please log in to start recording');
      return;
    }

    try {
      console.log('Starting enhanced meeting recording...');
      setState(prev => ({ ...prev, isRecording: true, connectionStatus: 'connecting' }));

      // Create meeting
      const meetingId = await createMeeting();
      console.log('Meeting created with ID:', meetingId);

      // Initialize transcription service
      const transcriptionOptions = {
        meetingId,
        contextPrompt: options.contextPrompt || 'This is a professional meeting transcription. Please transcribe accurately.',
        enableSystemAudio: options.enableSystemAudio || false
      };

      transcriptionServiceRef.current = new EnhancedTranscriptionService(
        transcriptionCallbacks,
        transcriptionOptions
      );

      // Start transcription
      await transcriptionServiceRef.current.startTranscription();

      // Start duration timer
      startTimeRef.current = new Date();
      durationTimerRef.current = window.setInterval(() => {
        setState(prev => ({ ...prev, duration: prev.duration + 1 }));
      }, 1000);

      setState(prev => ({ 
        ...prev, 
        currentMeetingId: meetingId,
        connectionStatus: 'connected',
        transcriptionResults: [],
        transcript: '',
        wordCount: 0,
        chunksProcessed: 0
      }));

      toast.success('Enhanced recording started');
      console.log('Enhanced meeting recording started successfully');

    } catch (error) {
      console.error('Failed to start enhanced recording:', error);
      setState(prev => ({ 
        ...prev, 
        isRecording: false, 
        connectionStatus: 'error' 
      }));
      toast.error('Failed to start recording');
    }
  }, [user, createMeeting, transcriptionCallbacks, options.contextPrompt, options.enableSystemAudio]);

  // Stop recording
  const stopRecording = useCallback(async () => {
    try {
      console.log('Stopping enhanced meeting recording...');
      
      setState(prev => ({ ...prev, isRecording: false }));

      // Clear duration timer
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }

      // Stop transcription service
      if (transcriptionServiceRef.current) {
        await transcriptionServiceRef.current.stopTranscription();
      }

      // Update meeting in database
      if (state.currentMeetingId) {
        const endTime = new Date();
        const durationMinutes = startTimeRef.current 
          ? Math.round((endTime.getTime() - startTimeRef.current.getTime()) / 60000)
          : 0;

        await supabase
          .from('meetings')
          .update({
            end_time: endTime.toISOString(),
            duration_minutes: durationMinutes,
            status: 'completed'
          })
          .eq('id', state.currentMeetingId);

        console.log('Meeting updated with end time and duration');
      }

      toast.success('Recording stopped and saved');
      console.log('Enhanced meeting recording stopped successfully');

    } catch (error) {
      console.error('Error stopping enhanced recording:', error);
      toast.error('Error stopping recording');
    }
  }, [state.currentMeetingId]);

  // Pause recording
  const pauseRecording = useCallback(async () => {
    if (transcriptionServiceRef.current) {
      await transcriptionServiceRef.current.pauseTranscription();
      
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }
      
      toast.info('Recording paused');
    }
  }, []);

  // Resume recording
  const resumeRecording = useCallback(async () => {
    if (transcriptionServiceRef.current) {
      await transcriptionServiceRef.current.resumeTranscription();
      
      durationTimerRef.current = window.setInterval(() => {
        setState(prev => ({ ...prev, duration: prev.duration + 1 }));
      }, 1000);
      
      toast.info('Recording resumed');
    }
  }, []);

  // Update meeting settings
  const updateSettings = useCallback((newSettings: Partial<typeof state.meetingSettings>) => {
    setState(prev => ({
      ...prev,
      meetingSettings: { ...prev.meetingSettings, ...newSettings }
    }));
  }, []);

  // Get combined transcript
  const getCombinedTranscript = useCallback(async () => {
    if (transcriptionServiceRef.current) {
      return await transcriptionServiceRef.current.getCombinedTranscript();
    }
    return '';
  }, []);

  // Format duration
  const formatDuration = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Effect to call external callbacks
  useEffect(() => {
    options.onTranscriptUpdate?.(state.transcript);
  }, [state.transcript, options.onTranscriptUpdate]);

  useEffect(() => {
    options.onDurationUpdate?.(formatDuration(state.duration));
  }, [state.duration, options.onDurationUpdate, formatDuration]);

  useEffect(() => {
    options.onWordCountUpdate?.(state.wordCount);
  }, [state.wordCount, options.onWordCountUpdate]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (transcriptionServiceRef.current?.isActive()) {
        transcriptionServiceRef.current.stopTranscription();
      }
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
      }
    };
  }, []);

  return {
    // State
    ...state,
    formattedDuration: formatDuration(state.duration),
    
    // Actions
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    updateSettings,
    getCombinedTranscript,
    
    // Service info
    isTranscribing: transcriptionServiceRef.current?.isActive() || false,
    serviceInfo: transcriptionServiceRef.current?.getSessionInfo() || null
  };
};