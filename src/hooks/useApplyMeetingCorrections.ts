import { useState, useEffect, useCallback, useMemo } from 'react';
import { medicalTermCorrector } from '@/utils/MedicalTermCorrector';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

interface AppliedCorrection {
  from: string;
  to: string;
}

export function useApplyMeetingCorrections() {
  const { user } = useAuth();
  const [correctionsLoaded, setCorrectionsLoaded] = useState(false);
  const [updatingMeetings, setUpdatingMeetings] = useState<Record<string, boolean>>({});
  const [reloadToken, setReloadToken] = useState(0);

  // Load corrections once (and reload when reloadToken changes)
  useEffect(() => {
    if (!user?.id) return;
    setCorrectionsLoaded(false);
    medicalTermCorrector.loadCorrections(user.id).then(() => {
      setCorrectionsLoaded(true);
    });
  }, [user?.id, reloadToken]);

  const reloadCorrections = useCallback(() => {
    setReloadToken(t => t + 1);
  }, []);

  const applyText = useCallback((text: string | null | undefined): string => {
    if (!text || !correctionsLoaded) return text || '';
    return medicalTermCorrector.applyCorrections(text);
  }, [correctionsLoaded]);

  const getCorrectionsForText = useCallback((...texts: (string | null | undefined)[]): AppliedCorrection[] => {
    if (!correctionsLoaded) return [];
    const allCorrections: AppliedCorrection[] = [];
    const seen = new Set<string>();

    for (const text of texts) {
      if (!text) continue;
      const corrections = medicalTermCorrector.getAppliedCorrections(text);
      for (const c of corrections) {
        const key = `${c.from}→${c.to}`;
        if (!seen.has(key)) {
          seen.add(key);
          allCorrections.push(c);
        }
      }
    }
    return allCorrections;
  }, [correctionsLoaded]);

  const updateMeeting = useCallback(async (
    meetingId: string,
    currentTitle: string,
    currentOverview: string | null,
    onLocalUpdate?: (updates: { title?: string; overview?: string }) => void
  ) => {
    if (!correctionsLoaded) return;

    const correctedTitle = medicalTermCorrector.applyCorrections(currentTitle);
    const correctedOverview = currentOverview
      ? medicalTermCorrector.applyCorrections(currentOverview)
      : null;

    setUpdatingMeetings(prev => ({ ...prev, [meetingId]: true }));
    let totalReplacements = 0;

    try {
      if (correctedTitle !== currentTitle) {
        const { data: updatedMeeting, error: titleError } = await supabase
          .from('meetings')
          .update({ title: correctedTitle })
          .eq('id', meetingId)
          .select('id')
          .maybeSingle();

        if (titleError) throw titleError;
        if (!updatedMeeting) throw new Error('Meeting title update was not persisted');
        totalReplacements++;
      }

      if (currentOverview && correctedOverview !== currentOverview) {
        const { data: updatedOverview, error: overviewError } = await supabase
          .from('meeting_overviews')
          .update({ overview: correctedOverview })
          .eq('meeting_id', meetingId)
          .select('id')
          .maybeSingle();

        if (overviewError) throw overviewError;
        if (!updatedOverview) throw new Error('Meeting overview update was not persisted');
        totalReplacements++;
      }

      const { data: summaries, error: summariesError } = await supabase
        .from('meeting_summaries')
        .select('id, summary, key_points, action_items, decisions')
        .eq('meeting_id', meetingId);

      if (summariesError) throw summariesError;

      if (summaries) {
        for (const s of summaries) {
          const updates: Record<string, any> = {};

          if (s.summary) {
            const corrected = medicalTermCorrector.applyCorrections(s.summary);
            if (corrected !== s.summary) updates.summary = corrected;
          }

          for (const field of ['key_points', 'action_items', 'decisions'] as const) {
            const arr = s[field];
            if (Array.isArray(arr)) {
              const corrected = arr.map((item: string) =>
                typeof item === 'string' ? medicalTermCorrector.applyCorrections(item) : item
              );
              if (JSON.stringify(corrected) !== JSON.stringify(arr)) {
                updates[field] = corrected;
              }
            }
          }

          if (Object.keys(updates).length > 0) {
            const { data: updatedSummary, error: summaryUpdateError } = await supabase
              .from('meeting_summaries')
              .update(updates as any)
              .eq('id', s.id)
              .select('id')
              .maybeSingle();

            if (summaryUpdateError) throw summaryUpdateError;
            if (!updatedSummary) throw new Error('Meeting summary update was not persisted');
            totalReplacements += Object.keys(updates).length;
          }
        }
      }

      if (totalReplacements > 0) {
        onLocalUpdate?.({
          ...(correctedTitle !== currentTitle ? { title: correctedTitle } : {}),
          ...(correctedOverview && correctedOverview !== currentOverview ? { overview: correctedOverview } : {}),
        });
        toast.success(`Meeting updated — ${totalReplacements} field${totalReplacements !== 1 ? 's' : ''} corrected`);
      } else {
        toast.info('No corrections needed for this meeting');
      }
    } catch (error) {
      console.error('Error applying corrections to meeting:', error);
      toast.error('Failed to update meeting');
    } finally {
      setUpdatingMeetings(prev => ({ ...prev, [meetingId]: false }));
    }
  }, [correctionsLoaded]);

  return {
    correctionsLoaded,
    applyText,
    getCorrectionsForText,
    updateMeeting,
    updatingMeetings,
    reloadCorrections,
    hasCorrections: correctionsLoaded && medicalTermCorrector.hasCorrections(),
  };
}
