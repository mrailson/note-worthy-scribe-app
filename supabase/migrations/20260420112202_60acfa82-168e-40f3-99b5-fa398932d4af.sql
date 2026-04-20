ALTER TABLE public.nres_buyback_rate_settings
ADD COLUMN IF NOT EXISTS notify_submitter_on_paid boolean NOT NULL DEFAULT true;