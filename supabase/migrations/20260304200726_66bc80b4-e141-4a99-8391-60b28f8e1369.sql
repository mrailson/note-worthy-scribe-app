
CREATE TABLE public.policy_generation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  policy_reference_id TEXT NOT NULL,
  policy_title TEXT NOT NULL,
  practice_details JSONB NOT NULL,
  custom_instructions TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  email_when_ready BOOLEAN DEFAULT false,
  generated_content TEXT,
  metadata JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE public.policy_generation_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own jobs"
  ON public.policy_generation_jobs
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own jobs"
  ON public.policy_generation_jobs
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
