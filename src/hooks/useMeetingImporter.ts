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
        title: data.title,
        transcript: '', // Will be stored in meeting_transcripts table
        duration: '0:00',
        word_count: data.transcript.split(/\s+/).filter(word => word.trim()).length,
        speaker_count: 1,
        start_time: new Date().toISOString(),
        meeting_format: data.format || 'imported',
        participants: data.attendees.map(a => a.name),
        agenda: data.agenda || '',
        status: 'completed',
        import_source: data.source,
        import_metadata: {
          imported_at: new Date().toISOString(),
          original_length: data.transcript.length,
          attendees_count: data.attendees.length
        },
        meeting_configuration: {
          title: data.title,
          attendees: data.attendees,
          agenda: data.agenda,
          format: data.format,
          import_source: data.source
        },
        notes_generation_status: 'pending'
      };

      setProgress(30);
      const { data: meeting, error: meetingError } = await supabase
        .from('meetings')
        .insert(meetingData)
        .select()
        .single();

      if (meetingError) throw meetingError;

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