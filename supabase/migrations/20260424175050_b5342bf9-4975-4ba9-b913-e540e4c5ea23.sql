CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.narp_export_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exported_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL,
  user_email text,
  practice_id uuid NOT NULL,
  included_identifiers boolean NOT NULL DEFAULT false,
  row_count integer NOT NULL,
  column_count integer NOT NULL,
  reason_text text NOT NULL,
  consent_acknowledged boolean NOT NULL DEFAULT false,
  file_checksum text NOT NULL,
  file_size_bytes integer,
  filename text,
  cohort_label text,
  request_ip text,
  user_agent text
);

CREATE INDEX IF NOT EXISTS narp_export_log_user_idx
  ON public.narp_export_log (user_id, exported_at DESC);
CREATE INDEX IF NOT EXISTS narp_export_log_practice_idx
  ON public.narp_export_log (practice_id, exported_at DESC);

ALTER TABLE public.narp_export_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "narp_export_log_select_own" ON public.narp_export_log;
CREATE POLICY "narp_export_log_select_own"
  ON public.narp_export_log
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "narp_export_log_select_practice_admin" ON public.narp_export_log;
CREATE POLICY "narp_export_log_select_practice_admin"
  ON public.narp_export_log
  FOR SELECT
  TO authenticated
  USING (public.has_can_export_narp_identifiable(auth.uid(), practice_id));

DROP POLICY IF EXISTS "narp_export_log_no_client_insert" ON public.narp_export_log;
CREATE POLICY "narp_export_log_no_client_insert"
  ON public.narp_export_log
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.get_narp_export_rows(
  _practice_id uuid,
  _key text
)
RETURNS TABLE (
  fk_patient_link_id text,
  nhs_number text,
  surname text,
  forename text,
  age integer,
  frailty_category text,
  drug_count integer,
  inpatient_total_admissions integer,
  ae_attendances integer,
  rub text,
  poa numeric,
  polos numeric,
  risk_tier text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.has_can_export_narp_identifiable(auth.uid(), _practice_id) THEN
    RAISE EXCEPTION 'permission denied: can_export_narp_identifiable required'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    s.fk_patient_link_id,
    CASE WHEN s.nhs_number_enc IS NULL THEN NULL
         ELSE pgp_sym_decrypt(s.nhs_number_enc, _key) END AS nhs_number,
    CASE WHEN s.surname_enc IS NULL THEN NULL
         ELSE pgp_sym_decrypt(s.surname_enc, _key) END AS surname,
    CASE WHEN s.forenames_enc IS NULL THEN NULL
         ELSE pgp_sym_decrypt(s.forenames_enc, _key) END AS forename,
    s.age,
    s.frailty_category,
    s.drug_count,
    s.inpatient_total_admissions,
    s.ae_attendances,
    s.rub,
    s.poa,
    s.polos,
    s.risk_tier
  FROM public.narp_patient_snapshots s
  WHERE s.practice_id = _practice_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_narp_export_rows(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_narp_export_rows(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.get_narp_export_rows IS
  'Returns identifiable NARP rows for a practice. Decryption key supplied by '
  'the narp-export-identifiable edge function. Caller must hold '
  'can_export_narp_identifiable for the practice.';