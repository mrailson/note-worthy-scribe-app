
-- 1. Add is_verifier flag to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_verifier boolean NOT NULL DEFAULT false;

-- 2. Extend nres_time_entries with entered_by + practice_id
ALTER TABLE public.nres_time_entries
  ADD COLUMN IF NOT EXISTS entered_by uuid,
  ADD COLUMN IF NOT EXISTS practice_id uuid REFERENCES public.gp_practices(id);

UPDATE public.nres_time_entries SET entered_by = user_id WHERE entered_by IS NULL;

-- 3. Audit table
CREATE TABLE IF NOT EXISTS public.nres_time_entry_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL,
  subject_user_id uuid NOT NULL,
  edited_by uuid NOT NULL,
  edited_at timestamptz NOT NULL DEFAULT now(),
  action text NOT NULL CHECK (action IN ('create','update','delete')),
  previous_values jsonb,
  new_values jsonb
);
ALTER TABLE public.nres_time_entry_audit ENABLE ROW LEVEL SECURITY;

-- 4. Targets table
CREATE TABLE IF NOT EXISTS public.nres_time_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text,
  user_id uuid,
  period text NOT NULL CHECK (period IN ('week','month')),
  target_hours numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((role IS NOT NULL) <> (user_id IS NOT NULL))
);
ALTER TABLE public.nres_time_targets ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS nres_time_targets_role_period_uniq
  ON public.nres_time_targets(role, period) WHERE role IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS nres_time_targets_user_period_uniq
  ON public.nres_time_targets(user_id, period) WHERE user_id IS NOT NULL;

-- 5. Helper: is current user a NRES verifier?
CREATE OR REPLACE FUNCTION public.is_nres_verifier(_uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = _uid AND p.is_verifier = true
  ) OR EXISTS (
    SELECT 1 FROM public.nres_system_roles r
    JOIN auth.users u ON lower(u.email) = lower(r.user_email)
    WHERE u.id = _uid AND r.is_active = true
      AND r.role IN ('super_admin','management_lead')
  );
$$;

-- 6. Update RLS on nres_time_entries: verifiers can see/manage all
DROP POLICY IF EXISTS "users select own time entries" ON public.nres_time_entries;
DROP POLICY IF EXISTS "users insert own time entries" ON public.nres_time_entries;
DROP POLICY IF EXISTS "users update own time entries" ON public.nres_time_entries;
DROP POLICY IF EXISTS "users delete own time entries" ON public.nres_time_entries;

CREATE POLICY "select own or verifier all" ON public.nres_time_entries
  FOR SELECT USING (auth.uid() = user_id OR public.is_nres_verifier(auth.uid()));
CREATE POLICY "insert own or verifier on behalf" ON public.nres_time_entries
  FOR INSERT WITH CHECK (auth.uid() = user_id OR public.is_nres_verifier(auth.uid()));
CREATE POLICY "update own or verifier" ON public.nres_time_entries
  FOR UPDATE USING (auth.uid() = user_id OR public.is_nres_verifier(auth.uid()));
CREATE POLICY "delete own or verifier" ON public.nres_time_entries
  FOR DELETE USING (auth.uid() = user_id OR public.is_nres_verifier(auth.uid()));

-- 7. Audit RLS: verifiers + subject user can read; insert handled by trigger (security definer)
CREATE POLICY "verifier or subject can read audit" ON public.nres_time_entry_audit
  FOR SELECT USING (auth.uid() = subject_user_id OR public.is_nres_verifier(auth.uid()));

-- 8. Targets RLS: any authenticated can read; verifiers can manage
CREATE POLICY "authenticated read targets" ON public.nres_time_targets
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "verifier manage targets" ON public.nres_time_targets
  FOR ALL USING (public.is_nres_verifier(auth.uid())) WITH CHECK (public.is_nres_verifier(auth.uid()));

-- 9. Trigger to write audit + auto-fill entered_by
CREATE OR REPLACE FUNCTION public.nres_time_entry_audit_fn()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.entered_by IS NULL THEN NEW.entered_by := auth.uid(); END IF;
    IF NEW.entered_by IS DISTINCT FROM NEW.user_id THEN
      INSERT INTO public.nres_time_entry_audit(entry_id, subject_user_id, edited_by, action, new_values)
      VALUES (NEW.id, NEW.user_id, COALESCE(auth.uid(), NEW.entered_by), 'create', to_jsonb(NEW));
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF auth.uid() IS DISTINCT FROM OLD.user_id THEN
      INSERT INTO public.nres_time_entry_audit(entry_id, subject_user_id, edited_by, action, previous_values, new_values)
      VALUES (NEW.id, OLD.user_id, auth.uid(), 'update', to_jsonb(OLD), to_jsonb(NEW));
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF auth.uid() IS DISTINCT FROM OLD.user_id THEN
      INSERT INTO public.nres_time_entry_audit(entry_id, subject_user_id, edited_by, action, previous_values)
      VALUES (OLD.id, OLD.user_id, auth.uid(), 'delete', to_jsonb(OLD));
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS nres_time_entry_audit_trg ON public.nres_time_entries;
CREATE TRIGGER nres_time_entry_audit_trg
  BEFORE INSERT OR UPDATE OR DELETE ON public.nres_time_entries
  FOR EACH ROW EXECUTE FUNCTION public.nres_time_entry_audit_fn();

-- 10. Seed verifiers
UPDATE public.profiles SET is_verifier = true
  WHERE user_id IN (
    'bc4782af-d993-47dc-97a5-6340feb2a3fa',  -- Lucy Hibberd
    '48d7c1ee-9ed6-4b56-b415-88d4afc04458',  -- Amanda Palin
    'def4df23-47db-4c7f-abc7-cf0b65f99533'   -- Malcolm Railson
  );

-- 11. Seed default targets
INSERT INTO public.nres_time_targets(role, period, target_hours) VALUES
  ('practice_manager','month', 18.75),
  ('operations','month', 150),
  ('gp','month', 18.75),
  ('acp_anp','month', 18.75),
  ('admin','month', 18.75)
ON CONFLICT DO NOTHING;
