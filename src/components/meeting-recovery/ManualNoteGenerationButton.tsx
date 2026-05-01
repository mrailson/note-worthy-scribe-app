import { Button } from "@/components/ui/button";
import { FileText, Loader2, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { modelOverrideField } from "@/utils/resolveMeetingModel";

interface ManualNoteGenerationButtonProps {
  meetingId: string;
  hasExistingNotes?: boolean;
  className?: string;
  /**
   * When true, the meeting was previously rejected by the non-meeting guard
   * (transcript too short, duration too short, or LLM classified the
   * recording as non-meeting). Renders an "Override and generate anyway"
   * button that re-invokes the function with forceGenerate: true.
   */
  isInsufficientContent?: boolean;
}

export const ManualNoteGenerationButton = ({
  meetingId,
  hasExistingNotes = false,
  className,
  isInsufficientContent = false,
}: ManualNoteGenerationButtonProps) => {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleManualGeneration = async (forceGenerate = false) => {
    try {
      setIsGenerating(true);
      console.log('NOTE GENERATION: Calling generate-meeting-notes-claude from ManualNoteGenerationButton', { forceGenerate });

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

      const skipQc = localStorage.getItem('meeting-qc-enabled') !== 'true';
      const { data, error } = await supabase.functions.invoke('generate-meeting-notes-claude', {
        body: {
          transcript: transcriptText,
          meetingTitle: meeting.title || 'Meeting Notes',
          meetingDate,
          meetingTime,
          detailLevel: 'standard',
          ...modelOverrideField(),
          meetingId,
          skipQc,
          forceGenerate,
        }
      });

      if (error) {
        console.error('❌ Function invocation error:', error);
        throw error;
      }

      // Surface the guard outcome to the user instead of pretending it succeeded
      if (data && (data as any).status === 'insufficient_content') {
        const reason = (data as any).reason || 'insufficient_content';
        const dur = (data as any).duration_seconds ?? '—';
        const words = (data as any).transcript_word_count ?? '—';
        toast.warning(
          `Recording rejected as a non-meeting (${reason}). Duration ${dur}s, ${words} words. Use "Override and generate anyway" if this really is a meeting.`,
          { duration: 10000 }
        );
        return;
      }

      toast.success('Meeting notes generated and emailed to you!', {
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

  if (isInsufficientContent) {
    return (
      <div className={`flex flex-wrap gap-2 ${className ?? ''}`}>
        <Button
          onClick={() => handleManualGeneration(true)}
          disabled={isGenerating}
          variant="outline"
          size="sm"
        >
          {isGenerating ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <AlertTriangle className="h-4 w-4 mr-2 text-amber-500" />
          )}
          Override and generate anyway
        </Button>
      </div>
    );
  }

  return (
    <Button
      onClick={() => handleManualGeneration(false)}
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
