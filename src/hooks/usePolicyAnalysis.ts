import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface GapAnalysis {
  policy_type: string;
  gaps: string[];
  outdated_references: string[];
  missing_sections: string[];
  last_review_date: string | null;
}

interface UpdatedPolicyResult {
  content: string;
  metadata: {
    title: string;
    version: string;
    effective_date: string;
    review_date: string;
    references: string[];
    changes_summary: string[];
  };
  generationId: string;
}

export const usePolicyAnalysis = () => {
  const [isExtracting, setIsExtracting] = useState(false);
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const extractText = async (file: File): Promise<string> => {
    setIsExtracting(true);

    try {
      // Convert file to base64
      const buffer = await file.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );

      const { data, error } = await supabase.functions.invoke('extract-policy-text', {
        body: {
          file_data: base64,
          file_name: file.name,
          file_type: file.type,
        },
      });

      if (error) {
        throw new Error(error.message || 'Failed to extract text');
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Text extraction failed');
      }

      return data.extracted_text;
    } catch (error) {
      console.error('Text extraction error:', error);
      throw error;
    } finally {
      setIsExtracting(false);
    }
  };

  const analyseGaps = async (extractedText: string): Promise<GapAnalysis> => {
    setIsAnalysing(true);

    try {
      const { data, error } = await supabase.functions.invoke('analyse-policy-gaps', {
        body: {
          extracted_text: extractedText,
        },
      });

      if (error) {
        throw new Error(error.message || 'Failed to analyse policy');
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Gap analysis failed');
      }

      return {
        policy_type: data.policy_type,
        gaps: data.gaps || [],
        outdated_references: data.outdated_references || [],
        missing_sections: data.missing_sections || [],
        last_review_date: data.last_review_date,
      };
    } catch (error) {
      console.error('Gap analysis error:', error);
      throw error;
    } finally {
      setIsAnalysing(false);
    }
  };

  const generateUpdatedPolicy = async (
    originalText: string,
    gapAnalysis: GapAnalysis
  ): Promise<UpdatedPolicyResult> => {
    setIsGenerating(true);

    try {
      const { data, error } = await supabase.functions.invoke('generate-policy', {
        body: {
          generation_type: 'update',
          original_policy_text: originalText,
          gap_analysis: gapAnalysis,
        },
      });

      if (error) {
        throw new Error(error.message || 'Failed to generate updated policy');
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Policy update generation failed');
      }

      return {
        content: data.content,
        metadata: data.metadata,
        generationId: data.generation_id,
      };
    } catch (error) {
      console.error('Updated policy generation error:', error);
      throw error;
    } finally {
      setIsGenerating(false);
    }
  };

  return {
    extractText,
    analyseGaps,
    generateUpdatedPolicy,
    isExtracting,
    isAnalysing,
    isGenerating,
  };
};
