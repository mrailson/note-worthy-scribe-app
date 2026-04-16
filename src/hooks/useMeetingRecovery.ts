import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { showToast } from '@/utils/toastWrapper';

type RecoveryPhase = 'idle' | 'processing' | 'success' | 'failed';

interface RecoveryState {
  phase: RecoveryPhase;
  progress: number;
  resultMessage: string;
  errorMessage: string;
}

export function useMeetingRecovery(meetingId: string, onComplete?: (meetingId: string) => void) {
  const [state, setState] = useState<RecoveryState>({
    phase: 'idle',
    progress: 0,
    resultMessage: '',
    errorMessage: '',
  });

  const reset = () => setState({ phase: 'idle', progress: 0, resultMessage: '', errorMessage: '' });

  const pollForCompletion = async (label: string) => {
    let attempts = 0;
    const maxAttempts = 24;
    return new Promise<void>((resolve, reject) => {
      const interval = setInterval(async () => {
        attempts++;
        setState(s => ({ ...s, progress: Math.min(90, s.progress + Math.random() * 10) }));

        const { data: meeting } = await supabase
          .from('meetings')
          .select('word_count, status')
          .eq('id', meetingId)
          .single();

        if (meeting?.word_count && meeting.word_count > 0) {
          clearInterval(interval);
          setState({
            phase: 'success',
            progress: 100,
            resultMessage: `${label} complete · ${meeting.word_count.toLocaleString()} words transcribed`,
            errorMessage: '',
          });
          showToast.success(`${label} complete — ${meeting.word_count.toLocaleString()} words transcribed`, { section: 'meeting_manager' });
          setTimeout(() => onComplete?.(meetingId), 3500);
          resolve();
        } else if (attempts >= maxAttempts) {
          clearInterval(interval);
          setState(s => ({
            ...s,
            phase: 'failed',
            errorMessage: 'Processing is taking longer than expected. Check back shortly.',
          }));
          reject(new Error('Timeout'));
        }
      }, 5000);
    });
  };

  const reuploadAudio = async (file: File) => {
    setState({ phase: 'processing', progress: 5, resultMessage: '', errorMessage: '' });
    try {
      const ext = file.name.split('.').pop() || 'webm';
      const path = `meetings/${meetingId}/reupload_audio.${ext}`;

      const { error: upErr } = await supabase.storage
        .from('meeting-audio')
        .upload(path, file, { upsert: true, contentType: file.type });

      if (upErr) throw upErr;

      setState(s => ({ ...s, progress: 30 }));

      await supabase.from('meetings').update({
        audio_backup_path: path,
        whisper_transcript_text: null,
        best_of_all_transcript: null,
        overview: null,
        status: 'processing',
        notes_generation_status: 'not_started',
        updated_at: new Date().toISOString(),
      } as any).eq('id', meetingId);

      setState(s => ({ ...s, progress: 40 }));

      const { error: fnErr } = await supabase.functions.invoke('transcribe-offline-meeting', {
        body: { meetingId, chunkIndex: 0 },
      });
      if (fnErr) throw fnErr;

      await pollForCompletion('Reupload');
    } catch (err: any) {
      console.error('Reupload failed:', err);
      setState(s => ({
        ...s,
        phase: 'failed',
        errorMessage: err?.message || 'Reupload failed — please try again.',
      }));
      showToast.error(`Something went wrong — ${err?.message || 'unknown error'}`, { section: 'meeting_manager' });
    }
  };

  const reprocessMeeting = async () => {
    setState({ phase: 'processing', progress: 10, resultMessage: '', errorMessage: '' });
    try {
      await supabase.from('meetings').update({
        whisper_transcript_text: null,
        best_of_all_transcript: null,
        overview: null,
        status: 'processing',
        notes_generation_status: 'not_started',
        updated_at: new Date().toISOString(),
      } as any).eq('id', meetingId);

      setState(s => ({ ...s, progress: 25 }));

      const { error: fnErr } = await supabase.functions.invoke('transcribe-offline-meeting', {
        body: { meetingId, chunkIndex: 0 },
      });
      if (fnErr) throw fnErr;

      await pollForCompletion('Reprocess');
    } catch (err: any) {
      console.error('Reprocess failed:', err);
      setState(s => ({
        ...s,
        phase: 'failed',
        errorMessage: err?.message || 'Reprocess failed — please try again.',
      }));
      showToast.error(`Something went wrong — ${err?.message || 'unknown error'}`, { section: 'meeting_manager' });
    }
  };

  const deleteMeeting = async () => {
    setState({ phase: 'processing', progress: 20, resultMessage: '', errorMessage: '' });
    try {
      // Fetch audio path for storage cleanup
      const { data: meeting } = await supabase
        .from('meetings')
        .select('audio_backup_path, mixed_audio_url')
        .eq('id', meetingId)
        .single();

      setState(s => ({ ...s, progress: 40 }));

      // Remove audio from storage if present
      const audioPath = meeting?.audio_backup_path;
      if (audioPath) {
        await supabase.storage.from('meeting-audio').remove([audioPath]);
      }

      setState(s => ({ ...s, progress: 60 }));

      // Delete child records (FK CASCADE may handle some, but be explicit)
      await Promise.all([
        supabase.from('meeting_transcripts').delete().eq('meeting_id', meetingId),
        supabase.from('meeting_summaries').delete().eq('meeting_id', meetingId),
        supabase.from('meeting_action_items').delete().eq('meeting_id', meetingId),
      ]);

      setState(s => ({ ...s, progress: 80 }));

      // Delete the meeting record itself
      const { error } = await supabase.from('meetings').delete().eq('id', meetingId);
      if (error) throw error;

      setState({
        phase: 'success',
        progress: 100,
        resultMessage: 'Meeting permanently deleted',
        errorMessage: '',
      });
      showToast.success('Meeting permanently deleted', { section: 'meeting_manager' });
      setTimeout(() => onComplete?.(meetingId), 3500);
    } catch (err: any) {
      console.error('Delete failed:', err);
      setState(s => ({
        ...s,
        phase: 'failed',
        errorMessage: err?.message || 'Delete failed — please try again.',
      }));
      showToast.error(`Something went wrong — ${err?.message || 'unknown error'}`, { section: 'meeting_manager' });
    }
  };

  return { state, reuploadAudio, reprocessMeeting, deleteMeeting, reset };
}
