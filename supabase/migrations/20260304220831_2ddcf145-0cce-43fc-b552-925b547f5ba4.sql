
-- Add orchestration columns for step-based pipeline
ALTER TABLE public.policy_generation_jobs
ADD COLUMN IF NOT EXISTS current_step text DEFAULT 'generate_part_1',
ADD COLUMN IF NOT EXISTS progress_pct integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS attempt_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS heartbeat_at timestamptz DEFAULT now(),
ADD COLUMN IF NOT EXISTS lease_expires_at timestamptz,
ADD COLUMN IF NOT EXISTS next_retry_at timestamptz;

-- Reset any currently stuck jobs so they get picked up by the new pipeline
UPDATE public.policy_generation_jobs
SET status = 'pending',
    current_step = 'generate_part_1',
    attempt_count = 0,
    error_message = 'Reset by system upgrade to step-based pipeline'
WHERE status IN ('generating', 'enhancing');

-- Index for efficient worker claim queries
CREATE INDEX IF NOT EXISTS idx_policy_jobs_worker ON public.policy_generation_jobs (user_id, status, lease_expires_at);
