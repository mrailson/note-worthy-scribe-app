-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- 1. Add permission flags to user_roles
-- ============================================================
ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS narp_upload_access boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS narp_view_pii_access boolean NOT NULL DEFAULT false;

-- ============================================================
-- 2. Helper: load NARP_PII_KEY pepper from vault / env
--    Stored as a GUC for this DB role; edge function must set it
--    via SET LOCAL app.narp_pii_key='...' OR we read from vault.
--    For simplicity we use vault.decrypted_secrets if available,
--    falling back to current_setting.
-- ============================================================
CREATE OR REPLACE FUNCTION public._narp_pepper()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_key text;
BEGIN
  -- Try vault first (preferred)
  BEGIN
    SELECT decrypted_secret INTO v_key
    FROM vault.decrypted_secrets
    WHERE name = 'NARP_PII_KEY'
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_key := NULL;
  END;

  -- Fallback to GUC (set by edge function via SET LOCAL)
  IF v_key IS NULL OR v_key = '' THEN
    BEGIN
      v_key := current_setting('app.narp_pii_key', true);
    EXCEPTION WHEN OTHERS THEN
      v_key := NULL;
    END;
  END IF;

  IF v_key IS NULL OR v_key = '' THEN
    RAISE EXCEPTION 'NARP_PII_KEY is not configured';
  END IF;

  RETURN v_key;
END;
$$;

REVOKE ALL ON FUNCTION public._narp_pepper() FROM PUBLIC, anon, authenticated;

