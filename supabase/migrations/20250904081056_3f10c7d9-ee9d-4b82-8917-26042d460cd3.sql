-- Create a table for default staff contact information per practice
CREATE TABLE public.practice_staff_defaults (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  practice_id uuid REFERENCES public.practice_details(id) ON DELETE CASCADE,
  staff_role text NOT NULL,
  staff_name text NOT NULL,
  default_email text NOT NULL,
  default_phone text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(practice_id, staff_role, staff_name)
);

-- Enable RLS
ALTER TABLE public.practice_staff_defaults ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view staff defaults for their practices" 
ON public.practice_staff_defaults 
FOR SELECT 
USING (practice_id = ANY (get_user_practice_ids(auth.uid())));

CREATE POLICY "Practice managers can manage staff defaults" 
ON public.practice_staff_defaults 
FOR ALL 
USING (
  (practice_id = ANY (get_user_practice_ids(auth.uid()))) 
  AND (
    has_role(auth.uid(), 'practice_manager'::app_role) 
    OR has_role(auth.uid(), 'system_admin'::app_role)
    OR has_role(auth.uid(), 'complaints_manager'::app_role)
  )
)
WITH CHECK (
  (practice_id = ANY (get_user_practice_ids(auth.uid()))) 
  AND (
    has_role(auth.uid(), 'practice_manager'::app_role) 
    OR has_role(auth.uid(), 'system_admin'::app_role)
    OR has_role(auth.uid(), 'complaints_manager'::app_role)
  )
);

-- Add trigger for updated_at
CREATE TRIGGER update_practice_staff_defaults_updated_at
  BEFORE UPDATE ON public.practice_staff_defaults
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default staff contacts for Oak Lane Medical Practice
-- First, get the practice_id for Oak Lane Medical Practice
INSERT INTO public.practice_staff_defaults (
  practice_id, 
  staff_role, 
  staff_name, 
  default_email, 
  default_phone
)
SELECT 
  pd.id as practice_id,
  'Receptionist' as staff_role,
  'Receptionist' as staff_name,
  'malcolm.railson@nhs.net' as default_email,
  '01604 5050656' as default_phone
FROM public.practice_details pd 
WHERE pd.practice_name = 'Oak Lane Medical Practice'
UNION ALL
SELECT 
  pd.id as practice_id,
  'Practice Manager' as staff_role,
  'Practice Manager' as staff_name,
  'malcolm.railson@nhs.net' as default_email,
  '01604 5050656' as default_phone
FROM public.practice_details pd 
WHERE pd.practice_name = 'Oak Lane Medical Practice'
UNION ALL
SELECT 
  pd.id as practice_id,
  'Practice Nurse' as staff_role,
  'Practice Nurse' as staff_name,
  'malcolm.railson@nhs.net' as default_email,
  '01604 5050656' as default_phone
FROM public.practice_details pd 
WHERE pd.practice_name = 'Oak Lane Medical Practice'
UNION ALL
SELECT 
  pd.id as practice_id,
  'Administrative Staff' as staff_role,
  'Administrative Staff' as staff_name,
  'malcolm.railson@nhs.net' as default_email,
  '01604 5050656' as default_phone
FROM public.practice_details pd 
WHERE pd.practice_name = 'Oak Lane Medical Practice'
UNION ALL
SELECT 
  pd.id as practice_id,
  'Healthcare Assistant' as staff_role,
  'Healthcare Assistant' as staff_name,
  'malcolm.railson@nhs.net' as default_email,
  '01604 5050656' as default_phone
FROM public.practice_details pd 
WHERE pd.practice_name = 'Oak Lane Medical Practice';

-- Create a function to get default staff contact for a practice and role
CREATE OR REPLACE FUNCTION public.get_default_staff_contact(
  p_practice_id uuid,
  p_staff_role text,
  p_staff_name text DEFAULT NULL
)
RETURNS TABLE(
  staff_name text,
  default_email text,
  default_phone text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT 
    psd.staff_name,
    psd.default_email,
    psd.default_phone
  FROM public.practice_staff_defaults psd
  WHERE psd.practice_id = p_practice_id
    AND psd.staff_role = p_staff_role
    AND (p_staff_name IS NULL OR psd.staff_name = p_staff_name)
    AND psd.is_active = true
  ORDER BY psd.created_at DESC
  LIMIT 1;
$$;