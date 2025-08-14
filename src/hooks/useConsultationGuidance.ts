import { useState, useCallback } from "react";
import { ConsultationGuidance } from "@/types/gpscribe";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useConsultationGuidance = () => {
  const [guidance, setGuidance] = useState<ConsultationGuidance | null>(null);
  const [isGuidanceLoading, setIsGuidanceLoading] = useState(false);
  const [autoGuidance, setAutoGuidance] = useState(true);

  const generateGuidance = useCallback(async (transcript: string, consultationType?: string) => {
    if (!transcript.trim()) {
      toast.error("No transcript available for guidance generation");
      return;
    }

    try {
      setIsGuidanceLoading(true);
      
      const { data, error } = await supabase.functions.invoke('gp-consultation-guidance', {
        body: { 
          transcript: transcript.trim(),
          consultationType 
        }
      });

      if (error) throw error;

      setGuidance(data);
      return data;
    } catch (error) {
      console.error('Guidance generation error:', error);
      toast.error('Failed to generate consultation guidance');
      return null;
    } finally {
      setIsGuidanceLoading(false);
    }
  }, []);

  const clearGuidance = useCallback(() => {
    setGuidance(null);
  }, []);

  return {
    // States
    guidance,
    isGuidanceLoading,
    autoGuidance,

    // Actions
    setAutoGuidance,
    generateGuidance,
    clearGuidance
  };
};