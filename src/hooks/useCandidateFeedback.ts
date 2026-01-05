import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface CandidateFeedback {
  id: string;
  candidate_id: string;
  role_type: 'ACP' | 'GP';
  user_id: string;
  user_name: string;
  user_role: string | null;
  agrees_with_assessment: boolean;
  comment: string | null;
  created_at: string;
  updated_at: string;
}

export interface FeedbackSummary {
  totalFeedback: number;
  agreementCount: number;
  disagreementCount: number;
  agreementPercentage: number;
  candidatesWithFeedback: number;
  candidatesWithDisagreement: string[];
}

export interface CandidateFeedbackStats {
  candidateId: string;
  totalFeedback: number;
  agreementCount: number;
  disagreementCount: number;
  agreementPercentage: number;
}

export function useCandidateFeedback(roleType: 'ACP' | 'GP', candidateIds: string[]) {
  const { user } = useAuth();
  const [feedback, setFeedback] = useState<CandidateFeedback[]>([]);
  const [userProfile, setUserProfile] = useState<{ full_name: string | null; role: string | null } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch user profile for name and role
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      const { data } = await supabase
        .from('profiles')
        .select('full_name, role')
        .eq('id', user.id)
        .single();
      setUserProfile(data);
    };
    fetchProfile();
  }, [user]);

  const fetchFeedback = useCallback(async () => {
    if (!candidateIds.length) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('nres_candidate_feedback')
        .select('*')
        .eq('role_type', roleType)
        .in('candidate_id', candidateIds)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFeedback((data as CandidateFeedback[]) || []);
    } catch (error) {
      console.error('Error fetching feedback:', error);
      toast.error('Failed to load feedback');
    } finally {
      setIsLoading(false);
    }
  }, [roleType, candidateIds]);

  useEffect(() => {
    fetchFeedback();
  }, [fetchFeedback]);

  const getFeedbackForCandidate = useCallback((candidateId: string): CandidateFeedback[] => {
    return feedback.filter(f => f.candidate_id === candidateId);
  }, [feedback]);

  const getUserFeedbackForCandidate = useCallback((candidateId: string): CandidateFeedback | null => {
    if (!user) return null;
    return feedback.find(f => f.candidate_id === candidateId && f.user_id === user.id) || null;
  }, [feedback, user]);

  const getCandidateStats = useCallback((candidateId: string): CandidateFeedbackStats => {
    const candidateFeedback = getFeedbackForCandidate(candidateId);
    const agreementCount = candidateFeedback.filter(f => f.agrees_with_assessment).length;
    const disagreementCount = candidateFeedback.filter(f => !f.agrees_with_assessment).length;
    const totalFeedback = candidateFeedback.length;
    
    return {
      candidateId,
      totalFeedback,
      agreementCount,
      disagreementCount,
      agreementPercentage: totalFeedback > 0 ? Math.round((agreementCount / totalFeedback) * 100) : 0,
    };
  }, [getFeedbackForCandidate]);

  const getSummary = useCallback((): FeedbackSummary => {
    const agreementCount = feedback.filter(f => f.agrees_with_assessment).length;
    const disagreementCount = feedback.filter(f => !f.agrees_with_assessment).length;
    const totalFeedback = feedback.length;
    
    const candidatesWithFeedbackSet = new Set(feedback.map(f => f.candidate_id));
    const candidatesWithDisagreement = [...new Set(
      feedback.filter(f => !f.agrees_with_assessment).map(f => f.candidate_id)
    )];

    return {
      totalFeedback,
      agreementCount,
      disagreementCount,
      agreementPercentage: totalFeedback > 0 ? Math.round((agreementCount / totalFeedback) * 100) : 0,
      candidatesWithFeedback: candidatesWithFeedbackSet.size,
      candidatesWithDisagreement,
    };
  }, [feedback]);

  const submitFeedback = async (
    candidateId: string,
    agreesWithAssessment: boolean,
    comment?: string
  ): Promise<boolean> => {
    if (!user) {
      toast.error('You must be logged in to submit feedback');
      return false;
    }

    setIsSubmitting(true);
    try {
      const existingFeedback = getUserFeedbackForCandidate(candidateId);

      if (existingFeedback) {
        // Update existing feedback
        const { error } = await supabase
          .from('nres_candidate_feedback')
          .update({
            agrees_with_assessment: agreesWithAssessment,
            comment: comment || null,
          })
          .eq('id', existingFeedback.id);

        if (error) throw error;
        toast.success('Feedback updated');
      } else {
        // Insert new feedback
        const { error } = await supabase
          .from('nres_candidate_feedback')
          .insert({
            candidate_id: candidateId,
            role_type: roleType,
            user_id: user.id,
            user_name: userProfile?.full_name || user.email || 'Unknown User',
            user_role: userProfile?.role || null,
            agrees_with_assessment: agreesWithAssessment,
            comment: comment || null,
          });

        if (error) throw error;
        toast.success('Feedback submitted');
      }

      await fetchFeedback();
      return true;
    } catch (error) {
      console.error('Error submitting feedback:', error);
      toast.error('Failed to submit feedback');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteFeedback = async (candidateId: string): Promise<boolean> => {
    if (!user) return false;

    const existingFeedback = getUserFeedbackForCandidate(candidateId);
    if (!existingFeedback) return false;

    try {
      const { error } = await supabase
        .from('nres_candidate_feedback')
        .delete()
        .eq('id', existingFeedback.id);

      if (error) throw error;
      toast.success('Feedback removed');
      await fetchFeedback();
      return true;
    } catch (error) {
      console.error('Error deleting feedback:', error);
      toast.error('Failed to remove feedback');
      return false;
    }
  };

  return {
    feedback,
    isLoading,
    isSubmitting,
    getFeedbackForCandidate,
    getUserFeedbackForCandidate,
    getCandidateStats,
    getSummary,
    submitFeedback,
    deleteFeedback,
    refetch: fetchFeedback,
  };
}
