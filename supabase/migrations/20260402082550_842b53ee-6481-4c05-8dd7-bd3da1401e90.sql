
-- ENN Hubs table
CREATE TABLE public.enn_hubs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  practice_id uuid REFERENCES public.gp_practices(id) ON DELETE CASCADE NOT NULL,
  hub_name text NOT NULL,
  hub_list_size integer NOT NULL DEFAULT 0,
  annual_income numeric NOT NULL DEFAULT 0,
  weekly_appts_required integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.enn_hubs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view ENN hubs"
  ON public.enn_hubs FOR SELECT TO authenticated USING (true);

CREATE POLICY "System admins can manage ENN hubs"
  ON public.enn_hubs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'system_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'system_admin'));

-- ENN Hub-Practice Mappings
CREATE TABLE public.enn_hub_practice_mappings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hub_id uuid REFERENCES public.enn_hubs(id) ON DELETE CASCADE NOT NULL,
  practice_id uuid REFERENCES public.gp_practices(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(hub_id, practice_id)
);

ALTER TABLE public.enn_hub_practice_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view ENN hub mappings"
  ON public.enn_hub_practice_mappings FOR SELECT TO authenticated USING (true);

CREATE POLICY "System admins can manage ENN hub mappings"
  ON public.enn_hub_practice_mappings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'system_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'system_admin'));

-- ENN Practice Data
CREATE TABLE public.enn_practice_data (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  practice_id uuid REFERENCES public.gp_practices(id) ON DELETE CASCADE NOT NULL UNIQUE,
  ods_code text NOT NULL,
  list_size integer NOT NULL DEFAULT 0,
  address text,
  annual_appts_required integer NOT NULL DEFAULT 0,
  weekly_appts_required integer NOT NULL DEFAULT 0,
  participating_winter boolean NOT NULL DEFAULT true,
  winter_appts_required integer NOT NULL DEFAULT 0,
  non_winter_appts_required integer NOT NULL DEFAULT 0,
  weekly_non_winter_appts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.enn_practice_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view ENN practice data"
  ON public.enn_practice_data FOR SELECT TO authenticated USING (true);

CREATE POLICY "System admins can manage ENN practice data"
  ON public.enn_practice_data FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'system_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'system_admin'));
