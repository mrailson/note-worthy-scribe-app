WITH job AS (
  SELECT *
  FROM public.policy_generation_jobs
  WHERE id = '71518d26-6759-4c8b-bf24-0b261d4bd4b9'
    AND status IN ('pending', 'generating', 'enhancing')
    AND generated_content IS NOT NULL
)
INSERT INTO public.policy_completions (
  user_id,
  practice_id,
  policy_reference_id,
  policy_title,
  policy_content,
  metadata,
  effective_date,
  review_date,
  version,
  status
)
SELECT
  j.user_id,
  NULL,
  j.policy_reference_id::uuid,
  COALESCE((j.metadata->>'title')::text, j.policy_title),
  j.generated_content,
  COALESCE(j.metadata, '{}'::jsonb),
  current_date,
  (current_date + interval '1 year')::date,
  COALESCE(NULLIF((j.metadata->>'version')::text, ''), '1.0'),
  'completed'
FROM job j
WHERE NOT EXISTS (
  SELECT 1 FROM public.policy_completions c
  WHERE c.user_id = j.user_id
    AND c.policy_reference_id::text = j.policy_reference_id::text
    AND c.status = 'completed'
);

WITH job AS (
  SELECT *
  FROM public.policy_generation_jobs
  WHERE id = '71518d26-6759-4c8b-bf24-0b261d4bd4b9'
    AND status IN ('pending', 'generating', 'enhancing')
    AND generated_content IS NOT NULL
)
INSERT INTO public.policy_generations (
  user_id,
  practice_id,
  policy_name,
  generation_type,
  generated_content,
  metadata,
  policy_reference_id,
  status
)
SELECT
  j.user_id,
  NULL,
  COALESCE((j.metadata->>'title')::text, j.policy_title),
  'new',
  j.generated_content,
  COALESCE(j.metadata, '{}'::jsonb),
  j.policy_reference_id::uuid,
  'completed'
FROM job j;

UPDATE public.policy_generation_jobs
SET
  status = 'completed',
  completed_at = now(),
  updated_at = now(),
  error_message = NULL
WHERE id = '71518d26-6759-4c8b-bf24-0b261d4bd4b9'
  AND status IN ('pending', 'generating', 'enhancing');