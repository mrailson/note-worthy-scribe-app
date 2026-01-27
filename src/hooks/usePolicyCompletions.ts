import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface PolicyCompletion {
  id: string;
  user_id: string;
  practice_id: string | null;
  policy_reference_id: string;
  policy_title: string;
  policy_content: string;
  metadata: {
    title: string;
    version: string;
    effective_date: string;
    review_date: string;
    references: string[];
  };
  effective_date: string;
  review_date: string;
  version: string;
  status: 'completed' | 'draft' | 'archived';
  created_at: string;
  updated_at: string;
}

interface SavePolicyParams {
  policyReferenceId: string;
  policyTitle: string;
  policyContent: string;
  metadata: {
    title: string;
    version: string;
    effective_date: string;
    review_date: string;
    references: string[];
  };
  practiceId?: string | null;
}

export const usePolicyCompletions = (practiceId?: string | null) => {
  const { user } = useAuth();
  const [completions, setCompletions] = useState<PolicyCompletion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [completedPolicyIds, setCompletedPolicyIds] = useState<Set<string>>(new Set());

  // Fetch all completions for the user/practice
  const fetchCompletions = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      let query = supabase
        .from('policy_completions')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .order('created_at', { ascending: false });

      if (practiceId) {
        query = query.eq('practice_id', practiceId);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Type assertion since we know the structure
      const typedData = (data || []) as unknown as PolicyCompletion[];
      setCompletions(typedData);
      
      // Build set of completed policy reference IDs
      const completedIds = new Set(typedData.map(c => c.policy_reference_id));
      setCompletedPolicyIds(completedIds);
    } catch (error) {
      console.error('Error fetching policy completions:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user, practiceId]);

  // Save a completed policy
  const saveCompletion = useCallback(async (params: SavePolicyParams): Promise<PolicyCompletion | null> => {
    if (!user) {
      toast.error('You must be logged in to save policies');
      return null;
    }

    try {
      // Check if there's an existing completion for this policy
      const { data: existing } = await supabase
        .from('policy_completions')
        .select('id')
        .eq('user_id', user.id)
        .eq('policy_reference_id', params.policyReferenceId)
        .eq('status', 'completed')
        .maybeSingle();

      let result;

      if (existing) {
        // Update existing
        const { data, error } = await supabase
          .from('policy_completions')
          .update({
            policy_title: params.policyTitle,
            policy_content: params.policyContent,
            metadata: params.metadata,
            effective_date: params.metadata.effective_date,
            review_date: params.metadata.review_date,
            version: params.metadata.version,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw error;
        result = data;
        toast.success('Policy updated successfully');
      } else {
        // Insert new
        const { data, error } = await supabase
          .from('policy_completions')
          .insert({
            user_id: user.id,
            practice_id: params.practiceId || null,
            policy_reference_id: params.policyReferenceId,
            policy_title: params.policyTitle,
            policy_content: params.policyContent,
            metadata: params.metadata,
            effective_date: params.metadata.effective_date,
            review_date: params.metadata.review_date,
            version: params.metadata.version,
            status: 'completed',
          })
          .select()
          .single();

        if (error) throw error;
        result = data;
        toast.success('Policy marked as completed');
      }

      // Refresh completions
      await fetchCompletions();
      
      return result as unknown as PolicyCompletion;
    } catch (error) {
      console.error('Error saving policy completion:', error);
      toast.error('Failed to save policy');
      return null;
    }
  }, [user, fetchCompletions]);

  // Get a specific completion by policy reference ID
  const getCompletionByPolicyId = useCallback((policyReferenceId: string): PolicyCompletion | undefined => {
    return completions.find(c => c.policy_reference_id === policyReferenceId);
  }, [completions]);

  // Check if a policy is completed
  const isPolicyCompleted = useCallback((policyReferenceId: string): boolean => {
    return completedPolicyIds.has(policyReferenceId);
  }, [completedPolicyIds]);

  // Calculate days until review
  const getDaysUntilReview = useCallback((reviewDate: string): number => {
    const review = new Date(reviewDate);
    const today = new Date();
    const diffTime = review.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }, []);

  // Delete a completion
  const deleteCompletion = useCallback(async (completionId: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('policy_completions')
        .delete()
        .eq('id', completionId)
        .eq('user_id', user.id);

      if (error) throw error;

      toast.success('Policy completion removed');
      await fetchCompletions();
      return true;
    } catch (error) {
      console.error('Error deleting policy completion:', error);
      toast.error('Failed to remove policy completion');
      return false;
    }
  }, [user, fetchCompletions]);

  // Fetch on mount and when dependencies change
  useEffect(() => {
    fetchCompletions();
  }, [fetchCompletions]);

  return {
    completions,
    isLoading,
    completedPolicyIds,
    saveCompletion,
    getCompletionByPolicyId,
    isPolicyCompleted,
    getDaysUntilReview,
    deleteCompletion,
    refreshCompletions: fetchCompletions,
  };
};
