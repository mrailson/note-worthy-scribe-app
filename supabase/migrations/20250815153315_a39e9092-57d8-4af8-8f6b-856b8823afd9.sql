-- Update the get_practice_users function to include practice_role
DROP FUNCTION IF EXISTS get_practice_users(uuid);

CREATE OR REPLACE FUNCTION get_practice_users(p_practice_id uuid)
RETURNS TABLE(
  user_id uuid,
  email text,
  full_name text,
  last_login timestamp with time zone,
  role app_role,
  practice_role practice_role,
  assigned_at timestamp with time zone,
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
    p.last_login,
    ur.role,
    ur.practice_role,
    ur.assigned_at,
    COALESCE(um1.enabled, false) as meeting_notes_access,
    COALESCE(um2.enabled, false) as gp_scribe_access,
    COALESCE(um3.enabled, false) as complaints_manager_access,
    COALESCE(um4.enabled, false) as ai4gp_access,
    COALESCE(um5.enabled, false) as enhanced_access,
    COALESCE(um6.enabled, false) as cqc_compliance_access,
    COALESCE(um7.enabled, false) as shared_drive_access,
    COALESCE(um8.enabled, false) as mic_test_service_access,
    COALESCE(um9.enabled, false) as api_testing_service_access
  FROM public.profiles p
  JOIN public.user_roles ur ON p.user_id = ur.user_id
  LEFT JOIN public.user_modules um1 ON p.user_id = um1.user_id AND um1.module = 'meeting_notes'
  LEFT JOIN public.user_modules um2 ON p.user_id = um2.user_id AND um2.module = 'gp_scribe'
  LEFT JOIN public.user_modules um3 ON p.user_id = um3.user_id AND um3.module = 'complaints_manager'
  LEFT JOIN public.user_modules um4 ON p.user_id = um4.user_id AND um4.module = 'ai4gp'
  LEFT JOIN public.user_modules um5 ON p.user_id = um5.user_id AND um5.module = 'enhanced_access'
  LEFT JOIN public.user_modules um6 ON p.user_id = um6.user_id AND um6.module = 'cqc_compliance'
  LEFT JOIN public.user_modules um7 ON p.user_id = um7.user_id AND um7.module = 'shared_drive'
  LEFT JOIN public.user_modules um8 ON p.user_id = um8.user_id AND um8.module = 'mic_test_service'
  LEFT JOIN public.user_modules um9 ON p.user_id = um9.user_id AND um9.module = 'api_testing_service'
  WHERE ur.practice_id = p_practice_id
  ORDER BY p.full_name;
$$;