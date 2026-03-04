ALTER TABLE public.policy_generation_jobs
  ALTER COLUMN email_when_ready SET DEFAULT true;

UPDATE public.policy_generation_jobs
SET email_when_ready = true
WHERE email_when_ready IS NULL;