import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { showToast } from '@/utils/toastWrapper';

/**
 * Hook to listen for server-side kill signals for a meeting.
 * When the server auto-closes an inactive meeting, it broadcasts a 'force_stop' event
 * that this hook listens for and triggers the client-side stop.
 */
export const useMeetingKillSignal = (
  meetingId: string | null,
  isRecording: boolean,
  onKillSignal: () => void
) => {
  useEffect(() => {
    // Only subscribe when we have a meeting ID and are recording
    if (!meetingId || !isRecording) return;

    console.log(`📡 Subscribing to kill signal channel for meeting: ${meetingId}`);

    const channel = supabase
      .channel(`meeting-kill:${meetingId}`)
      .on('broadcast', { event: 'force_stop' }, (payload) => {
        console.log('🛑 Received server kill signal:', payload);
        showToast.warning('Recording ended by system due to inactivity', { 
          section: 'meeting_manager',
          duration: 10000 
        });
        onKillSignal();
      })
      .subscribe((status) => {
        console.log(`📡 Kill signal channel status: ${status}`);
      });

    return () => {
      console.log(`📡 Unsubscribing from kill signal channel for meeting: ${meetingId}`);
      supabase.removeChannel(channel);
    };
  }, [meetingId, isRecording, onKillSignal]);
};
