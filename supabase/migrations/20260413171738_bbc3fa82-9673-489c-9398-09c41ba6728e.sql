ALTER TABLE public.nres_buyback_rate_settings
ADD COLUMN IF NOT EXISTS email_sending_disabled boolean NOT NULL DEFAULT false;