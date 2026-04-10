CREATE OR REPLACE FUNCTION public.get_users_with_practices()
RETURNS TABLE(
  user_id uuid,
  email text,
  full_name text,
  last_login timestamptz,
  practice_assignments jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.user_id,
    p.email,
    p.full_name,
    COALESCE(us.last_activity, p.last_login) as last_login,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'practice_id', ur.practice_id,
          'practice_name', COALESCE(gp.name, pd.practice_name),
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
  LEFT JOIN (
    SELECT user_id, MAX(last_activity) as last_activity
    FROM public.user_sessions
    GROUP BY user_id
  ) us ON p.user_id = us.user_id
  GROUP BY p.user_id, p.email, p.full_name, p.last_login, us.last_activity
  ORDER BY p.full_name;
$$;