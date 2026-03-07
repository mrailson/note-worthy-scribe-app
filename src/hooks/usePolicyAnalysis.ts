import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface GapAnalysis {
  policy_type: string;
  policy_source?: 'notewell' | 'uploaded';
  gaps: string[];
  outdated_references: string[];
  missing_sections: string[];
  last_review_date: string | null;
  compliance_score: number | null;
  score_summary: string | null;
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

  const analyseGaps = async (extractedText: string, policySource: 'notewell' | 'uploaded' = 'uploaded'): Promise<GapAnalysis> => {
    setIsAnalysing(true);

    try {
      const { data, error } = await supabase.functions.invoke('analyse-policy-gaps', {
        body: {
          extracted_text: extractedText,
          policy_source: policySource,
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
        policy_source: data.policy_source || policySource,
        gaps: data.gaps || [],
        outdated_references: data.outdated_references || [],
        missing_sections: data.missing_sections || [],
        last_review_date: data.last_review_date,
        compliance_score: typeof data.compliance_score === 'number' ? data.compliance_score : null,
        score_summary: data.score_summary || null,
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
      // The generate-policy function returns an SSE stream, not JSON.
      // We must consume it manually instead of using supabase.functions.invoke.
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/generate-policy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': supabaseKey,
        },
        body: JSON.stringify({
          generation_type: 'update',
          original_policy_text: originalText,
          gap_analysis: gapAnalysis,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to generate updated policy: ${errorText}`);
      }

      // Read the SSE stream and extract the final result
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let result: UpdatedPolicyResult | null = null;
      let errorMsg: string | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (!data || data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'result' && parsed.data) {
              const resultData = typeof parsed.data === 'string' ? JSON.parse(parsed.data) : parsed.data;
              if (resultData.success) {
                result = {
                  content: resultData.content,
                  metadata: resultData.metadata,
                  generationId: resultData.generation_id,
                };
              } else {
                errorMsg = resultData.error || 'Policy update generation failed';
              }
            } else if (parsed.type === 'error') {
              errorMsg = parsed.error || 'Policy update generation failed';
            }
          } catch {
            // Ignore parse errors for ping/progress events
          }
        }
      }

      if (errorMsg) {
        throw new Error(errorMsg);
      }

      if (!result) {
        throw new Error('No result received from policy generation');
      }

      return result;
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
