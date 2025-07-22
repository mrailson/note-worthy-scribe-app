-- Create function to check if user is practice manager for a specific practice
CREATE OR REPLACE FUNCTION public.is_practice_manager_for_practice(_user_id uuid, _practice_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'practice_manager'
      AND practice_id = _practice_id
  )
$$;

-- Create function to get user's practice if they are a practice manager
CREATE OR REPLACE FUNCTION public.get_practice_manager_practice_id(_user_id uuid DEFAULT auth.uid())
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
  SELECT practice_id
  FROM public.user_roles
  WHERE user_id = _user_id
    AND role = 'practice_manager'
  LIMIT 1
$$;

-- Update profiles RLS policies to allow practice managers to view/update users in their practice
CREATE POLICY "Practice managers can view users in their practice" 
ON public.profiles 
FOR SELECT 
USING (
  is_system_admin() OR 
  (auth.uid() = user_id) OR
  (user_id IN (
    SELECT ur.user_id 
    FROM public.user_roles ur 
    WHERE ur.practice_id = get_practice_manager_practice_id()
    AND get_practice_manager_practice_id() IS NOT NULL
  ))
);

CREATE POLICY "Practice managers can update users in their practice" 
ON public.profiles 
FOR UPDATE 
USING (
  is_system_admin() OR 
  (auth.uid() = user_id) OR
  (user_id IN (
    SELECT ur.user_id 
    FROM public.user_roles ur 
    WHERE ur.practice_id = get_practice_manager_practice_id()
    AND get_practice_manager_practice_id() IS NOT NULL
  ))
);

-- Update user_roles RLS policies to allow practice managers to manage roles in their practice
CREATE POLICY "Practice managers can view roles in their practice"
ON public.user_roles
FOR SELECT
USING (
  is_system_admin() OR
  (user_id = auth.uid()) OR
  (practice_id = get_practice_manager_practice_id() AND get_practice_manager_practice_id() IS NOT NULL)
);

CREATE POLICY "Practice managers can insert roles in their practice"
ON public.user_roles
FOR INSERT
WITH CHECK (
  is_system_admin() OR
  (practice_id = get_practice_manager_practice_id() AND get_practice_manager_practice_id() IS NOT NULL AND role != 'system_admin')
);

CREATE POLICY "Practice managers can update roles in their practice"
ON public.user_roles
FOR UPDATE
USING (
  is_system_admin() OR
  (practice_id = get_practice_manager_practice_id() AND get_practice_manager_practice_id() IS NOT NULL AND role != 'system_admin')
);

CREATE POLICY "Practice managers can delete roles in their practice"
ON public.user_roles
FOR DELETE
USING (
  is_system_admin() OR
  (practice_id = get_practice_manager_practice_id() AND get_practice_manager_practice_id() IS NOT NULL AND role != 'system_admin')
);