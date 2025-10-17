import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface MeetingImportData {
  transcript: string;
  title: string;
  attendees: Array<{ name: string; title?: string; organization?: string }>;
  agenda?: string;
  format?: string;
  source: 'text_import' | 'audio_import' | 'file_import';
  isDemo?: boolean;
  demoType?: string;
}

export const useMeetingImporter = () => {
  const { user } = useAuth();
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');

  const importMeeting = useCallback(async (data: MeetingImportData): Promise<string> => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    setIsImporting(true);
    setProgress(10);
    setCurrentStep('Creating meeting record...');

    try {
      // Step 1: Create meeting record
      const meetingData = {
        user_id: user.id,
        title: data.isDemo ? `🎭 ${data.title}` : data.title,
        start_time: new Date().toISOString(),
        meeting_format: data.format || 'imported',
        status: 'completed',
        notes_generation_status: 'queued',
      };

      setProgress(30);
      const { data: meeting, error: meetingError } = await supabase
        .from('meetings')
        .insert(meetingData)
        .select()
        .single();

      if (meetingError) throw meetingError;

      // Automatically add user as attendee
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, email')
          .eq('id', user.id)
          .single();

        if (profile) {
          // Create or get user attendee record
          const { data: existingAttendee } = await supabase
            .from('attendees')
            .select('id')
            .eq('user_id', user.id)
            .eq('name', profile.full_name || 'Unknown')
            .maybeSingle();

          let attendeeId = existingAttendee?.id;

          if (!attendeeId) {
            const { data: newAttendee } = await supabase
              .from('attendees')
              .insert({
                user_id: user.id,
                name: profile.full_name || 'Unknown',
                email: profile.email,
                is_default: false
              })
              .select('id')
              .single();
            
            attendeeId = newAttendee?.id;
          }

          if (attendeeId) {
            await supabase
              .from('meeting_attendees')
              .insert({
                meeting_id: meeting.id,
                attendee_id: attendeeId
              });
          }
        }
      } catch (attendeeError) {
        console.warn('Failed to add user as attendee:', attendeeError);
      }

      setCurrentStep('Saving transcript...');
      setProgress(50);

      // Step 2: Store transcript in meeting_transcripts table
      const { error: transcriptError } = await supabase
        .from('meeting_transcripts')
        .insert({
          meeting_id: meeting.id,
          content: data.transcript,
          is_final: true
        });

      if (transcriptError) throw transcriptError;

      setCurrentStep('Queuing note generation...');
      setProgress(70);

      // Step 3: Queue automatic note generation
      const { error: queueError } = await supabase
        .from('meeting_notes_queue')
        .insert({
          meeting_id: meeting.id,
          detail_level: 'standard',
          status: 'pending',
          source: 'import'
        });

      if (queueError) throw queueError;

      setCurrentStep('Triggering note generation...');
      setProgress(90);

      // Step 4: Trigger background note generation
      try {
        await supabase.functions.invoke('auto-generate-meeting-notes', {
          body: { 
            meetingId: meeting.id,
            source: 'import',
            config: data
          }
        });
      } catch (functionError) {
        console.warn('Background note generation may not have started:', functionError);
      }

      setProgress(100);
      setCurrentStep('Complete!');

      return meeting.id;

    } catch (error) {
      console.error('Meeting import failed:', error);
      throw error;
    } finally {
      setTimeout(() => {
        setIsImporting(false);
        setProgress(0);
        setCurrentStep('');
      }, 1000);
    }
  }, [user]);

  return {
    importMeeting,
    isImporting,
    progress,
    currentStep
  };
};