
CREATE TABLE public.agewell_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  channel text NOT NULL DEFAULT 'web' CHECK (channel IN ('web','paper','telephony')),
  practice_canonical text,
  practice_label_freeform text,
  branch_site text,
  support_worker_rating integer CHECK (support_worker_rating BETWEEN 1 AND 5),
  equipment_provided text CHECK (equipment_provided IN ('yes','no','unsure')),
  signposted text CHECK (signposted IN ('yes','no')),
  online_meeting_concerns_discussed text CHECK (online_meeting_concerns_discussed IN ('yes','no','unsure','not_applicable')),
  medicine_review_beneficial text CHECK (medicine_review_beneficial IN ('yes','no','unsure','not_applicable')),
  listened_to_concerns text CHECK (listened_to_concerns IN ('agree','neutral','disagree')),
  more_independent text CHECK (more_independent IN ('agree','neutral','disagree')),
  most_significant_difference text CHECK (most_significant_difference IS NULL OR char_length(most_significant_difference) <= 1000),
  overall_rating integer CHECK (overall_rating BETWEEN 1 AND 5),
  would_recommend text CHECK (would_recommend IN ('yes','no','unsure')),
  suggestions_concerns text CHECK (suggestions_concerns IS NULL OR char_length(suggestions_concerns) <= 1000),
  completed_with_support text CHECK (completed_with_support IN ('with_support_worker','on_my_own','phone_with_automated_assistant')),
  call_duration_seconds integer,
  transcript_json jsonb,
  user_agent text,
  submission_token text,
  email_sent_at timestamptz
);

CREATE INDEX agewell_responses_submitted_at_idx ON public.agewell_responses (submitted_at DESC);
CREATE INDEX agewell_responses_practice_idx ON public.agewell_responses (practice_canonical);
CREATE INDEX agewell_responses_channel_idx ON public.agewell_responses (channel);
CREATE INDEX agewell_responses_token_idx ON public.agewell_responses (submission_token, submitted_at DESC);

ALTER TABLE public.agewell_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit ageing well responses"
ON public.agewell_responses
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "System admins can view ageing well responses"
ON public.agewell_responses
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'system_admin'::app_role));
