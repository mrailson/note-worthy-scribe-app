-- 1. Extend development_costs with multi-currency + VAT + payment fields
ALTER TABLE public.development_costs
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'GBP',
  ADD COLUMN IF NOT EXISTS vat_amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS vat_included BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS gbp_amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS fx_rate NUMERIC(14,6),
  ADD COLUMN IF NOT EXISTS fx_rate_date DATE;

-- Backfill existing rows: assume historical entries were already in GBP
UPDATE public.development_costs
SET gbp_amount = amount, fx_rate = 1, fx_rate_date = cost_date
WHERE gbp_amount IS NULL;

-- 2. FX rate cache
CREATE TABLE IF NOT EXISTS public.fx_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  base_currency TEXT NOT NULL,
  target_currency TEXT NOT NULL,
  rate_date DATE NOT NULL,
  rate NUMERIC(14,6) NOT NULL,
  source TEXT NOT NULL DEFAULT 'exchangerate.host',
  cached_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (base_currency, target_currency, rate_date)
);
CREATE INDEX IF NOT EXISTS idx_fx_rates_lookup ON public.fx_rates (base_currency, target_currency, rate_date);

ALTER TABLE public.fx_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read fx rates" ON public.fx_rates;
CREATE POLICY "Authenticated users can read fx rates"
  ON public.fx_rates FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "System admins can write fx rates" ON public.fx_rates;
CREATE POLICY "System admins can write fx rates"
  ON public.fx_rates FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'system_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'system_admin'));

-- 3. In-kind time entries
CREATE TABLE IF NOT EXISTS public.development_time_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  person_id UUID,
  person_name TEXT NOT NULL,
  role TEXT,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  hours NUMERIC(8,2) NOT NULL,
  charged_rate_gbp NUMERIC(10,2) NOT NULL DEFAULT 0,
  shadow_rate_gbp NUMERIC(10,2) NOT NULL DEFAULT 0,
  notional_value_gbp NUMERIC(12,2) GENERATED ALWAYS AS (hours * shadow_rate_gbp) STORED,
  charged_value_gbp NUMERIC(12,2) GENERATED ALWAYS AS (hours * charged_rate_gbp) STORED,
  category TEXT NOT NULL DEFAULT 'In-kind contribution',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dev_time_period ON public.development_time_entries (period_start, period_end);

ALTER TABLE public.development_time_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "System admins manage time entries" ON public.development_time_entries;
CREATE POLICY "System admins manage time entries"
  ON public.development_time_entries FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'system_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'system_admin'));

CREATE TRIGGER update_development_time_entries_updated_at
  BEFORE UPDATE ON public.development_time_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();