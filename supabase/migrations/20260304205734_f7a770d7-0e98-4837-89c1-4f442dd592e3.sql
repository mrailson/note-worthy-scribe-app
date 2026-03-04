UPDATE public.policy_generation_jobs
SET
  status = 'enhancing',
  updated_at = now() - interval '2 minutes',
  metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{enhance_retries}', '2')
WHERE id = '71518d26-6759-4c8b-bf24-0b261d4bd4b9';