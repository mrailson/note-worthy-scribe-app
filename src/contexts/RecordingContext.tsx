import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

interface RecordingContextType {
  isRecording: boolean;
  recordingMeetingId: string | null;
  audioContext: AudioContext | null;
  setRecordingState: (recording: boolean, meetingId?: string) => void;
  protectAudioContext: () => void;
  isResourceOperationSafe: () => boolean;
}

const RecordingContext = createContext<RecordingContextType | undefined>(undefined);

export const useRecording = () => {
  const context = useContext(RecordingContext);
  if (!context) {
    throw new Error('useRecording must be used within a RecordingProvider');
  }
  return context;
};

export const RecordingProvider = ({ children }: { children: React.ReactNode }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingMeetingId, setRecordingMeetingId] = useState<string | null>(null);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const protectionIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize and protect audio context
  const protectAudioContext = () => {
    if (!audioContext) {
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        setAudioContext(ctx);
        
        // Resume context if suspended
        if (ctx.state === 'suspended') {
          ctx.resume();
        }
      } catch (error) {
        console.warn('Failed to create audio context:', error);
      }
    }
  };

  // Monitor and maintain audio context during recording
  useEffect(() => {
    if (isRecording && audioContext) {
      protectionIntervalRef.current = setInterval(() => {
        if (audioContext.state === 'suspended') {
          console.log('🎵 Resuming suspended audio context during recording');
          audioContext.resume().catch(console.warn);
        }
      }, 1000);

      return () => {
        if (protectionIntervalRef.current) {
          clearInterval(protectionIntervalRef.current);
          protectionIntervalRef.current = null;
        }
      };
    }
  }, [isRecording, audioContext]);

  // Handle page visibility changes during recording
  useEffect(() => {
    if (isRecording) {
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible' && audioContext) {
          // Re-protect audio context when page becomes visible
          setTimeout(() => {
            if (audioContext.state === 'suspended') {
              audioContext.resume().catch(console.warn);
            }
          }, 100);
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);
      return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
  }, [isRecording, audioContext]);

  const setRecordingState = (recording: boolean, meetingId?: string) => {
    console.log('📹 Recording state changed:', { recording, meetingId });
    setIsRecording(recording);
    setRecordingMeetingId(recording ? (meetingId || null) : null);
    
    if (recording) {
      protectAudioContext();
    }
  };

  const isResourceOperationSafe = () => {
    return !isRecording;
  };

  const value = {
    isRecording,
    recordingMeetingId,
    audioContext,
    setRecordingState,
    protectAudioContext,
    isResourceOperationSafe,
  };

  return (
    <RecordingContext.Provider value={value}>
      {children}
    </RecordingContext.Provider>
  );
};