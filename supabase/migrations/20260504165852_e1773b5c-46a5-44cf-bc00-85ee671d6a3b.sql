
-- NRES Pay Alignment Survey: surveys + responses
CREATE TABLE public.nres_pay_alignment_surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text UNIQUE NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  closed_at timestamptz,
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE public.nres_pay_alignment_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES public.nres_pay_alignment_surveys(id) ON DELETE CASCADE,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  practice text,
  is_anonymous boolean NOT NULL,
  responses jsonb NOT NULL,
  comments jsonb,
  risk_flag text,
  client_hash text
);

CREATE INDEX idx_pay_align_responses_survey ON public.nres_pay_alignment_responses(survey_id, submitted_at DESC);
CREATE INDEX idx_pay_align_responses_client_hash ON public.nres_pay_alignment_responses(client_hash, submitted_at DESC);

ALTER TABLE public.nres_pay_alignment_surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nres_pay_alignment_responses ENABLE ROW LEVEL SECURITY;

-- Public can read survey metadata (only active surveys, soft gate via token in URL)
CREATE POLICY "Public can read active surveys"
  ON public.nres_pay_alignment_surveys
  FOR SELECT
  USING (is_active = true);

-- Admins can do everything on surveys
CREATE POLICY "Admins manage surveys"
  ON public.nres_pay_alignment_surveys
  FOR ALL
  USING (public.has_role(auth.uid(), 'system_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'system_admin'::app_role));

-- Responses: only admins can SELECT or DELETE.
-- INSERT is restricted to the edge function (service role bypasses RLS); no public insert policy.
CREATE POLICY "Admins read responses"
  ON public.nres_pay_alignment_responses
  FOR SELECT
  USING (public.has_role(auth.uid(), 'system_admin'::app_role));

CREATE POLICY "Admins delete responses"
  ON public.nres_pay_alignment_responses
  FOR DELETE
  USING (public.has_role(auth.uid(), 'system_admin'::app_role));
