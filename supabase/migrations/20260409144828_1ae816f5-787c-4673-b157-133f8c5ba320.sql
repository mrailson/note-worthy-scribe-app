
-- Add management_roles_config to existing rate settings table
ALTER TABLE public.nres_buyback_rate_settings
  ADD COLUMN IF NOT EXISTS management_roles_config JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Seed default management roles config
UPDATE public.nres_buyback_rate_settings
SET management_roles_config = '[
  {
    "key": "nres_manager",
    "label": "NRES Neighbourhood Manager",
    "person_name": "Malcolm Railson",
    "person_email": "malcolm.railson@nhs.net",
    "hourly_rate": 0,
    "billing_entity": "Brackley & Towcester PCN Ltd",
    "billing_org_code": "U07902",
    "is_active": true
  },
  {
    "key": "nres_ops_manager",
    "label": "NRES Operations Manager",
    "person_name": "Amanda Palin",
    "person_email": "amanda.palin2@nhs.net",
    "hourly_rate": 0,
    "billing_entity": "Brackley & Towcester PCN Ltd",
    "billing_org_code": "U07902",
    "is_active": true
  },
  {
    "key": "nres_deputy_ops",
    "label": "NRES Deputy Ops Manager",
    "person_name": "Lucy Hibberd",
    "person_email": "",
    "hourly_rate": 0,
    "billing_entity": "Bugbrooke Medical Practice",
    "billing_org_code": "K83070",
    "is_active": true
  }
]'::jsonb
WHERE id = 'default';

-- Create management time tracking table
CREATE TABLE public.nres_management_time (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  management_role_key TEXT NOT NULL,
  person_name TEXT NOT NULL,
  work_date DATE NOT NULL,
  hours NUMERIC NOT NULL DEFAULT 0,
  description TEXT,
  claim_month DATE,
  billing_entity TEXT,
  billing_org_code TEXT,
  hourly_rate NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC GENERATED ALWAYS AS (hours * hourly_rate) STORED,
  status TEXT NOT NULL DEFAULT 'draft',
  submitted_at TIMESTAMPTZ,
  submitted_by TEXT,
  verified_by TEXT,
  verified_at TIMESTAMPTZ,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  query_notes TEXT,
  invoice_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add validation trigger instead of CHECK constraint for status
CREATE OR REPLACE FUNCTION public.validate_nres_management_time()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.hours <= 0 OR NEW.hours > 24 THEN
    RAISE EXCEPTION 'Hours must be between 0 and 24';
  END IF;
  IF NEW.status NOT IN ('draft', 'submitted', 'verified', 'approved', 'queried', 'invoiced', 'paid', 'rejected') THEN
    RAISE EXCEPTION 'Invalid status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER validate_nres_management_time_trigger
  BEFORE INSERT OR UPDATE ON public.nres_management_time
  FOR EACH ROW EXECUTE FUNCTION public.validate_nres_management_time();

-- Enable RLS
ALTER TABLE public.nres_management_time ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins can manage all management time"
  ON public.nres_management_time FOR ALL
  USING (public.is_nres_admin())
  WITH CHECK (public.is_nres_admin());

-- Users can view their own entries
CREATE POLICY "Users can view own management time"
  ON public.nres_management_time FOR SELECT
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_nres_management_time_updated_at
  BEFORE UPDATE ON public.nres_management_time
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Index for common queries
CREATE INDEX idx_nres_management_time_user ON public.nres_management_time(user_id);
CREATE INDEX idx_nres_management_time_month ON public.nres_management_time(claim_month);
CREATE INDEX idx_nres_management_time_role ON public.nres_management_time(management_role_key);
