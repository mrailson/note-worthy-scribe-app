import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface PolicyJob {
  id: string;
  user_id: string;
  policy_reference_id: string;
  policy_title: string;
  status: 'pending' | 'generating' | 'enhancing' | 'completed' | 'failed';
  email_when_ready: boolean;
  error_message: string | null;
  generated_content: string | null;
  metadata: any;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export const usePolicyJobs = () => {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<PolicyJob[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchJobs = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('policy_generation_jobs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setJobs((data || []) as unknown as PolicyJob[]);
    } catch (error) {
      console.error('Error fetching policy jobs:', error);
    }
  }, [user]);

  const activeJobCount = jobs.filter(
    j => j.status === 'pending' || j.status === 'generating' || j.status === 'enhancing'
  ).length;

  // Poll every 15s when there are active jobs
  useEffect(() => {
    if (activeJobCount > 0) {
      pollRef.current = setInterval(fetchJobs, 15000);
    } else if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [activeJobCount, fetchJobs]);

  // Initial fetch
  useEffect(() => {
    setIsLoading(true);
    fetchJobs().finally(() => setIsLoading(false));
  }, [fetchJobs]);

  return {
    jobs,
    activeJobCount,
    isLoading,
    refetch: fetchJobs,
  };
};
