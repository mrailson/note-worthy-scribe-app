import { Button } from "@/components/ui/button";
import { FileText, Loader2 } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { sendMeetingNotesEmail } from "@/utils/sendMeetingNotesEmail";

interface ManualNoteGenerationButtonProps {
  meetingId: string;
  hasExistingNotes?: boolean;
  className?: string;
}

export const ManualNoteGenerationButton = ({ 
  meetingId, 
  hasExistingNotes = false,
  className 
}: ManualNoteGenerationButtonProps) => {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleManualGeneration = async () => {
    try {
      setIsGenerating(true);
      console.log('NOTE GENERATION: Calling generate-meeting-notes-claude from ManualNoteGenerationButton');

      // Fetch the meeting data including transcript
      const { data: meeting, error: meetingError } = await supabase
        .from('meetings')
        .select('id, user_id, word_count, title, start_time, end_time, duration_minutes, live_transcript_text, whisper_transcript_text, best_of_all_transcript')
        .eq('id', meetingId)
        .maybeSingle();

      if (meetingError) {
        throw new Error(`Database error: ${meetingError.message}`);
      }

      if (!meeting) {
        throw new Error('Meeting not found or you do not have access to it');
      }

      // Get the best available transcript
      let transcriptText = meeting.best_of_all_transcript || meeting.whisper_transcript_text || meeting.live_transcript_text || '';

      // If no transcript in meeting row, try chunks table
      if (!transcriptText || transcriptText.trim().length === 0) {
        const { data: chunks } = await supabase
          .from('meeting_transcription_chunks')
          .select('cleaned_text')
          .eq('meeting_id', meetingId)
          .order('chunk_number', { ascending: true });

        if (chunks && chunks.length > 0) {
          transcriptText = chunks.map(c => c.cleaned_text || '').join('\n\n');
        }
      }

      if (!transcriptText || transcriptText.trim().length === 0) {
        throw new Error('This meeting has no transcript content to generate notes from');
      }

      const meetingDate = meeting.start_time ? new Date(meeting.start_time).toLocaleDateString('en-GB') : '';
      const meetingTime = meeting.start_time ? new Date(meeting.start_time).toLocaleTimeString('en-GB', { 
        hour: '2-digit', 
        minute: '2-digit' 
      }) : '';

      const modelOverride = localStorage.getItem('meeting-regenerate-llm') === 'gemini-3-flash'
        ? 'claude-sonnet-4-6'
        : (localStorage.getItem('meeting-regenerate-llm') || 'claude-sonnet-4-6');

      const skipQc = localStorage.getItem('meeting-qc-enabled') !== 'true';
      const { data, error } = await supabase.functions.invoke('generate-meeting-notes-claude', {
        body: { 
          transcript: transcriptText,
          meetingTitle: meeting.title || 'Meeting Notes',
          meetingDate,
          meetingTime,
          detailLevel: 'standard',
          modelOverride,
          meetingId,
          skipQc,
        }
      });

      if (error) {
        console.error('❌ Function invocation error:', error);
        throw error;
      }

      toast.success('Meeting notes generated successfully!', {
        duration: 5000
      });

    } catch (error: any) {
      console.error('❌ Error generating notes:', error);
      toast.error(`Failed to generate notes: ${error.message || 'Unknown error'}`, {
        duration: 8000
      });
      
      // Reset status on error
      await supabase
        .from('meetings')
        .update({ notes_generation_status: 'failed' })
        .eq('id', meetingId);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Button
      onClick={handleManualGeneration}
      disabled={isGenerating}
      variant="outline"
      size="sm"
      className={className}
    >
      {isGenerating ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <FileText className="h-4 w-4 mr-2" />
      )}
      {hasExistingNotes ? 'Regenerate Notes' : 'Generate Notes'}
    </Button>
  );
};