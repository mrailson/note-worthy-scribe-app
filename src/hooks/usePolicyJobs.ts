import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface PolicyJob {
  id: string;
  user_id: string;
  policy_reference_id: string;
  policy_title: string;
  status: 'pending' | 'generating' | 'enhancing' | 'optimising' | 'completed' | 'failed';
  email_when_ready: boolean;
  error_message: string | null;
  generated_content: string | null;
  metadata: any;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  // Orchestration fields
  current_step: string | null;
  progress_pct: number | null;
  heartbeat_at: string | null;
  lease_expires_at: string | null;
  attempt_count: number | null;
}

const STEP_LABELS: Record<string, string> = {
  generate_part_1: 'Generating (part 1/5)',
  generate_part_2: 'Generating (part 2/5)',   // legacy fallback
  generate_part_2a: 'Generating (part 2/5)',
  generate_part_2b: 'Generating (part 3/5)',
  generate_part_3: 'Generating (part 4/5)',   // legacy fallback
  generate_part_3a: 'Generating (part 4/5)',
  generate_part_3b: 'Generating (part 5/5)',
  enhance: 'Enhancing',
  gap_check: 'Checking compliance',
  auto_quality_1: 'Quality check 1 of 3…',
  auto_quality_2: 'Quality check 2 of 3…',
  auto_quality_3: 'Quality check 3 of 3…',
  finalise: 'Finalising',
  done: 'Complete',
};

export const getStepLabel = (job: PolicyJob): string => {
  if (job.status === 'pending') return 'Queued';
  if (job.status === 'completed') return 'Complete';
  if (job.status === 'failed') return 'Failed';
  if (job.status === 'optimising') return STEP_LABELS[job.current_step || ''] || 'Optimising quality…';
  return STEP_LABELS[job.current_step || ''] || job.status;
};

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

  // Kick the queue processor when needed
  const kickQueue = useCallback(async () => {
    if (!user) return;

    // Only kick once every 30 seconds
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
    j => j.status === 'pending' || j.status === 'generating' || j.status === 'enhancing' || j.status === 'optimising'
  ).length;

  // Check for stale jobs using lease_expires_at (not raw updated_at)
  useEffect(() => {
    if (activeJobCount === 0) return;

    const hasStaleJobs = jobs.some(j => {
      if (!['pending', 'generating', 'enhancing'].includes(j.status)) return false;
      // Pending jobs with no lease are always kickable
      if (j.status === 'pending') return true;
      // Jobs with expired lease are stale
      if (j.lease_expires_at) {
        return new Date(j.lease_expires_at).getTime() < Date.now();
      }
      // Legacy: no lease set, fall back to heartbeat/updated_at staleness
      const heartbeat = j.heartbeat_at || j.updated_at;
      return Date.now() - new Date(heartbeat).getTime() > 120000; // 2 minutes
    });

    if (hasStaleJobs) {
      kickQueue();
    }
  }, [jobs, activeJobCount, kickQueue]);

  // Poll every 10s when there are active jobs (faster for multi-step)
  useEffect(() => {
    if (activeJobCount > 0) {
      pollRef.current = setInterval(fetchJobs, 10000);
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
    fetchJobs().then(() => {
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
