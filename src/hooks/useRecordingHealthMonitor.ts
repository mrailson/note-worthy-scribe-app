import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { showToast } from '@/utils/toastWrapper';

interface UseRecordingHealthMonitorProps {
  meetingId: string | null;
  isRecording: boolean;
  lastChunkTimestamp: number | null;
  onServerClosureDetected: () => void;
  onRecordingStalled?: () => void;
}

interface HealthMonitorState {
  lastServerCheck: Date | null;
  serverStatus: 'recording' | 'completed' | 'unknown';
  stalledWarningShown: boolean;
  criticalWarningShown: boolean;
}

/**
 * Hook to monitor recording health and detect server-side closures or stalls.
 * 
 * Features:
 * 1. Polls meeting status every 30s to detect server-side auto-closures
 * 2. Warns after 60s of no transcription activity
 * 3. Shows critical warning after 120s of no activity
 * 4. Re-checks status when tab becomes visible (handles backgrounded tabs)
 */
export const useRecordingHealthMonitor = ({
  meetingId,
  isRecording,
  lastChunkTimestamp,
  onServerClosureDetected,
  onRecordingStalled
}: UseRecordingHealthMonitorProps) => {
  const [state, setState] = useState<HealthMonitorState>({
    lastServerCheck: null,
    serverStatus: 'unknown',
    stalledWarningShown: false,
    criticalWarningShown: false
  });

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const criticalTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastChunkTimestampRef = useRef<number | null>(lastChunkTimestamp);

  // Keep ref in sync with prop
  useEffect(() => {
    lastChunkTimestampRef.current = lastChunkTimestamp;
    
    // Reset warnings when we get new transcription activity
    if (lastChunkTimestamp) {
      setState(prev => ({
        ...prev,
        stalledWarningShown: false,
        criticalWarningShown: false
      }));
    }
  }, [lastChunkTimestamp]);

  // Check meeting status in database
  const checkMeetingStatus = useCallback(async () => {
    if (!meetingId || !isRecording) return;

    try {
      const { data, error } = await supabase
        .from('meetings')
        .select('status')
        .eq('id', meetingId)
        .single();

      if (error) {
        console.warn('⚠️ Health monitor: Failed to check meeting status:', error.message);
        return;
      }

      const serverStatus = (data?.status as 'recording' | 'completed') || 'unknown';
      setState(prev => ({
        ...prev,
        lastServerCheck: new Date(),
        serverStatus: serverStatus as 'recording' | 'completed' | 'unknown'
      }));

      // If server shows meeting as completed but we're still recording
      if (serverStatus === 'completed' && isRecording) {
        console.error('🛑 Health monitor: Server closed meeting while client still recording!');
        showToast.error('Recording was ended by the server. Check your connection and audio input.', {
          section: 'meeting_manager',
          duration: 15000
        });
        onServerClosureDetected();
      }
    } catch (err) {
      console.warn('⚠️ Health monitor: Error checking meeting status:', err);
    }
  }, [meetingId, isRecording, onServerClosureDetected]);

  // Check for transcription stalls
  const checkForStalls = useCallback(() => {
    if (!isRecording || !lastChunkTimestampRef.current) return;

    const timeSinceLastChunk = Date.now() - lastChunkTimestampRef.current;

    // Warning after 60 seconds
    if (timeSinceLastChunk >= 60000 && !state.stalledWarningShown) {
      console.warn('⚠️ Health monitor: No transcription activity for 60s');
      showToast.warning('No speech detected for 1 minute. Check your audio input.', {
        section: 'meeting_manager',
        duration: 8000
      });
      setState(prev => ({ ...prev, stalledWarningShown: true }));
      onRecordingStalled?.();
    }

    // Critical warning after 120 seconds
    if (timeSinceLastChunk >= 120000 && !state.criticalWarningShown) {
      console.error('🚨 Health monitor: No transcription activity for 120s - recording may have stalled!');
      showToast.error('Recording may have stalled. Consider stopping and checking your setup.', {
        section: 'meeting_manager',
        duration: 15000
      });
      setState(prev => ({ ...prev, criticalWarningShown: true }));
    }
  }, [isRecording, state.stalledWarningShown, state.criticalWarningShown, onRecordingStalled]);

  // Handle visibility changes - re-check status when tab becomes visible
  useEffect(() => {
    if (!isRecording || !meetingId) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('📡 Health monitor: Tab visible - checking meeting status');
        // Immediate check when tab becomes visible
        checkMeetingStatus();
        checkForStalls();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isRecording, meetingId, checkMeetingStatus, checkForStalls]);

  // Start/stop polling based on recording state
  useEffect(() => {
    if (!isRecording || !meetingId) {
      // Clear all intervals and timeouts
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
        warningTimeoutRef.current = null;
      }
      if (criticalTimeoutRef.current) {
        clearTimeout(criticalTimeoutRef.current);
        criticalTimeoutRef.current = null;
      }
      // Reset state
      setState({
        lastServerCheck: null,
        serverStatus: 'unknown',
        stalledWarningShown: false,
        criticalWarningShown: false
      });
      return;
    }

    console.log('📡 Health monitor: Starting for meeting', meetingId);

    // Poll meeting status every 30 seconds
    pollIntervalRef.current = setInterval(() => {
      checkMeetingStatus();
      checkForStalls();
    }, 30000);

    // Also do an initial check after 10 seconds
    const initialCheckTimeout = setTimeout(() => {
      checkMeetingStatus();
    }, 10000);

    return () => {
      clearTimeout(initialCheckTimeout);
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [isRecording, meetingId, checkMeetingStatus, checkForStalls]);

  return {
    lastServerCheck: state.lastServerCheck,
    serverStatus: state.serverStatus,
    isStalled: state.stalledWarningShown || state.criticalWarningShown,
    forceCheck: checkMeetingStatus
  };
};
