-- Create the get_practice_users function if it doesn't exist
CREATE OR REPLACE FUNCTION public.get_practice_users(p_practice_id uuid)
RETURNS TABLE(
  user_id uuid,
  email text,
  full_name text,
  role app_role,
  practice_role text,
  assigned_at timestamp with time zone,
  last_login timestamp with time zone,
  meeting_notes_access boolean,
  gp_scribe_access boolean,
  complaints_manager_access boolean,
  ai4gp_access boolean,
  enhanced_access boolean,
  cqc_compliance_access boolean,
  shared_drive_access boolean,
  mic_test_service_access boolean,
  api_testing_service_access boolean
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
  SELECT 
    p.user_id,
    p.email,
    p.full_name,
    ur.role,
    ur.practice_role,
    ur.assigned_at,
    p.last_login,
    ur.meeting_notes_access,
    ur.gp_scribe_access,
    ur.complaints_manager_access,
    p.ai4gp_access,
    ur.enhanced_access,
    ur.cqc_compliance_access,
    ur.shared_drive_access,
    ur.mic_test_service_access,
    ur.api_testing_service_access
  FROM public.profiles p
  JOIN public.user_roles ur ON p.user_id = ur.user_id
  WHERE ur.practice_id = p_practice_id
  ORDER BY p.full_name;
$$;