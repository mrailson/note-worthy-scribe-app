
-- Add query_flagged_lines to claim_lines
ALTER TABLE public.claim_lines
ADD COLUMN IF NOT EXISTS query_flagged_lines jsonb DEFAULT null;

-- Add notification toggle columns to nres_buyback_rate_settings
ALTER TABLE public.nres_buyback_rate_settings
ADD COLUMN IF NOT EXISTS notify_submitter_on_query boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS notify_verifier_on_query boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS notify_submitter_on_approve boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS notify_verifier_on_approve boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS notify_submitter_on_resubmit boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS notify_director_on_resubmit boolean DEFAULT true;
