-- Drop existing RLS policies and recreate them with proper system admin access
DROP POLICY IF EXISTS "Users can view complaints for their practice" ON public.complaints;
DROP POLICY IF EXISTS "Users can create complaints for their practice" ON public.complaints;
DROP POLICY IF EXISTS "Users can update complaints for their practice" ON public.complaints;

-- Create new RLS policies that properly handle system admins
CREATE POLICY "System admins and practice users can view complaints" 
ON public.complaints 
FOR SELECT 
USING (
  is_system_admin(auth.uid()) OR
  practice_id IN (
    SELECT practice_id 
    FROM public.user_roles 
    WHERE user_id = auth.uid() AND practice_id IS NOT NULL
  ) OR
  created_by = auth.uid()
);

CREATE POLICY "System admins and practice users can create complaints" 
ON public.complaints 
FOR INSERT 
WITH CHECK (
  is_system_admin(auth.uid()) OR
  practice_id IN (
    SELECT practice_id 
    FROM public.user_roles 
    WHERE user_id = auth.uid() AND practice_id IS NOT NULL
  ) OR
  created_by = auth.uid()
);

CREATE POLICY "System admins and practice users can update complaints" 
ON public.complaints 
FOR UPDATE 
USING (
  is_system_admin(auth.uid()) OR
  practice_id IN (
    SELECT practice_id 
    FROM public.user_roles 
    WHERE user_id = auth.uid() AND practice_id IS NOT NULL
  ) OR
  created_by = auth.uid()
);

CREATE POLICY "System admins can delete complaints" 
ON public.complaints 
FOR DELETE 
USING (is_system_admin(auth.uid()));