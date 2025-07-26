-- Create a function to assign user to practice with role
CREATE OR REPLACE FUNCTION public.assign_user_to_practice(
  p_user_id uuid,
  p_practice_id uuid,
  p_role app_role,
  p_assigned_by uuid DEFAULT auth.uid()
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  role_id UUID;
BEGIN
  -- Check if assignment already exists
  SELECT id INTO role_id
  FROM public.user_roles
  WHERE user_id = p_user_id 
    AND practice_id = p_practice_id 
    AND role = p_role;

  -- If not exists, create new assignment
  IF role_id IS NULL THEN
    INSERT INTO public.user_roles (user_id, practice_id, role, assigned_by)
    VALUES (p_user_id, p_practice_id, p_role, p_assigned_by)
    RETURNING id INTO role_id;
    
    -- Log the assignment
    PERFORM public.log_system_activity(
      'user_roles',
      'PRACTICE_ASSIGNMENT',
      p_user_id,
      NULL,
      jsonb_build_object(
        'practice_id', p_practice_id,
        'role', p_role,
        'assigned_by', p_assigned_by
      )
    );
  END IF;

  RETURN role_id;
END;
$$;

-- Create a function to remove user from practice
CREATE OR REPLACE FUNCTION public.remove_user_from_practice(
  p_user_id uuid,
  p_practice_id uuid,
  p_role app_role DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
BEGIN
  -- If role specified, remove specific role assignment
  IF p_role IS NOT NULL THEN
    DELETE FROM public.user_roles
    WHERE user_id = p_user_id 
      AND practice_id = p_practice_id 
      AND role = p_role;
  ELSE
    -- Remove all role assignments for this practice
    DELETE FROM public.user_roles
    WHERE user_id = p_user_id 
      AND practice_id = p_practice_id;
  END IF;

  -- Log the removal
  PERFORM public.log_system_activity(
    'user_roles',
    'PRACTICE_ASSIGNMENT_REMOVED',
    p_user_id,
    jsonb_build_object(
      'practice_id', p_practice_id,
      'role', p_role,
      'removed_by', auth.uid()
    ),
    NULL
  );

  RETURN FOUND;
END;
$$;

-- Create a function to get user practice assignments
CREATE OR REPLACE FUNCTION public.get_user_practice_assignments(p_user_id uuid)
RETURNS TABLE(
  practice_id uuid,
  practice_name text,
  role app_role,
  assigned_at timestamp with time zone,
  assigned_by uuid
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
  SELECT 
    ur.practice_id,
    COALESCE(pd.practice_name, gp.name) as practice_name,
    ur.role,
    ur.assigned_at,
    ur.assigned_by
  FROM public.user_roles ur
  LEFT JOIN public.practice_details pd ON ur.practice_id = pd.id
  LEFT JOIN public.gp_practices gp ON ur.practice_id = gp.id
  WHERE ur.user_id = p_user_id
  ORDER BY ur.assigned_at DESC;
$$;

-- Create a function to get all users with their practice assignments
CREATE OR REPLACE FUNCTION public.get_users_with_practices()
RETURNS TABLE(
  user_id uuid,
  email text,
  full_name text,
  last_login timestamp with time zone,
  practice_assignments jsonb
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
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'practice_id', ur.practice_id,
          'practice_name', COALESCE(pd.practice_name, gp.name),
          'role', ur.role,
          'assigned_at', ur.assigned_at
        )
      ) FILTER (WHERE ur.practice_id IS NOT NULL),
      '[]'::jsonb
    ) as practice_assignments
  FROM public.profiles p
  LEFT JOIN public.user_roles ur ON p.user_id = ur.user_id
  LEFT JOIN public.practice_details pd ON ur.practice_id = pd.id
  LEFT JOIN public.gp_practices gp ON ur.practice_id = gp.id
  GROUP BY p.user_id, p.email, p.full_name, p.last_login
  ORDER BY p.full_name;
$$;

-- Enhanced function to get user's practice IDs (for multiple practices)
CREATE OR REPLACE FUNCTION public.get_user_practice_ids(p_user_id uuid DEFAULT auth.uid())
RETURNS uuid[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
  SELECT ARRAY_AGG(DISTINCT practice_id)
  FROM public.user_roles
  WHERE user_id = p_user_id
    AND practice_id IS NOT NULL;
$$;