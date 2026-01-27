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
  skipEnhancement?: boolean;
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
  enhanced: boolean;
  enhancementWarning?: string;
}

export const usePolicyGeneration = () => {
  const { user } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);

  const enhancePolicy = async (
    generatedPolicy: string,
    policyType: string,
    practiceName: string,
    odsCode: string
  ): Promise<{ enhanced: boolean; content: string; warning?: string }> => {
    try {
      console.log('Enhancing policy with Claude API...', { policyType, practiceName });
      
      const { data, error } = await supabase.functions.invoke('enhance-policy', {
        body: {
          generatedPolicy,
          policyType,
          practiceName,
          odsCode,
        },
      });

      if (error) {
        console.error('Policy enhancement error:', error);
        return { 
          enhanced: false, 
          content: generatedPolicy, 
          warning: 'Enhancement service unavailable. Original policy returned.' 
        };
      }

      if (data?.enhanced) {
        console.log('Policy enhanced successfully');
        return { enhanced: true, content: data.enhancedPolicy };
      }

      return { 
        enhanced: false, 
        content: data?.enhancedPolicy || generatedPolicy,
        warning: data?.warning || 'Enhancement could not be completed.'
      };
    } catch (error) {
      console.error('Policy enhancement error:', error);
      return { 
        enhanced: false, 
        content: generatedPolicy, 
        warning: 'Enhancement service temporarily unavailable.' 
      };
    }
  };

  const generatePolicy = async (params: GeneratePolicyParams): Promise<GenerationResult | null> => {
    if (!user) {
      toast.error("You must be logged in to generate policies");
      return null;
    }

    setIsGenerating(true);

    try {
      // Step 1: Generate initial policy
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

      let finalContent = data.content;
      let enhanced = false;
      let enhancementWarning: string | undefined;

      // Step 2: Enhance policy with Claude API (unless skipped)
      if (!params.skipEnhancement) {
        setIsGenerating(false);
        setIsEnhancing(true);
        
        toast.info('Enhancing policy against NHS regulatory requirements...', {
          duration: 5000,
        });

        const enhancementResult = await enhancePolicy(
          data.content,
          data.metadata?.title || 'Policy',
          params.practiceDetails.practice_name,
          params.practiceDetails.ods_code
        );

        finalContent = enhancementResult.content;
        enhanced = enhancementResult.enhanced;
        enhancementWarning = enhancementResult.warning;

        if (enhanced) {
          toast.success('Policy enhanced with CQC compliance checks');
        } else if (enhancementWarning) {
          toast.warning(enhancementWarning, { duration: 6000 });
        }
      }

      return {
        content: finalContent,
        metadata: data.metadata,
        generationId: data.generation_id,
        enhanced,
        enhancementWarning,
      };
    } catch (error) {
      console.error('Policy generation error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate policy');
      return null;
    } finally {
      setIsGenerating(false);
      setIsEnhancing(false);
    }
  };

  return {
    generatePolicy,
    isGenerating,
    isEnhancing,
  };
};
