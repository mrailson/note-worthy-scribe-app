ALTER TABLE public.nres_buyback_rate_settings
ADD COLUMN IF NOT EXISTS allow_invoice_email_when_suppressed BOOLEAN NOT NULL DEFAULT false;