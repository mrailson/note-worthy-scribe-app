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

  const recoverLatestGeneration = async (policyReferenceId: string) => {
    if (!user) return null;

    for (let attempt = 0; attempt < 6; attempt++) {
      const { data } = await supabase
        .from('policy_generations')
        .select('id, generated_content, metadata')
        .eq('user_id', user.id)
        .eq('policy_reference_id', policyReferenceId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data?.generated_content) {
        return data;
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    return null;
  };

  const generatePolicy = async (params: GeneratePolicyParams): Promise<GenerationResult | null> => {
    if (!user) {
      toast.error("You must be logged in to generate policies");
      return null;
    }

    setIsGenerating(true);

    try {
      // Step 1: Generate initial policy
      let data: any;

      try {
        const invokeResult = await supabase.functions.invoke('generate-policy', {
          body: {
            policy_reference_id: params.policyReferenceId,
            practice_details: params.practiceDetails,
            custom_instructions: params.customInstructions,
          },
        });

        if (invokeResult.error) {
          console.error('Policy generation error:', invokeResult.error);
          throw new Error(invokeResult.error.message || 'Failed to generate policy');
        }

        if (!invokeResult.data?.success) {
          throw new Error(invokeResult.data?.error || 'Policy generation failed');
        }

        data = invokeResult.data;
      } catch (invokeError) {
        console.error('Primary policy response failed, attempting recovery:', invokeError);

        const recovered = await recoverLatestGeneration(params.policyReferenceId);
        if (!recovered) {
          throw invokeError instanceof Error ? invokeError : new Error('Failed to generate policy');
        }

        toast.warning('Connection dropped, but your policy was recovered successfully.', {
          duration: 6000,
        });

        return {
          content: recovered.generated_content,
          metadata: (recovered.metadata as GenerationResult['metadata']) || {
            title: 'Recovered Policy',
            version: '1.0',
            effective_date: new Date().toLocaleDateString('en-GB'),
            review_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB'),
            references: [],
          },
          generationId: recovered.id,
          enhanced: false,
          enhancementWarning: 'Policy recovered from server history after connection interruption.',
        };
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
