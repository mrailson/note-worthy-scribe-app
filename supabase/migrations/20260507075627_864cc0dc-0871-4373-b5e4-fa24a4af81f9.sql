
-- NRES PPG Patient Survey schema
CREATE TABLE public.nres_ppg_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  practice_id text NOT NULL CHECK (practice_id IN ('brackley','brook','bugbrooke','denton','parks','springfield','towcester','unsure')),
  practice_label text NOT NULL,
  rating text NOT NULL CHECK (rating IN ('better','same','worse')),
  followup_reason text CHECK (followup_reason IS NULL OR followup_reason IN ('couldnt-get-through','no-appointment','wait-too-long','other')),
  followup_label text,
  comment text CHECK (comment IS NULL OR char_length(comment) <= 400),
  user_agent text,
  submission_token text,
  CONSTRAINT worse_requires_reason CHECK (rating <> 'worse' OR followup_reason IS NOT NULL)
);

CREATE INDEX idx_nres_ppg_responses_submitted_at ON public.nres_ppg_responses (submitted_at DESC);
CREATE INDEX idx_nres_ppg_responses_practice ON public.nres_ppg_responses (practice_id);
CREATE INDEX idx_nres_ppg_responses_token_time ON public.nres_ppg_responses (submission_token, submitted_at DESC);

ALTER TABLE public.nres_ppg_responses ENABLE ROW LEVEL SECURITY;

-- Anonymous public can INSERT only
CREATE POLICY "Anyone can submit a PPG response"
  ON public.nres_ppg_responses
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- System admins can SELECT all
CREATE POLICY "System admins can view PPG responses"
  ON public.nres_ppg_responses
  FOR SELECT
  TO authenticated
  USING (public.is_system_admin(auth.uid()));

-- Email failures audit
CREATE TABLE public.email_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  response_id uuid,
  source text NOT NULL DEFAULT 'submit-ppg-response',
  error_message text,
  payload jsonb
);

ALTER TABLE public.email_failures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System admins can view email failures"
  ON public.email_failures
  FOR SELECT
  TO authenticated
  USING (public.is_system_admin(auth.uid()));
