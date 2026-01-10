import React, { useState, useCallback } from 'react';
import { 
  ReferralSuggestion, 
  ReferralDraft, 
  ExtractedFacts, 
  ReferralAnalysisResponse,
  ReferralDraftResponse,
  ToneRewriteResponse
} from '@/types/referral';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface UseReferralWorkspaceProps {
  transcript?: string;
  notes?: any;
  consultationType?: string;
  userId?: string;
  patientContext?: {
    name?: string;
    dob?: string;
    nhsNumber?: string;
    address?: string;
  };
}

export function useReferralWorkspace({
  transcript,
  notes,
  consultationType,
  userId,
  patientContext
}: UseReferralWorkspaceProps) {
  const [suggestions, setSuggestions] = useState<ReferralSuggestion[]>([]);
  const [extractedFacts, setExtractedFacts] = useState<ExtractedFacts | null>(null);
  const [currentDraft, setCurrentDraft] = useState<ReferralDraft | null>(null);
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);
  const [isRewriting, setIsRewriting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyseSuggestions = useCallback(async () => {
    if (!transcript && !notes) {
      toast.error('No consultation data to analyse');
      return;
    }

    setIsAnalysing(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('analyse-referral-suggestions', {
        body: {
          transcript,
          notes,
          consultationType
        }
      });

      if (fnError) throw fnError;

      const response = data as ReferralAnalysisResponse;
      setSuggestions(response.suggestions || []);
      setExtractedFacts(response.extractedFacts || null);
      
      if (response.suggestions?.length === 0) {
        toast.info('No referral suggestions identified from this consultation');
      } else {
        toast.success(`Found ${response.suggestions.length} referral suggestion${response.suggestions.length > 1 ? 's' : ''}`);
      }
    } catch (err) {
      console.error('Error analysing referrals:', err);
      setError(err instanceof Error ? err.message : 'Failed to analyse consultation');
      toast.error('Failed to analyse consultation for referrals');
    } finally {
      setIsAnalysing(false);
    }
  }, [transcript, notes, consultationType]);

  const generateDraft = useCallback(async (suggestion: ReferralSuggestion) => {
    setIsGeneratingDraft(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('generate-referral-draft', {
        body: {
          suggestion,
          extractedFacts,
          transcript,
          notes,
          userId,
          patientContext
        }
      });

      if (fnError) throw fnError;

      const response = data as ReferralDraftResponse;
      setCurrentDraft(response.draft);
      toast.success('Referral draft generated');
    } catch (err) {
      console.error('Error generating draft:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate draft');
      toast.error('Failed to generate referral draft');
    } finally {
      setIsGeneratingDraft(false);
    }
  }, [extractedFacts, transcript, notes, userId, patientContext]);

  const rewriteTone = useCallback(async (
    toneOption: 'friendly' | 'concise' | 'add-availability' | 'formal'
  ) => {
    if (!currentDraft) {
      toast.error('No draft to rewrite');
      return;
    }

    setIsRewriting(true);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('rewrite-referral-tone', {
        body: {
          letterContent: currentDraft.letterContent,
          toneOption
        }
      });

      if (fnError) throw fnError;

      const response = data as ToneRewriteResponse;
      
      if (!response.clinicalFactsPreserved) {
        toast.warning('Tone rewrite may have affected clinical content - please review carefully');
      }

      setCurrentDraft(prev => prev ? {
        ...prev,
        letterContent: response.rewrittenContent,
        toneVersion: toneOption === 'add-availability' ? prev.toneVersion : toneOption as any
      } : null);

      toast.success(`Applied ${toneOption} tone`);
    } catch (err) {
      console.error('Error rewriting tone:', err);
      toast.error('Failed to rewrite tone');
    } finally {
      setIsRewriting(false);
    }
  }, [currentDraft]);

  const updateDraftContent = useCallback((content: string) => {
    setCurrentDraft(prev => prev ? { ...prev, letterContent: content } : null);
  }, []);

  const confirmDraft = useCallback(() => {
    setCurrentDraft(prev => prev ? {
      ...prev,
      clinicianConfirmed: true,
      confirmedAt: new Date().toISOString()
    } : null);
    toast.success('Referral confirmed');
  }, []);

  const unconfirmDraft = useCallback(() => {
    setCurrentDraft(prev => prev ? {
      ...prev,
      clinicianConfirmed: false,
      confirmedAt: undefined
    } : null);
  }, []);

  const setSafetyNetting = useCallback((given: boolean) => {
    setCurrentDraft(prev => prev ? { ...prev, safetyNettingGiven: given } : null);
  }, []);

  const clearDraft = useCallback(() => {
    setCurrentDraft(null);
  }, []);

  const copyToClipboard = useCallback(async () => {
    if (!currentDraft) return false;
    
    try {
      await navigator.clipboard.writeText(currentDraft.letterContent);
      toast.success('Copied to clipboard');
      return true;
    } catch (err) {
      toast.error('Failed to copy to clipboard');
      return false;
    }
  }, [currentDraft]);

  return {
    // State
    suggestions,
    extractedFacts,
    currentDraft,
    isAnalysing,
    isGeneratingDraft,
    isRewriting,
    error,
    
    // Actions
    analyseSuggestions,
    generateDraft,
    rewriteTone,
    updateDraftContent,
    confirmDraft,
    unconfirmDraft,
    setSafetyNetting,
    clearDraft,
    copyToClipboard
  };
}
