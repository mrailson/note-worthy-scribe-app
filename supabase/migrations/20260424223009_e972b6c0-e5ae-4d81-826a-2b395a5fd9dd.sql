CREATE OR REPLACE FUNCTION public.get_narp_identifiable_by_refs(
  _practice_id uuid,
  _fk_patient_link_ids text[]
)
RETURNS TABLE (
  fk_patient_link_id text,
  nhs_number text,
  forenames text,
  surname text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF _practice_id IS NULL OR COALESCE(array_length(_fk_patient_link_ids, 1), 0) = 0 THEN
    RETURN;
  END IF;

  IF NOT public.has_narp_view_pii_access(v_user, _practice_id) THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;

  WITH latest AS (
    SELECT DISTINCT ON (s.fk_patient_link_id)
      s.id,
      s.practice_id,
      s.fk_patient_link_id,
      s.nhs_number_enc,
      s.forenames_enc,
      s.surname_enc
    FROM public.narp_patient_snapshots s
    WHERE s.practice_id = _practice_id
      AND s.fk_patient_link_id = ANY(_fk_patient_link_ids)
    ORDER BY s.fk_patient_link_id, s.export_date DESC, s.created_at DESC, s.id DESC
  ), audit AS (
    INSERT INTO public.narp_pii_access_log (user_id, patient_snapshot_id, practice_id, context)
    SELECT v_user, latest.id, latest.practice_id, 'show_identifiable_details_toggle'
    FROM latest
    RETURNING 1
  )
  SELECT
    latest.fk_patient_link_id,
    public.narp_decrypt_pii(latest.nhs_number_enc),
    public.narp_decrypt_pii(latest.forenames_enc),
    public.narp_decrypt_pii(latest.surname_enc)
  FROM latest;
END;
$$;

REVOKE ALL ON FUNCTION public.get_narp_identifiable_by_refs(uuid, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_narp_identifiable_by_refs(uuid, text[]) TO authenticated;