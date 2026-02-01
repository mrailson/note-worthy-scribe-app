import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { showToast } from '@/utils/toastWrapper';

/**
 * Hook to listen for server-side kill signals for a meeting.
 * When the server auto-closes an inactive meeting, it broadcasts a 'force_stop' event
 * that this hook listens for and triggers the client-side stop.
 * 
 * Enhanced with:
 * - Visibility-aware reconnection (re-checks status when tab becomes visible)
 * - Direct database polling as fallback for missed broadcast messages
 */
export const useMeetingKillSignal = (
  meetingId: string | null,
  isRecording: boolean,
  onKillSignal: () => void
) => {
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const killTriggeredRef = useRef(false);

  // Stable callback ref
  const onKillSignalRef = useRef(onKillSignal);
  useEffect(() => {
    onKillSignalRef.current = onKillSignal;
  }, [onKillSignal]);

  // Check meeting status directly in database (fallback for missed broadcasts)
  const checkMeetingStatusDirectly = useCallback(async () => {
    if (!meetingId || !isRecording || killTriggeredRef.current) return;

    try {
      const { data, error } = await supabase
        .from('meetings')
        .select('status')
        .eq('id', meetingId)
        .single();

      if (error) {
        console.warn('⚠️ Kill signal: Failed to check meeting status:', error.message);
        return;
      }

      // If server shows meeting as completed but we're still recording
      if (data?.status === 'completed') {
        console.log('🛑 Kill signal: Detected server-side closure via direct check');
        killTriggeredRef.current = true;
        showToast.warning('Recording was ended by the server due to inactivity', {
          section: 'meeting_manager',
          duration: 10000
        });
        onKillSignalRef.current();
      }
    } catch (err) {
      console.warn('⚠️ Kill signal: Error checking meeting status:', err);
    }
  }, [meetingId, isRecording]);

  // Handle visibility changes - re-check status when tab becomes visible
  useEffect(() => {
    if (!meetingId || !isRecording) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('📡 Kill signal: Tab visible - checking for missed closure');
        // Small delay to let any pending broadcasts arrive
        setTimeout(checkMeetingStatusDirectly, 500);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [meetingId, isRecording, checkMeetingStatusDirectly]);

  // Main subscription effect
  useEffect(() => {
    // Only subscribe when we have a meeting ID and are recording
    if (!meetingId || !isRecording) {
      killTriggeredRef.current = false;
      return;
    }

    console.log(`📡 Subscribing to kill signal channel for meeting: ${meetingId}`);

    const channel = supabase
      .channel(`meeting-kill:${meetingId}`)
      .on('broadcast', { event: 'force_stop' }, (payload) => {
        if (killTriggeredRef.current) {
          console.log('🛑 Kill signal: Already triggered, ignoring duplicate');
          return;
        }
        
        console.log('🛑 Received server kill signal:', payload);
        killTriggeredRef.current = true;
        
        // Use persistent toast that stays visible even if tab was backgrounded
        showToast.warning('Recording ended by system due to inactivity', {
          section: 'meeting_manager',
          duration: 15000
        });
        
        onKillSignalRef.current();
      })
      .subscribe((status) => {
        console.log(`📡 Kill signal channel status: ${status}`);
        
        // If subscription fails, fall back to polling
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('⚠️ Kill signal: Channel error, will rely on direct polling');
        }
      });

    channelRef.current = channel;

    return () => {
      console.log(`📡 Unsubscribing from kill signal channel for meeting: ${meetingId}`);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [meetingId, isRecording, checkMeetingStatusDirectly]);
};
