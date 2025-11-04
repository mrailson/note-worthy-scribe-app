import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Wrench, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TranscriptRepairButtonProps {
  meetingId: string;
  onRepairComplete?: () => void;
}

export const TranscriptRepairButton = ({ meetingId, onRepairComplete }: TranscriptRepairButtonProps) => {
  const [isRepairing, setIsRepairing] = useState(false);

  const handleRepair = async () => {
    try {
      setIsRepairing(true);
      console.log("🔧 Starting transcript repair for meeting:", meetingId);
      
      toast.info("Repairing transcript chunks...", {
        description: "This may take a few moments"
      });

      const { data, error } = await supabase.functions.invoke('repair-transcript-chunks', {
        body: { meetingId }
      });

      if (error) throw error;

      console.log("✅ Repair complete:", data);
      
      toast.success(`Repair complete!`, {
        description: `Processed ${data.processed} chunks${data.errors > 0 ? ` with ${data.errors} errors` : ""}`
      });

      if (onRepairComplete) {
        onRepairComplete();
      }
    } catch (error) {
      console.error("❌ Repair failed:", error);
      toast.error("Repair failed", {
        description: error instanceof Error ? error.message : "Unknown error"
      });
    } finally {
      setIsRepairing(false);
    }
  };

  return (
    <Button
      onClick={handleRepair}
      disabled={isRepairing}
      variant="outline"
      size="sm"
      className="gap-2"
    >
      {isRepairing ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Repairing...
        </>
      ) : (
        <>
          <Wrench className="h-4 w-4" />
          Repair Transcript
        </>
      )}
    </Button>
  );
};
