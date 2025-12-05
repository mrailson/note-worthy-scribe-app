-- Create archive table for deleted LG Capture records (for billing purposes)
CREATE TABLE public.lg_patients_archive (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_patient_id TEXT NOT NULL,
  patient_name TEXT,
  nhs_number TEXT,
  patient_dob TEXT,
  pages_scanned INTEGER NOT NULL DEFAULT 0,
  pages_blank INTEGER DEFAULT 0,
  billable_pages INTEGER GENERATED ALWAYS AS (GREATEST(pages_scanned - COALESCE(pages_blank, 0), 0)) STORED,
  practice_ods TEXT,
  practice_name TEXT,
  scanned_by TEXT,
  scanned_by_user_id UUID,
  scan_date TIMESTAMP WITH TIME ZONE,
  deleted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.lg_patients_archive ENABLE ROW LEVEL SECURITY;

-- Only system admins can view archive
CREATE POLICY "System admins can view lg_patients_archive"
ON public.lg_patients_archive
FOR SELECT
USING (public.is_system_admin(auth.uid()));

-- Create function to archive patient before deletion
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
  
  -- Get practice name from gp_practices
  SELECT name INTO v_practice_name
  FROM public.gp_practices
  WHERE ods_code = OLD.practice_ods;
  
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
    OLD.patient_dob,
    COALESCE(OLD.images_count, 0),
    COALESCE(OLD.blank_pages_removed, 0),
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

-- Create trigger to archive before delete
CREATE TRIGGER archive_lg_patient_before_delete_trigger
BEFORE DELETE ON public.lg_patients
FOR EACH ROW
EXECUTE FUNCTION public.archive_lg_patient_before_delete();

-- Add index for efficient querying
CREATE INDEX idx_lg_patients_archive_practice_ods ON public.lg_patients_archive(practice_ods);
CREATE INDEX idx_lg_patients_archive_scan_date ON public.lg_patients_archive(scan_date);
CREATE INDEX idx_lg_patients_archive_deleted_at ON public.lg_patients_archive(deleted_at);