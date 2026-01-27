import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface PracticeDetails {
  practice_name: string;
  address: string;
  postcode: string;
  ods_code: string;
  practice_manager_name: string;
  lead_gp_name: string;
  caldicott_guardian: string;
  dpo_name: string;
  safeguarding_lead_adults: string;
  safeguarding_lead_children: string;
  infection_control_lead: string;
  complaints_lead: string;
  health_safety_lead: string;
  fire_safety_officer: string;
  list_size: number | null;
  services_offered: Record<string, boolean>;
}

interface GeneratePolicyParams {
  policyReferenceId: string;
  practiceDetails: PracticeDetails;
  customInstructions?: string;
}

interface GenerationResult {
  content: string;
  metadata: {
    title: string;
    version: string;
    effective_date: string;
    review_date: string;
    references: string[];
  };
  generationId: string;
}

export const usePolicyGeneration = () => {
  const { user } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);

  const generatePolicy = async (params: GeneratePolicyParams): Promise<GenerationResult | null> => {
    if (!user) {
      toast.error("You must be logged in to generate policies");
      return null;
    }

    setIsGenerating(true);

    try {
      const { data, error } = await supabase.functions.invoke('generate-policy', {
        body: {
          policy_reference_id: params.policyReferenceId,
          practice_details: params.practiceDetails,
          custom_instructions: params.customInstructions,
        },
      });

      if (error) {
        console.error('Policy generation error:', error);
        throw new Error(error.message || 'Failed to generate policy');
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Policy generation failed');
      }

      return {
        content: data.content,
        metadata: data.metadata,
        generationId: data.generation_id,
      };
    } catch (error) {
      console.error('Policy generation error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate policy');
      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  return {
    generatePolicy,
    isGenerating,
  };
};
