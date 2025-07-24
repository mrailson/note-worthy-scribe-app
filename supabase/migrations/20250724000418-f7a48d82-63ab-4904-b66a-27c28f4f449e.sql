-- Add PCN Manager role to the enum
ALTER TYPE app_role ADD VALUE 'pcn_manager';

-- Create a table to track PCN manager practice assignments
CREATE TABLE public.pcn_manager_practices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  practice_id UUID NOT NULL REFERENCES gp_practices(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES auth.users(id),
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, practice_id)
);

-- Enable RLS on the new table
ALTER TABLE public.pcn_manager_practices ENABLE ROW LEVEL SECURITY;

-- RLS policies for pcn_manager_practices
CREATE POLICY "System admins can manage PCN practice assignments" 
ON public.pcn_manager_practices 
FOR ALL 
USING (is_system_admin());

CREATE POLICY "PCN managers can view their practice assignments" 
ON public.pcn_manager_practices 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Practice managers can view PCN assignments for their practice" 
ON public.pcn_manager_practices 
FOR SELECT 
USING (practice_id = get_practice_manager_practice_id());

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

-- Update user_roles policies to include PCN manager permissions
DROP POLICY IF EXISTS "Practice managers can view roles in their practice" ON public.user_roles;
CREATE POLICY "Practice and PCN managers can view roles in their practice" 
ON public.user_roles 
FOR SELECT 
USING (
  is_system_admin() OR 
  (user_id = auth.uid()) OR 
  ((practice_id = get_practice_manager_practice_id()) AND (get_practice_manager_practice_id() IS NOT NULL)) OR
  (is_pcn_manager() AND practice_id = ANY(get_pcn_manager_practice_ids()))
);

DROP POLICY IF EXISTS "Practice managers can insert roles in their practice" ON public.user_roles;
CREATE POLICY "Practice and PCN managers can insert roles in their practice" 
ON public.user_roles 
FOR INSERT 
WITH CHECK (
  is_system_admin() OR 
  ((practice_id = get_practice_manager_practice_id()) AND (get_practice_manager_practice_id() IS NOT NULL) AND (role <> 'system_admin'::app_role)) OR
  (is_pcn_manager() AND practice_id = ANY(get_pcn_manager_practice_ids()) AND (role NOT IN ('system_admin'::app_role, 'pcn_manager'::app_role)))
);

DROP POLICY IF EXISTS "Practice managers can update roles in their practice" ON public.user_roles;
CREATE POLICY "Practice and PCN managers can update roles in their practice" 
ON public.user_roles 
FOR UPDATE 
USING (
  is_system_admin() OR 
  ((practice_id = get_practice_manager_practice_id()) AND (get_practice_manager_practice_id() IS NOT NULL) AND (role <> 'system_admin'::app_role)) OR
  (is_pcn_manager() AND practice_id = ANY(get_pcn_manager_practice_ids()) AND (role NOT IN ('system_admin'::app_role, 'pcn_manager'::app_role)))
);

DROP POLICY IF EXISTS "Practice managers can delete roles in their practice" ON public.user_roles;
CREATE POLICY "Practice and PCN managers can delete roles in their practice" 
ON public.user_roles 
FOR DELETE 
USING (
  is_system_admin() OR 
  ((practice_id = get_practice_manager_practice_id()) AND (get_practice_manager_practice_id() IS NOT NULL) AND (role <> 'system_admin'::app_role)) OR
  (is_pcn_manager() AND practice_id = ANY(get_pcn_manager_practice_ids()) AND (role NOT IN ('system_admin'::app_role, 'pcn_manager'::app_role)))
);

-- Update profiles policies to allow PCN managers to view users in their practices
DROP POLICY IF EXISTS "Practice managers can view users in their practice" ON public.profiles;
CREATE POLICY "Practice and PCN managers can view users in their practice" 
ON public.profiles 
FOR SELECT 
USING (
  is_system_admin() OR 
  (auth.uid() = user_id) OR 
  (user_id IN (
    SELECT ur.user_id
    FROM user_roles ur
    WHERE ((ur.practice_id = get_practice_manager_practice_id()) AND (get_practice_manager_practice_id() IS NOT NULL))
       OR (is_pcn_manager() AND ur.practice_id = ANY(get_pcn_manager_practice_ids()))
  ))
);

DROP POLICY IF EXISTS "Practice managers can update users in their practice" ON public.profiles;
CREATE POLICY "Practice and PCN managers can update users in their practice" 
ON public.profiles 
FOR UPDATE 
USING (
  is_system_admin() OR 
  (auth.uid() = user_id) OR 
  (user_id IN (
    SELECT ur.user_id
    FROM user_roles ur
    WHERE ((ur.practice_id = get_practice_manager_practice_id()) AND (get_practice_manager_practice_id() IS NOT NULL))
       OR (is_pcn_manager() AND ur.practice_id = ANY(get_pcn_manager_practice_ids()))
  ))
);