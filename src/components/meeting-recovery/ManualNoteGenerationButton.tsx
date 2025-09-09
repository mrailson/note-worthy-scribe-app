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

      // Update meeting status to indicate manual generation
      await supabase
        .from('meetings')
        .update({ notes_generation_status: 'queued' })
        .eq('id', meetingId);

      // Call the auto-generate function
      const { error } = await supabase.functions.invoke('auto-generate-meeting-notes', {
        body: { 
          meetingId,
          forceRegenerate: hasExistingNotes 
        }
      });

      if (error) {
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