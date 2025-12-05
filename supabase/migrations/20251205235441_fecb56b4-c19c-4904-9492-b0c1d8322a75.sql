-- Fix the archive function to use correct column name (practice_code, not ods_code)
CREATE OR REPLACE FUNCTION public.archive_lg_patient_before_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_scanned_by TEXT;
  v_practice_name TEXT;
BEGIN
  -- Get scanner name from profiles
  SELECT full_name INTO v_scanned_by
  FROM public.profiles
  WHERE user_id = OLD.user_id;
  
  -- Get practice name from gp_practices using practice_code column
  SELECT name INTO v_practice_name
  FROM public.gp_practices
  WHERE practice_code = OLD.practice_ods;
  
  -- Insert archive record
  INSERT INTO public.lg_patients_archive (
    original_patient_id,
    patient_name,
    nhs_number,
    patient_dob,
    pages_scanned,
    pages_blank,
    practice_ods,
    practice_name,
    scanned_by,
    scanned_by_user_id,
    scan_date,
    deleted_at,
    deleted_by
  ) VALUES (
    OLD.id,
    OLD.patient_name,
    OLD.nhs_number,
    OLD.dob,
    COALESCE(OLD.images_count, 0),
    0,
    OLD.practice_ods,
    v_practice_name,
    COALESCE(v_scanned_by, OLD.uploader_name),
    OLD.user_id,
    OLD.created_at,
    now(),
    auth.uid()
  );
  
  RETURN OLD;
END;
$$;