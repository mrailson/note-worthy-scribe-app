-- Create helper function for practice managers to get assignable roles
CREATE OR REPLACE FUNCTION public.get_practice_manager_assignable_roles()
RETURNS app_role[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
  SELECT ARRAY['user']::app_role[];
$$;

-- Create function to check if user exists and their practice assignments
CREATE OR REPLACE FUNCTION public.check_user_practice_assignment(p_email text, p_practice_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  user_exists BOOLEAN := false;
  user_id_found UUID;
  practice_assigned BOOLEAN := false;
  other_practices jsonb := '[]'::jsonb;
BEGIN
  -- Check if user exists
  SELECT EXISTS (
    SELECT 1 FROM auth.users WHERE email = p_email
  ) INTO user_exists;
  
  IF NOT user_exists THEN
    RETURN jsonb_build_object('exists', false);
  END IF;
  
  -- Get user ID
  SELECT id INTO user_id_found FROM auth.users WHERE email = p_email;
  
  -- Check if already assigned to this practice
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = user_id_found AND practice_id = p_practice_id
  ) INTO practice_assigned;
  
  -- Get other practice assignments
  SELECT jsonb_agg(
    jsonb_build_object(
      'practice_name', COALESCE(pd.practice_name, gp.name),
      'role', ur.role
    )
  ) INTO other_practices
  FROM public.user_roles ur
  LEFT JOIN public.practice_details pd ON ur.practice_id = pd.id
  LEFT JOIN public.gp_practices gp ON ur.practice_id = gp.id
  WHERE ur.user_id = user_id_found AND ur.practice_id != p_practice_id;
  
  RETURN jsonb_build_object(
    'exists', true,
    'user_id', user_id_found,
    'already_assigned_to_practice', practice_assigned,
    'other_practices', COALESCE(other_practices, '[]'::jsonb)
  );
END;
$$;

-- Create function to get users for a specific practice
CREATE OR REPLACE FUNCTION public.get_practice_users(p_practice_id uuid)
RETURNS TABLE(
  user_id uuid,
  email text,
  full_name text,
  last_login timestamp with time zone,
  role app_role,
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
    ur.assigned_at,
    COALESCE(ur.meeting_notes_access, false) as meeting_notes_access,
    COALESCE(ur.gp_scribe_access, false) as gp_scribe_access,
    COALESCE(ur.complaints_manager_access, false) as complaints_manager_access,
    COALESCE(p.ai4gp_access, false) as ai4gp_access,
    COALESCE(ur.enhanced_access, false) as enhanced_access,
    COALESCE(ur.cqc_compliance_access, false) as cqc_compliance_access,
    COALESCE(ur.shared_drive_access, false) as shared_drive_access,
    COALESCE(ur.mic_test_service_access, false) as mic_test_service_access,
    COALESCE(ur.api_testing_service_access, false) as api_testing_service_access
  FROM public.profiles p
  INNER JOIN public.user_roles ur ON p.user_id = ur.user_id
  WHERE ur.practice_id = p_practice_id
  ORDER BY p.full_name;
$$;