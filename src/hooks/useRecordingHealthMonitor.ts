import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { showToast } from '@/utils/toastWrapper';

interface UseRecordingHealthMonitorProps {
  meetingId: string | null;
  isRecording: boolean;
  lastChunkTimestamp: number | null;
  onServerClosureDetected: () => void;
  onRecordingStalled?: () => void;
  micStreamRef?: React.RefObject<MediaStream | null>;
  onTracksDied?: () => void;
  /** Called when the chunk delivery watchdog detects a stall */
  onChunkDeliveryStall?: (info: { stalledSeconds: number; recoveryAttempt: number }) => void;
}

interface HealthMonitorState {
  lastServerCheck: Date | null;
  serverStatus: 'recording' | 'completed' | 'unknown';
  stalledWarningShown: boolean;
  criticalWarningShown: boolean;
  chunkDeliveryStalled: boolean;
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
  onRecordingStalled,
  micStreamRef,
  onTracksDied,
  onChunkDeliveryStall
}: UseRecordingHealthMonitorProps) => {
  const [state, setState] = useState<HealthMonitorState>({
    lastServerCheck: null,
    serverStatus: 'unknown',
    stalledWarningShown: false,
    criticalWarningShown: false,
    chunkDeliveryStalled: false
  });

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const criticalTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastChunkTimestampRef = useRef<number | null>(lastChunkTimestamp);
  const trackDeathNotifiedRef = useRef(false);
  const trackHealthIntervalRef = useRef<NodeJS.Timeout | null>(null);

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
        showToast.error('Recording stopped unexpectedly. Your transcript has been saved.', {
          section: 'meeting_manager',
          duration: 15000
        });
        onServerClosureDetected();
      }
    } catch (err) {
      console.warn('⚠️ Health monitor: Error checking meeting status:', err);
    }
  }, [meetingId, isRecording, onServerClosureDetected]);

  // Timing constants for stall detection (in milliseconds)
  // Server auto-closes at 90 minutes, so warn well before that
  const WARNING_THRESHOLD_MS = 60 * 60 * 1000; // 60 minutes
  const CRITICAL_THRESHOLD_MS = 75 * 60 * 1000; // 75 minutes (15 mins before server auto-close)

  // Check for transcription stalls
  const checkForStalls = useCallback(() => {
    if (!isRecording || !lastChunkTimestampRef.current) return;

    const timeSinceLastChunk = Date.now() - lastChunkTimestampRef.current;

    // Warning after 60 minutes
    if (timeSinceLastChunk >= WARNING_THRESHOLD_MS && !state.stalledWarningShown) {
      console.warn('⚠️ Health monitor: No transcription activity for 60 minutes');
      showToast.warning('No audio activity for 1 hour. Recording will auto-close at 90 minutes.', {
        section: 'meeting_manager',
        duration: 15000
      });
      setState(prev => ({ ...prev, stalledWarningShown: true }));
      onRecordingStalled?.();
    }

    // Critical warning after 75 minutes (15 mins before auto-close)
    if (timeSinceLastChunk >= CRITICAL_THRESHOLD_MS && !state.criticalWarningShown) {
      console.error('🚨 Health monitor: No transcription activity for 75 mins - will auto-close in 15 mins!');
      showToast.error('Recording will auto-close in 15 minutes due to inactivity.', {
        section: 'meeting_manager',
        duration: 30000
      });
      setState(prev => ({ ...prev, criticalWarningShown: true }));
    }
  }, [isRecording, state.stalledWarningShown, state.criticalWarningShown, onRecordingStalled]);

  // Check if mic tracks are alive
  const checkTrackHealth = useCallback(() => {
    if (!isRecording || !micStreamRef?.current) return;

    const tracks = micStreamRef.current.getAudioTracks();
    if (tracks.length === 0) return;

    const allDead = tracks.every(t => t.readyState === 'ended');
    if (allDead && !trackDeathNotifiedRef.current) {
      trackDeathNotifiedRef.current = true;
      console.error('🔴 TRACK_HEALTH: all mic tracks ended while recording');
      showToast.error('Microphone was disconnected — recording may have stopped.', {
        section: 'meeting_manager',
        duration: 15000
      });
      onTracksDied?.();
    }
  }, [isRecording, micStreamRef, onTracksDied]);

  // Attach onended handlers to mic tracks
  useEffect(() => {
    if (!isRecording || !micStreamRef?.current) return;

    trackDeathNotifiedRef.current = false;
    const tracks = micStreamRef.current.getAudioTracks();

    const handler = (event: Event) => {
      const track = event.target as MediaStreamTrack;
      console.warn(`⚠️ TRACK_ENDED: mic track ended unexpectedly (label=${track.label}, readyState=${track.readyState})`);
      // Defer to the periodic check to decide if ALL tracks are dead
      checkTrackHealth();
    };

    tracks.forEach(track => {
      track.addEventListener('ended', handler);
    });

    return () => {
      tracks.forEach(track => {
        track.removeEventListener('ended', handler);
      });
    };
  }, [isRecording, micStreamRef, checkTrackHealth]);

  // Periodic track health check every 5 seconds
  useEffect(() => {
    if (!isRecording || !micStreamRef?.current) {
      if (trackHealthIntervalRef.current) {
        clearInterval(trackHealthIntervalRef.current);
        trackHealthIntervalRef.current = null;
      }
      return;
    }

    trackHealthIntervalRef.current = setInterval(checkTrackHealth, 5000);

    return () => {
      if (trackHealthIntervalRef.current) {
        clearInterval(trackHealthIntervalRef.current);
        trackHealthIntervalRef.current = null;
      }
    };
  }, [isRecording, micStreamRef, checkTrackHealth]);

  // Handle visibility changes - re-check status and track health when tab becomes visible
  useEffect(() => {
    if (!isRecording || !meetingId) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('📡 Health monitor: Tab visible - checking meeting status and track health');
        checkMeetingStatus();
        checkForStalls();
        checkTrackHealth();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isRecording, meetingId, checkMeetingStatus, checkForStalls, checkTrackHealth]);

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
      trackDeathNotifiedRef.current = false;
      setState({
        lastServerCheck: null,
        serverStatus: 'unknown',
        stalledWarningShown: false,
        criticalWarningShown: false,
        chunkDeliveryStalled: false
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

  /**
   * Handle chunk delivery stall events from the DesktopWhisperTranscriber watchdog.
   * Call this from the component that owns the transcriber instance.
   */
  const handleChunkDeliveryStall = useCallback((info: { stalledSeconds: number; recoveryAttempt: number }) => {
    console.warn(`🐕 Health monitor: Chunk delivery stall — ${info.stalledSeconds}s, recovery attempt ${info.recoveryAttempt}`);
    
    setState(prev => ({ ...prev, chunkDeliveryStalled: true }));
    
    if (info.recoveryAttempt === 1) {
      showToast.warning('Recording may have stalled — attempting recovery…', {
        section: 'meeting_manager',
        duration: 10000
      });
    } else if (info.recoveryAttempt >= 2) {
      showToast.error('Recording appears to have stopped. Please save your notes and restart.', {
        section: 'meeting_manager',
        duration: 30000
      });
    }
    
    onChunkDeliveryStall?.(info);
  }, [onChunkDeliveryStall]);

  return {
    lastServerCheck: state.lastServerCheck,
    serverStatus: state.serverStatus,
    isStalled: state.stalledWarningShown || state.criticalWarningShown,
    chunkDeliveryStalled: state.chunkDeliveryStalled,
    tracksAlive: !trackDeathNotifiedRef.current,
    forceCheck: checkMeetingStatus,
    handleChunkDeliveryStall
  };
};
