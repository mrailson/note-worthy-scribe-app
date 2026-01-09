import { useState, useEffect, useRef } from "react";
import { AudioBackupInfo, MeetingData } from "@/types/meetingTypes";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { showToast } from '@/utils/toastWrapper';

export const useMeetingAudio = (meetingData: MeetingData | null) => {
  const { user } = useAuth();
  const [audioSegments, setAudioSegments] = useState<any[]>([]);
  const [isAudioSegmentsOpen, setIsAudioSegmentsOpen] = useState(false);
  const [audioBackupInfo, setAudioBackupInfo] = useState<AudioBackupInfo | null>(null);
  const [transcriptTruncated, setTranscriptTruncated] = useState(false);
  const [backupRecord, setBackupRecord] = useState<any | null>(null);
  const [isReprocessing, setIsReprocessing] = useState(false);
  const [reprocessStatus, setReprocessStatus] = useState<string | null>(null);
  const autoReprocessTriggered = useRef(false);

  const checkAudioBackupAndTruncation = async () => {
    if (!meetingData?.id) return;
    
    try {
      // First check for direct audio backup match
      let backup = null;
      let { data: directBackup, error } = await supabase
        .from('meeting_audio_backups')
        .select('file_path, file_size, meeting_id')
        .eq('meeting_id', meetingData.id)
        .single();
      
      if (!error && directBackup) {
        backup = directBackup;
      } else {
        // If no direct match, check for backups by user and time proximity
        const meetingTime = meetingData.startTime ? new Date(meetingData.startTime) : new Date();
        const timeWindow = 30 * 60 * 1000; // 30 minutes window
        
        const { data: proximityBackups } = await supabase
          .from('meeting_audio_backups')
          .select('file_path, file_size, meeting_id, created_at')
          .eq('user_id', user?.id)
          .gte('created_at', new Date(meetingTime.getTime() - timeWindow).toISOString())
          .lte('created_at', new Date(meetingTime.getTime() + timeWindow).toISOString())
          .order('file_size', { ascending: false })
          .limit(1);
        
        if (proximityBackups && proximityBackups.length > 0) {
          backup = proximityBackups[0];
          console.log('🔍 Found audio backup by proximity:', backup);
        }
      }
      
      if (backup) {
        setAudioBackupInfo(backup);
        
        // Check if transcript seems truncated for long meetings
        const duration = meetingData.duration?.split(':').map(Number) || [0, 0];
        const totalMinutes = duration[0] + (duration[1] || 0);
        
        const isPartnersLongMeeting = meetingData.title?.includes('Partners') && 
                                      (totalMinutes > 45 || meetingData.duration === '58');
        
        if (meetingData.transcript && (totalMinutes > 45 || isPartnersLongMeeting)) {
          const transcriptLength = meetingData.transcript.length;
          const expectedMinLength = (totalMinutes || 58) * 150;
          
          if (transcriptLength < expectedMinLength * 0.7 || isPartnersLongMeeting) {
            setTranscriptTruncated(true);
            
            await supabase.functions.invoke('meeting-length-monitor', {
              body: {
                action: 'monitor_length',
                meetingId: meetingData.id,
                userId: user?.id,
                currentDuration: totalMinutes || 58
              }
            });
          }
        }
      }
    } catch (error) {
      console.error('Error checking audio backup:', error);
    }
  };

  const reprocessWithBackup = async () => {
    if (!audioBackupInfo || !meetingData?.id) return;

    setIsReprocessing(true);
    setReprocessStatus("Starting reprocessing...");

    try {
      const { data, error } = await supabase.functions.invoke('reprocess-audio-backup', {
        body: {
          meetingId: meetingData.id,
          backupFilePath: audioBackupInfo.file_path,
          currentTranscript: meetingData.transcript
        }
      });

      if (error) throw error;
      
      if (data?.success) {
        showToast.success("Meeting successfully reprocessed with full audio!", { section: 'meeting_manager' });
        setTranscriptTruncated(false);
        window.location.reload();
      }
    } catch (error) {
      console.error('Reprocessing error:', error);
      showToast.error("Failed to reprocess meeting", { section: 'meeting_manager' });
      setReprocessStatus("Failed to reprocess");
    } finally {
      setIsReprocessing(false);
    }
  };

  useEffect(() => {
    checkAudioBackupAndTruncation();
  }, [meetingData?.id]);

  return {
    audioSegments,
    setAudioSegments,
    isAudioSegmentsOpen,
    setIsAudioSegmentsOpen,
    audioBackupInfo,
    transcriptTruncated,
    backupRecord,
    setBackupRecord,
    isReprocessing,
    reprocessStatus,
    autoReprocessTriggered,
    reprocessWithBackup
  };
};