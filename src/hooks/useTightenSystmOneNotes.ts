import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface TightenInput {
  history: string;
  examination: string;
  assessment: string;
  plan: string;
}

interface QualityGate {
  partnerSafe: boolean;
  cqcReady: boolean;
  gpAuthored: boolean;
}

interface TightenResult {
  history: string;
  examination: string;
  assessment: string;
  plan: string;
  qualityGate: QualityGate;
}

export function useTightenSystmOneNotes() {
  const [isTightening, setIsTightening] = useState(false);
  const [qualityGate, setQualityGate] = useState<QualityGate | null>(null);

  const tightenNotes = useCallback(async (input: TightenInput): Promise<TightenResult | null> => {
    setIsTightening(true);
    setQualityGate(null);

    try {
      console.log('Calling tighten-systmone-notes edge function...');

      const { data, error } = await supabase.functions.invoke('tighten-systmone-notes', {
        body: {
          history: input.history,
          examination: input.examination,
          assessment: input.assessment,
          plan: input.plan
        }
      });

      if (error) {
        console.error('Edge function error:', error);
        toast.error('Failed to optimise notes: ' + error.message);
        return null;
      }

      if (data.error) {
        console.error('Tightening error:', data.error);
        toast.error('Optimisation issue: ' + data.error);
        // Still return data if it has content (fallback case)
        if (data.history || data.examination || data.assessment || data.plan) {
          return data as TightenResult;
        }
        return null;
      }

      const result = data as TightenResult;
      setQualityGate(result.qualityGate);

      // Check quality gate status
      const allPassed = result.qualityGate.partnerSafe && 
                        result.qualityGate.cqcReady && 
                        result.qualityGate.gpAuthored;

      if (allPassed) {
        toast.success('Notes optimised for SystmOne', {
          description: '✓ Partner Safe  ✓ CQC Ready  ✓ GP-Authored'
        });
      } else {
        toast.warning('Notes optimised with quality concerns', {
          description: 'Review quality gate status before copying'
        });
      }

      return result;

    } catch (err) {
      console.error('Unexpected error:', err);
      toast.error('Failed to optimise notes');
      return null;
    } finally {
      setIsTightening(false);
    }
  }, []);

  const resetQualityGate = useCallback(() => {
    setQualityGate(null);
  }, []);

  return {
    tightenNotes,
    isTightening,
    qualityGate,
    resetQualityGate
  };
}
