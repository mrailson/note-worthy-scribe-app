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

  // Load corrections once
  useEffect(() => {
    if (!user?.id) return;
    medicalTermCorrector.loadCorrections(user.id).then(() => {
      setCorrectionsLoaded(true);
    });
  }, [user?.id]);

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

    setUpdatingMeetings(prev => ({ ...prev, [meetingId]: true }));
    let totalReplacements = 0;

    try {
      // 1. Update title
      const correctedTitle = medicalTermCorrector.applyCorrections(currentTitle);
      if (correctedTitle !== currentTitle) {
        await supabase.from('meetings').update({ title: correctedTitle }).eq('id', meetingId);
        totalReplacements++;
      }

      // 2. Update overview
      if (currentOverview) {
        const correctedOverview = medicalTermCorrector.applyCorrections(currentOverview);
        if (correctedOverview !== currentOverview) {
          await supabase.from('meeting_overviews').update({ overview: correctedOverview }).eq('meeting_id', meetingId);
          totalReplacements++;
        }
      }

      // 3. Update summaries (all note styles)
      const { data: summaries } = await supabase
        .from('meeting_summaries')
        .select('id, summary, key_points, action_items, decisions')
        .eq('meeting_id', meetingId);

      if (summaries) {
        for (const s of summaries) {
          const updates: Record<string, any> = {};
          
          if (s.summary) {
            const corrected = medicalTermCorrector.applyCorrections(s.summary);
            if (corrected !== s.summary) updates.summary = corrected;
          }

          // Apply to JSON array fields
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
            await supabase.from('meeting_summaries').update(updates).eq('id', s.id);
            totalReplacements += Object.keys(updates).length;
          }
        }
      }

      // Update local state
      onLocalUpdate?.({
        title: correctedTitle,
        overview: currentOverview ? medicalTermCorrector.applyCorrections(currentOverview) : undefined,
      });

      if (totalReplacements > 0) {
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
    hasCorrections: correctionsLoaded && medicalTermCorrector.hasCorrections(),
  };
}
