-- Drop existing function and recreate with fridge_monitoring_access
DROP FUNCTION public.get_practice_users(uuid);

CREATE OR REPLACE FUNCTION public.get_practice_users(p_practice_id uuid)
 RETURNS TABLE(user_id uuid, email text, full_name text, last_login timestamp with time zone, role app_role, assigned_at timestamp with time zone, meeting_notes_access boolean, gp_scribe_access boolean, complaints_manager_access boolean, ai4gp_access boolean, enhanced_access boolean, cqc_compliance_access boolean, shared_drive_access boolean, mic_test_service_access boolean, api_testing_service_access boolean, fridge_monitoring_access boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT 
    p.user_id,
    p.email,
    p.full_name,
    p.last_login,
    ur.role,
    ur.assigned_at,
    COALESCE(ur.meeting_notes_access, false) as meeting_notes_access,
    COALESCE(ur.gp_scribe_access, false) as gp_scribe_access,
    COALESCE(ur.complaints_manager_access, false) as complaints_manager_access,
    COALESCE(p.ai4gp_access, false) as ai4gp_access,
    COALESCE(ur.enhanced_access, false) as enhanced_access,
    COALESCE(ur.cqc_compliance_access, false) as cqc_compliance_access,
    COALESCE(ur.shared_drive_access, false) as shared_drive_access,
    COALESCE(ur.mic_test_service_access, false) as mic_test_service_access,
    COALESCE(ur.api_testing_service_access, false) as api_testing_service_access,
    COALESCE(ur.fridge_monitoring_access, false) as fridge_monitoring_access
  FROM public.profiles p
  INNER JOIN public.user_roles ur ON p.user_id = ur.user_id
  WHERE ur.practice_id = p_practice_id
  ORDER BY p.full_name;
$function$;