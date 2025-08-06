import { useState, useRef, useCallback } from 'react';
import { GPScribeAudioCapture } from '@/utils/GPScribeAudioCapture';

interface TranscriptData {
  text: string;
  speaker: string;
  confidence: number;
  timestamp: string;
  isFinal: boolean;
  isConsultation?: boolean;
}

interface GPScribeRecordingState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  transcript: string;
  connectionStatus: string;
  wordCount: number;
}

export const useGPScribeRecording = () => {
  // Recording state
  const [state, setState] = useState<GPScribeRecordingState>({
    isRecording: false,
    isPaused: false,
    duration: 0,
    transcript: '',
    connectionStatus: 'Disconnected',
    wordCount: 0
  });

  // Refs for recording management
  const audioCapture = useRef<GPScribeAudioCapture | null>(null);
  const durationInterval = useRef<NodeJS.Timeout | null>(null);
  const transcriptBuffer = useRef<string>('');

  // Update state helper
  const updateState = useCallback((updates: Partial<GPScribeRecordingState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  // Handle incoming transcript data from consultation
  const handleTranscript = useCallback((transcriptData: TranscriptData) => {
    console.log('📝 GP Scribe transcript received:', transcriptData);
    
    if (transcriptData.isFinal && transcriptData.text.trim()) {
      // Append to transcript buffer for consultations
      const newText = transcriptData.text.trim();
      transcriptBuffer.current += (transcriptBuffer.current ? ' ' : '') + newText;
      
      // Update transcript and word count
      const words = transcriptBuffer.current.split(/\s+/).filter(word => word.length > 0);
      
      updateState({
        transcript: transcriptBuffer.current,
        wordCount: words.length
      });

      console.log(`📊 Consultation transcript updated: ${words.length} words`);
    }
  }, [updateState]);

  // Handle transcription errors
  const handleTranscriptionError = useCallback((error: string) => {
    console.error('🚨 GP Scribe transcription error:', error);
    updateState({ connectionStatus: 'Error' });
  }, [updateState]);

  // Handle status changes
  const handleStatusChange = useCallback((status: string) => {
    console.log('📡 GP Scribe status:', status);
    updateState({ connectionStatus: status });
  }, [updateState]);

  // Start consultation recording
  const startRecording = useCallback(async () => {
    try {
      console.log('🎙️ Starting GP Scribe consultation recording...');
      
      // Initialize audio capture for consultation
      audioCapture.current = new GPScribeAudioCapture(
        handleTranscript,
        handleTranscriptionError,
        handleStatusChange
      );
      
      await audioCapture.current.startCapture();
      
      // Reset state for new consultation
      transcriptBuffer.current = '';
      
      updateState({
        isRecording: true,
        isPaused: false,
        duration: 0,
        transcript: '',
        wordCount: 0,
        connectionStatus: 'Connecting...'
      });

      // Start duration timer for consultation
      durationInterval.current = setInterval(() => {
        setState(prev => ({ ...prev, duration: prev.duration + 1 }));
      }, 1000);

      console.log('✅ GP Scribe consultation recording started');
      
    } catch (error) {
      console.error('❌ Failed to start GP Scribe recording:', error);
      updateState({ 
        connectionStatus: 'Error',
        isRecording: false 
      });
      throw error;
    }
  }, [handleTranscript, handleTranscriptionError, handleStatusChange, updateState]);

  // Stop consultation recording
  const stopRecording = useCallback(async () => {
    try {
      console.log('🛑 Stopping GP Scribe consultation recording...');
      
      // Stop duration timer
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
        durationInterval.current = null;
      }

      // Stop audio capture
      if (audioCapture.current) {
        audioCapture.current.stopCapture();
        audioCapture.current = null;
      }

      updateState({
        isRecording: false,
        isPaused: false,
        connectionStatus: 'Stopped'
      });

      console.log('✅ GP Scribe consultation recording stopped');
      
    } catch (error) {
      console.error('❌ Error stopping GP Scribe recording:', error);
      updateState({ connectionStatus: 'Error' });
    }
  }, [updateState]);

  // Pause consultation recording
  const pauseRecording = useCallback(() => {
    try {
      if (audioCapture.current) {
        audioCapture.current.pauseConsultation();
        updateState({ isPaused: true });
        console.log('⏸️ GP Scribe consultation paused');
      }
    } catch (error) {
      console.error('❌ Error pausing GP Scribe recording:', error);
    }
  }, [updateState]);

  // Resume consultation recording
  const resumeRecording = useCallback(() => {
    try {
      if (audioCapture.current) {
        audioCapture.current.resumeConsultation();
        updateState({ isPaused: false });
        console.log('▶️ GP Scribe consultation resumed');
      }
    } catch (error) {
      console.error('❌ Error resuming GP Scribe recording:', error);
    }
  }, [updateState]);

  // Reset consultation session
  const resetSession = useCallback(() => {
    try {
      // Stop any active recording
      if (state.isRecording) {
        stopRecording();
      }

      // Clear all state
      transcriptBuffer.current = '';
      
      updateState({
        isRecording: false,
        isPaused: false,
        duration: 0,
        transcript: '',
        wordCount: 0,
        connectionStatus: 'Disconnected'
      });

      console.log('🔄 GP Scribe session reset');
      
    } catch (error) {
      console.error('❌ Error resetting GP Scribe session:', error);
    }
  }, [state.isRecording, stopRecording, updateState]);

  // Format duration helper
  const formatDuration = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Get consultation summary data
  const getConsultationData = useCallback(() => {
    return {
      transcript: transcriptBuffer.current,
      duration: state.duration,
      wordCount: state.wordCount,
      formattedDuration: formatDuration(state.duration),
      timestamp: new Date().toISOString(),
      type: 'gp_consultation'
    };
  }, [state.duration, state.wordCount, formatDuration]);

  // Check if recording is active
  const isActive = useCallback(() => {
    return audioCapture.current?.isActive() || false;
  }, []);

  return {
    // State
    ...state,
    
    // Actions
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    resetSession,
    
    // Helpers
    formatDuration: () => formatDuration(state.duration),
    getConsultationData,
    isActive,
    
    // Raw transcript for external processing
    getRawTranscript: () => transcriptBuffer.current
  };
};