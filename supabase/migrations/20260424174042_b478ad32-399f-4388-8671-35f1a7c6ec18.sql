-- ============================================================
-- Phase A: NRES identifiable-data permission model
-- ============================================================
-- Adds two new per-user, per-practice permission flags on user_roles:
--   can_view_narp_identifiable    (sees NHS no, name, DOB inline)
--   can_export_narp_identifiable  (sees identifiable export button;
--                                  superset -> implies view)
-- Hard-removes legacy narp_view_pii_access (zero existing grants confirmed).
-- Repurposes narp_pii_access_log into a per-page-load audit table.
-- ============================================================

-- 1. New permission columns on user_roles ---------------------
ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS can_view_narp_identifiable boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_export_narp_identifiable boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.user_roles.can_view_narp_identifiable IS
  'NMoC DSA permission: user may see NHS number, surname, forename, DOB inline for the practice referenced by user_roles.practice_id. Default false. Grant manually only.';
COMMENT ON COLUMN public.user_roles.can_export_narp_identifiable IS
  'NMoC DSA permission: user may export identifiable NRES CSVs for the practice referenced by user_roles.practice_id. Implies can_view_narp_identifiable. Default false. Grant manually only.';

-- Enforce superset rule: export implies view --------------------
CREATE OR REPLACE FUNCTION public._enforce_narp_export_implies_view()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.can_export_narp_identifiable = true AND NEW.can_view_narp_identifiable = false THEN
    NEW.can_view_narp_identifiable := true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_narp_export_implies_view ON public.user_roles;
CREATE TRIGGER trg_narp_export_implies_view
BEFORE INSERT OR UPDATE OF can_view_narp_identifiable, can_export_narp_identifiable
ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public._enforce_narp_export_implies_view();

-- 2. Permission helpers (per-practice) ------------------------
CREATE OR REPLACE FUNCTION public.has_can_view_narp_identifiable(_user_id uuid, _practice_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND practice_id = _practice_id
      AND can_view_narp_identifiable = true
  );
$$;

CREATE OR REPLACE FUNCTION public.has_can_export_narp_identifiable(_user_id uuid, _practice_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND practice_id = _practice_id
      AND can_export_narp_identifiable = true
  );
$$;

-- 3. Drop the legacy permission (zero grants confirmed) -------
DROP FUNCTION IF EXISTS public.has_narp_view_pii_access(uuid, uuid);
DROP FUNCTION IF EXISTS public.has_narp_view_pii_access(uuid);
ALTER TABLE public.user_roles DROP COLUMN IF EXISTS narp_view_pii_access;

-- 4. Repurpose narp_pii_access_log to per-page-load shape -----
--    Drop unused per-patient column, add page-load columns.
ALTER TABLE public.narp_pii_access_log
  DROP COLUMN IF EXISTS patient_snapshot_id;

ALTER TABLE public.narp_pii_access_log
  ADD COLUMN IF NOT EXISTS route text,
  ADD COLUMN IF NOT EXISTS patient_count_rendered integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_narp_pii_access_log_user_accessed
  ON public.narp_pii_access_log (user_id, accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_narp_pii_access_log_practice_accessed
  ON public.narp_pii_access_log (practice_id, accessed_at DESC);

-- 5. RLS: users may insert their own audit rows; only admins read --
ALTER TABLE public.narp_pii_access_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert their own pii access log row" ON public.narp_pii_access_log;
CREATE POLICY "Users can insert their own pii access log row"
ON public.narp_pii_access_log
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read their own pii access log rows" ON public.narp_pii_access_log;
CREATE POLICY "Users can read their own pii access log rows"
ON public.narp_pii_access_log
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 6. RPC: log a single page-load audit row --------------------
CREATE OR REPLACE FUNCTION public.log_narp_pii_page_access(
  _practice_id uuid,
  _route text,
  _patient_count_rendered integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Only log if the caller actually has identifiable view rights
  -- for the practice they're viewing. This prevents log spam from
  -- users without the permission and prevents fraudulent log rows.
  IF NOT public.has_can_view_narp_identifiable(auth.uid(), _practice_id) THEN
    RETURN;
  END IF;

  INSERT INTO public.narp_pii_access_log
    (user_id, practice_id, route, patient_count_rendered, accessed_at)
  VALUES
    (auth.uid(), _practice_id, _route, GREATEST(_patient_count_rendered, 0), now());
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_narp_pii_page_access(uuid, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_can_view_narp_identifiable(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_can_export_narp_identifiable(uuid, uuid) TO authenticated;