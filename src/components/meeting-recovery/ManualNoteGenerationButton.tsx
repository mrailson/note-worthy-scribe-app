import { Button } from "@/components/ui/button";
import { FileText, Loader2 } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
      console.log('🔄 Manually triggering note generation for:', meetingId);

      // First verify the meeting exists and user has access
      const { data: meeting, error: meetingError } = await supabase
        .from('meetings')
        .select('id, user_id, word_count')
        .eq('id', meetingId)
        .maybeSingle();

      if (meetingError) {
        throw new Error(`Database error: ${meetingError.message}`);
      }

      if (!meeting) {
        throw new Error('Meeting not found or you do not have access to it');
      }

      if (!meeting.word_count || meeting.word_count === 0) {
        throw new Error('This meeting has no transcript content to generate notes from');
      }

      // Update meeting status to indicate manual generation
      const { error: updateError } = await supabase
        .from('meetings')
        .update({ notes_generation_status: 'queued' })
        .eq('id', meetingId);

      if (updateError) {
        throw new Error(`Failed to update meeting status: ${updateError.message}`);
      }

      // Call the auto-generate function
      console.log('📤 Invoking auto-generate-meeting-notes for:', meetingId);
      const { data, error } = await supabase.functions.invoke('auto-generate-meeting-notes', {
        body: { 
          meetingId,
          forceRegenerate: hasExistingNotes 
        }
      });

      console.log('📥 Function response:', { data, error });

      if (error) {
        console.error('❌ Function invocation error:', {
          message: error.message,
          name: error.name,
          stack: error.stack,
          ...error
        });
        throw error;
      }

      toast.success('Note generation started! This may take a few moments.', {
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