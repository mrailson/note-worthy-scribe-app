ALTER TABLE public.narp_pii_access_log
  ADD COLUMN IF NOT EXISTS fk_patient_link_id text;

CREATE INDEX IF NOT EXISTS idx_narp_pii_access_log_patient_ref_accessed
  ON public.narp_pii_access_log (fk_patient_link_id, accessed_at DESC);

CREATE OR REPLACE FUNCTION public.log_narp_patient_reveal(
  _practice_id uuid,
  _fk_patient_link_id text,
  _route text,
  _context text DEFAULT 'patient_detail_reveal'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF _practice_id IS NULL OR NULLIF(trim(_fk_patient_link_id), '') IS NULL THEN
    RAISE EXCEPTION 'Practice and patient reference are required' USING ERRCODE = '22023';
  END IF;

  IF NOT public.has_can_view_narp_identifiable(auth.uid(), _practice_id) THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.narp_pii_access_log
    (user_id, practice_id, fk_patient_link_id, context, route, patient_count_rendered, accessed_at)
  VALUES
    (auth.uid(), _practice_id, trim(_fk_patient_link_id), COALESCE(NULLIF(trim(_context), ''), 'patient_detail_reveal'), COALESCE(NULLIF(trim(_route), ''), 'unknown'), 1, now());
END;
$$;

REVOKE ALL ON FUNCTION public.log_narp_patient_reveal(uuid, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.log_narp_patient_reveal(uuid, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.log_narp_patient_reveal(uuid, text, text, text) TO authenticated;