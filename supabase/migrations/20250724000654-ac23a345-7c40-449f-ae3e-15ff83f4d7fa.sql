-- Create function to get PCN manager practice IDs
CREATE OR REPLACE FUNCTION public.get_pcn_manager_practice_ids(_user_id UUID DEFAULT auth.uid())
RETURNS UUID[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
  SELECT ARRAY_AGG(practice_id)
  FROM public.pcn_manager_practices
  WHERE user_id = _user_id;
$$;

-- Create function to check if user is PCN manager for a practice
CREATE OR REPLACE FUNCTION public.is_pcn_manager_for_practice(_user_id UUID, _practice_id UUID)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.pcn_manager_practices
    WHERE user_id = _user_id
      AND practice_id = _practice_id
  );
$$;

-- Create function to check if user is PCN manager
CREATE OR REPLACE FUNCTION public.is_pcn_manager(_user_id UUID DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'pcn_manager'
  );
$$;