import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// Generate a proper UUID for imported transcripts
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

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
          consultationId: generateUUID(),
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
        console.log("🔄 Calling onNotesGenerated with data:", {
          hasShorthand: !!data.shorthand,
          hasStandard: !!data.standard,
          hasSummaryLine: !!data.summaryLine,
          hasPatientCopy: !!data.patientCopy
        });
        onNotesGenerated(data);
      } else {
        console.warn("⚠️ No data received or no callback provided");
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