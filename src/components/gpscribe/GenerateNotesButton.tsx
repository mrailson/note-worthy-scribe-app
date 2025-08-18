import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface GenerateNotesButtonProps {
  transcript: string;
  onNotesGenerated?: (notes: any) => void;
  disabled?: boolean;
}

export const GenerateNotesButton = ({ 
  transcript, 
  onNotesGenerated, 
  disabled = false 
}: GenerateNotesButtonProps) => {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateNotes = async () => {
    if (!transcript.trim()) {
      toast.error("No transcript available to generate notes from");
      return;
    }

    setIsGenerating(true);
    try {
      console.log("Generating consultation notes from transcript:", transcript.substring(0, 100) + "...");
      
      const { data, error } = await supabase.functions.invoke('generate-consultation-notes', {
        body: {
          consultationId: `IMPORTED-${Date.now()}`,
          transcript: [
            {
              t: "00:00",
              speaker: "Mixed",
              text: transcript
            }
          ],
          consultationType: "face_to_face",
          outputMode: "shorthand"
        }
      });

      if (error) {
        console.error('Notes generation error:', error);
        throw error;
      }

      console.log("Generated notes:", data);
      
      if (data && onNotesGenerated) {
        onNotesGenerated(data);
      }
      
      toast.success("Consultation notes generated successfully!");
    } catch (error) {
      console.error('Failed to generate notes:', error);
      toast.error('Failed to generate consultation notes. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Button
      onClick={handleGenerateNotes}
      disabled={disabled || !transcript.trim() || isGenerating}
      className="w-full"
      size="lg"
    >
      {isGenerating ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Generating Notes...
        </>
      ) : (
        <>
          <FileText className="h-4 w-4 mr-2" />
          Generate Consultation Notes
        </>
      )}
    </Button>
  );
};