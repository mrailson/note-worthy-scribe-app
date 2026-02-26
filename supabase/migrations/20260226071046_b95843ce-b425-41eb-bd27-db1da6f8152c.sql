CREATE TABLE public.nres_buyback_rate_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  on_costs_pct NUMERIC NOT NULL DEFAULT 29.38,
  roles_config JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.nres_buyback_rate_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read rate settings"
  ON public.nres_buyback_rate_settings FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins can manage rate settings"
  ON public.nres_buyback_rate_settings FOR ALL
  TO authenticated
  USING (public.is_nres_admin(auth.uid()))
  WITH CHECK (public.is_nres_admin(auth.uid()));

INSERT INTO public.nres_buyback_rate_settings (id, on_costs_pct, roles_config)
VALUES ('default', 29.38, '[
  {"key":"gp","label":"GP","annual_rate":11000,"allocation_default":"sessions","working_hours_per_year":1950},
  {"key":"anp","label":"ANP","annual_rate":55000,"allocation_default":"hours","working_hours_per_year":1950},
  {"key":"acp","label":"ACP","annual_rate":50000,"allocation_default":"hours","working_hours_per_year":1950},
  {"key":"practice_nurse","label":"Practice Nurse","annual_rate":35000,"allocation_default":"hours","working_hours_per_year":1950},
  {"key":"hca","label":"HCA","annual_rate":25000,"allocation_default":"hours","working_hours_per_year":1950},
  {"key":"pharmacist","label":"Pharmacist","annual_rate":45000,"allocation_default":"hours","working_hours_per_year":1950}
]'::jsonb);