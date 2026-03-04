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
  const lastKickRef = useRef<number>(0);

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

  // Kick the queue processor if there are stale pending/enhancing jobs
  const kickQueue = useCallback(async () => {
    if (!user) return;

    // Only kick once every 30 seconds to avoid spamming
    const now = Date.now();
    if (now - lastKickRef.current < 30000) return;
    lastKickRef.current = now;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      fetch(`${supabaseUrl}/functions/v1/generate-policy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ action: 'process-job', job_user_id: user.id }),
      }).catch(() => {}); // Fire and forget

      console.log('[usePolicyJobs] Kicked queue processor');
    } catch (e) {
      console.error('[usePolicyJobs] Failed to kick queue:', e);
    }
  }, [user]);

  const activeJobCount = jobs.filter(
    j => j.status === 'pending' || j.status === 'generating' || j.status === 'enhancing'
  ).length;

  // Check for stale jobs and kick queue when needed
  useEffect(() => {
    if (activeJobCount === 0) return;

    // Check if any active jobs haven't been updated in 60+ seconds (stale)
    const hasStaleJobs = jobs.some(j => {
      if (!['pending', 'generating', 'enhancing'].includes(j.status)) return false;
      const updatedAt = new Date(j.updated_at).getTime();
      return Date.now() - updatedAt > 60000; // 60 seconds without update = stale
    });

    if (hasStaleJobs) {
      kickQueue();
    }
  }, [jobs, activeJobCount, kickQueue]);

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

  // Initial fetch — and kick queue if there are active jobs
  useEffect(() => {
    setIsLoading(true);
    fetchJobs().then(() => {
      // After initial fetch, kick queue for any pending jobs (covers recovery scenarios)
      // The kickQueue has its own 30s throttle so this is safe
      kickQueue();
    }).finally(() => setIsLoading(false));
  }, [fetchJobs, kickQueue]);

  return {
    jobs,
    activeJobCount,
    isLoading,
    refetch: fetchJobs,
    kickQueue,
  };
};