-- ============================================================
-- 3. PII helper functions
-- ============================================================
CREATE OR REPLACE FUNCTION public.narp_hash_nhs_number(p_nhs text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_normalised text;
BEGIN
  IF p_nhs IS NULL THEN RETURN NULL; END IF;
  -- Normalise: strip all whitespace and non-digits
  v_normalised := regexp_replace(p_nhs, '\D', '', 'g');
  IF v_normalised = '' THEN RETURN NULL; END IF;
  RETURN encode(
    extensions.hmac(v_normalised::bytea, public._narp_pepper()::bytea, 'sha256'),
    'hex'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.narp_encrypt_pii(p_value text)
RETURNS bytea
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF p_value IS NULL OR p_value = '' THEN RETURN NULL; END IF;
  RETURN extensions.pgp_sym_encrypt(p_value, public._narp_pepper());
END;
$$;

CREATE OR REPLACE FUNCTION public.narp_decrypt_pii(p_value bytea)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF p_value IS NULL THEN RETURN NULL; END IF;
  RETURN extensions.pgp_sym_decrypt(p_value, public._narp_pepper());
END;
$$;

REVOKE ALL ON FUNCTION public.narp_hash_nhs_number(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.narp_encrypt_pii(text)    FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.narp_decrypt_pii(bytea)   FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.narp_hash_nhs_number(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.narp_encrypt_pii(text)    TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.narp_decrypt_pii(bytea)   TO service_role;

-- ============================================================
-- 4. Permission helper: does user have a role at this practice?
-- ============================================================
CREATE OR REPLACE FUNCTION public.has_practice_access(p_user uuid, p_practice uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = p_user AND practice_id = p_practice
  );
$$;

CREATE OR REPLACE FUNCTION public.has_narp_upload_access(p_user uuid, p_practice uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = p_user AND practice_id = p_practice
      AND narp_upload_access = true
  );
$$;

CREATE OR REPLACE FUNCTION public.has_narp_view_pii_access(p_user uuid, p_practice uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = p_user AND practice_id = p_practice
      AND narp_view_pii_access = true
  );
$$;

-- ============================================================
-- 5. narp_exports table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.narp_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id uuid NOT NULL REFERENCES public.gp_practices(id) ON DELETE CASCADE,
  export_date date NOT NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  patient_count integer NOT NULL DEFAULT 0,
  file_checksum text NOT NULL UNIQUE,
  file_name text,
  status text NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing','ready','failed')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (practice_id, export_date)
);

CREATE INDEX IF NOT EXISTS idx_narp_exports_practice_date
  ON public.narp_exports (practice_id, export_date DESC);

CREATE INDEX IF NOT EXISTS idx_narp_exports_status
  ON public.narp_exports (status) WHERE status = 'processing';

-- ============================================================
-- 6. narp_patient_snapshots table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.narp_patient_snapshots (
  id bigserial PRIMARY KEY,
  export_id uuid NOT NULL REFERENCES public.narp_exports(id) ON DELETE CASCADE,
  practice_id uuid NOT NULL REFERENCES public.gp_practices(id) ON DELETE CASCADE,
  export_date date NOT NULL,
  fk_patient_link_id text NOT NULL,
  nhs_number_hash text,
  nhs_number_enc bytea,
  forenames_enc bytea,
  surname_enc bytea,
  age integer,
  drug_count integer DEFAULT 0,
  frailty_category text
    CHECK (frailty_category IN ('Fit','Mild','Moderate','Severe','Unknown')),
  inpatient_total_admissions integer DEFAULT 0,
  ae_attendances integer DEFAULT 0,
  inpatient_elective integer DEFAULT 0,
  outpatient_first integer DEFAULT 0,
  outpatient_followup integer DEFAULT 0,
  rub text,
  poa numeric(5,2),
  polos numeric(5,2),
  risk_tier text
    CHECK (risk_tier IN ('Very High','High','Moderate','Rising','Low','Unknown')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_narp_snap_export
  ON public.narp_patient_snapshots (export_id);
CREATE INDEX IF NOT EXISTS idx_narp_snap_practice_date
  ON public.narp_patient_snapshots (practice_id, export_date DESC);
CREATE INDEX IF NOT EXISTS idx_narp_snap_practice_hash
  ON public.narp_patient_snapshots (practice_id, nhs_number_hash);
CREATE INDEX IF NOT EXISTS idx_narp_snap_practice_tier
  ON public.narp_patient_snapshots (practice_id, risk_tier);

-- ============================================================
-- 7. narp_cohort_membership table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.narp_cohort_membership (
  export_id uuid NOT NULL REFERENCES public.narp_exports(id) ON DELETE CASCADE,
  patient_snapshot_id bigint NOT NULL REFERENCES public.narp_patient_snapshots(id) ON DELETE CASCADE,
  practice_id uuid NOT NULL REFERENCES public.gp_practices(id) ON DELETE CASCADE,
  cohort_key text NOT NULL CHECK (cohort_key IN (
    'mdt_intensive','ltc_anchor','smr_eligible','rising_risk',
    'admission_avoidance','falls_risk','frailty_review'
  )),
  PRIMARY KEY (export_id, patient_snapshot_id, cohort_key)
);

CREATE INDEX IF NOT EXISTS idx_narp_cohort_practice_key_export
  ON public.narp_cohort_membership (practice_id, cohort_key, export_id);

-- ============================================================
-- 8. narp_pii_access_log
-- ============================================================
CREATE TABLE IF NOT EXISTS public.narp_pii_access_log (
  id bigserial PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  patient_snapshot_id bigint REFERENCES public.narp_patient_snapshots(id) ON DELETE SET NULL,
  practice_id uuid REFERENCES public.gp_practices(id) ON DELETE SET NULL,
  accessed_at timestamptz NOT NULL DEFAULT now(),
  context text
);

CREATE INDEX IF NOT EXISTS idx_narp_pii_log_user_time
  ON public.narp_pii_access_log (user_id, accessed_at DESC);

-- ============================================================
-- 9. updated_at trigger for narp_exports
-- ============================================================
CREATE OR REPLACE FUNCTION public._narp_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS narp_exports_updated_at ON public.narp_exports;
CREATE TRIGGER narp_exports_updated_at
BEFORE UPDATE ON public.narp_exports
FOR EACH ROW EXECUTE FUNCTION public._narp_set_updated_at();

-- ============================================================
-- 10. Enable RLS
-- ============================================================
ALTER TABLE public.narp_exports             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.narp_patient_snapshots   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.narp_cohort_membership   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.narp_pii_access_log      ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 11. RLS policies — narp_exports
-- ============================================================
DROP POLICY IF EXISTS narp_exports_select ON public.narp_exports;
CREATE POLICY narp_exports_select ON public.narp_exports
FOR SELECT TO authenticated
USING (public.has_practice_access(auth.uid(), practice_id));

DROP POLICY IF EXISTS narp_exports_insert ON public.narp_exports;
CREATE POLICY narp_exports_insert ON public.narp_exports
FOR INSERT TO authenticated
WITH CHECK (public.has_narp_upload_access(auth.uid(), practice_id));

DROP POLICY IF EXISTS narp_exports_update ON public.narp_exports;
CREATE POLICY narp_exports_update ON public.narp_exports
FOR UPDATE TO authenticated
USING (public.has_narp_upload_access(auth.uid(), practice_id))
WITH CHECK (public.has_narp_upload_access(auth.uid(), practice_id));

-- Service role bypasses RLS automatically; no policy needed.

-- ============================================================
-- 12. RLS policies — narp_patient_snapshots
--     IMPORTANT: encrypted columns must never be exposed via SELECT *
--     We rely on a column-grant pattern: revoke from authenticated and
--     grant only the non-PII columns.
-- ============================================================
DROP POLICY IF EXISTS narp_snap_select ON public.narp_patient_snapshots;
CREATE POLICY narp_snap_select ON public.narp_patient_snapshots
FOR SELECT TO authenticated
USING (public.has_practice_access(auth.uid(), practice_id));

-- Lock down encrypted columns at the grant level
REVOKE ALL ON public.narp_patient_snapshots FROM authenticated;
GRANT SELECT (
  id, export_id, practice_id, export_date, fk_patient_link_id,
  nhs_number_hash, age, drug_count, frailty_category,
  inpatient_total_admissions, ae_attendances, inpatient_elective,
  outpatient_first, outpatient_followup, rub, poa, polos, risk_tier,
  created_at
) ON public.narp_patient_snapshots TO authenticated;

-- ============================================================
-- 13. RLS policies — narp_cohort_membership
-- ============================================================
DROP POLICY IF EXISTS narp_cohort_select ON public.narp_cohort_membership;
CREATE POLICY narp_cohort_select ON public.narp_cohort_membership
FOR SELECT TO authenticated
USING (public.has_practice_access(auth.uid(), practice_id));

-- ============================================================
-- 14. RLS policies — narp_pii_access_log (append-only by user)
-- ============================================================
DROP POLICY IF EXISTS narp_pii_log_insert ON public.narp_pii_access_log;
CREATE POLICY narp_pii_log_insert ON public.narp_pii_access_log
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS narp_pii_log_select_own ON public.narp_pii_access_log;
CREATE POLICY narp_pii_log_select_own ON public.narp_pii_access_log
FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- ============================================================
-- 15. get_patient_identifiable RPC
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_patient_identifiable(p_snapshot_id bigint)
RETURNS TABLE (
  snapshot_id bigint,
  nhs_number text,
  forenames text,
  surname text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_practice uuid;
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT practice_id INTO v_practice
  FROM public.narp_patient_snapshots
  WHERE id = p_snapshot_id;

  IF v_practice IS NULL THEN
    RAISE EXCEPTION 'Snapshot not found' USING ERRCODE = '42704';
  END IF;

  IF NOT public.has_narp_view_pii_access(v_user, v_practice) THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;

  -- Audit log
  INSERT INTO public.narp_pii_access_log (user_id, patient_snapshot_id, practice_id, context)
  VALUES (v_user, p_snapshot_id, v_practice, 'get_patient_identifiable');

  RETURN QUERY
  SELECT
    s.id,
    public.narp_decrypt_pii(s.nhs_number_enc),
    public.narp_decrypt_pii(s.forenames_enc),
    public.narp_decrypt_pii(s.surname_enc)
  FROM public.narp_patient_snapshots s
  WHERE s.id = p_snapshot_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_patient_identifiable(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_patient_identifiable(bigint) TO authenticated;