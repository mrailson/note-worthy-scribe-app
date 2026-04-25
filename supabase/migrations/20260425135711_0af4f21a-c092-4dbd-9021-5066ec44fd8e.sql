CREATE OR REPLACE FUNCTION public.narp_insert_snapshots_with_key(
  p_export_id uuid,
  p_practice_id uuid,
  p_export_date date,
  p_rows jsonb,
  p_pii_key text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_inserted integer := 0;
BEGIN
  IF p_pii_key IS NULL OR p_pii_key = '' THEN
    RAISE EXCEPTION 'NARP_PII_KEY is not configured';
  END IF;

  PERFORM set_config('app.narp_pii_key', p_pii_key, true);

  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'p_rows must be a JSON array';
  END IF;

  INSERT INTO public.narp_patient_snapshots (
    export_id, practice_id, export_date, fk_patient_link_id,
    nhs_number_hash, nhs_number_enc, forenames_enc, surname_enc,
    age, drug_count, frailty_category,
    inpatient_total_admissions, ae_attendances, inpatient_elective,
    outpatient_first, outpatient_followup, rub, poa, polos, risk_tier
  )
  SELECT
    p_export_id,
    p_practice_id,
    p_export_date,
    (r->>'fk_patient_link_id'),
    public.narp_hash_nhs_number(r->>'nhs_number_raw'),
    public.narp_encrypt_pii(r->>'nhs_number_raw'),
    public.narp_encrypt_pii(r->>'forenames_raw'),
    public.narp_encrypt_pii(r->>'surname_raw'),
    NULLIF(r->>'age','')::int,
    COALESCE(NULLIF(r->>'drug_count','')::int, 0),
    NULLIF(r->>'frailty_category',''),
    COALESCE(NULLIF(r->>'inpatient_total_admissions','')::int, 0),
    COALESCE(NULLIF(r->>'ae_attendances','')::int, 0),
    COALESCE(NULLIF(r->>'inpatient_elective','')::int, 0),
    COALESCE(NULLIF(r->>'outpatient_first','')::int, 0),
    COALESCE(NULLIF(r->>'outpatient_followup','')::int, 0),
    NULLIF(r->>'rub',''),
    NULLIF(r->>'poa','')::numeric(5,2),
    NULLIF(r->>'polos','')::numeric(5,2),
    NULLIF(r->>'risk_tier','')
  FROM jsonb_array_elements(p_rows) AS r;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.narp_insert_snapshots_with_key(uuid, uuid, date, jsonb, text) TO service_role;