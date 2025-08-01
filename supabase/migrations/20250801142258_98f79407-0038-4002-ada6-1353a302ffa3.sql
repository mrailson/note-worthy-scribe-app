-- Update RLS policies on staff_members to allow PCN managers
-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can insert staff members" ON public.staff_members;
DROP POLICY IF EXISTS "Authenticated users can manage staff members" ON public.staff_members;
DROP POLICY IF EXISTS "Authenticated users can view staff members" ON public.staff_members;

-- Create new policies that allow PCN managers, practice managers, and system admins
CREATE POLICY "PCN and practice managers can insert staff members" 
ON public.staff_members 
FOR INSERT 
WITH CHECK (
  auth.uid() IS NOT NULL AND (
    is_system_admin() OR 
    has_role(auth.uid(), 'practice_manager'::app_role) OR 
    has_role(auth.uid(), 'pcn_manager'::app_role)
  )
);

CREATE POLICY "PCN and practice managers can update staff members" 
ON public.staff_members 
FOR UPDATE 
USING (
  auth.uid() IS NOT NULL AND (
    is_system_admin() OR 
    has_role(auth.uid(), 'practice_manager'::app_role) OR 
    has_role(auth.uid(), 'pcn_manager'::app_role)
  )
);

CREATE POLICY "PCN and practice managers can delete staff members" 
ON public.staff_members 
FOR DELETE 
USING (
  auth.uid() IS NOT NULL AND (
    is_system_admin() OR 
    has_role(auth.uid(), 'practice_manager'::app_role) OR 
    has_role(auth.uid(), 'pcn_manager'::app_role)
  )
);

CREATE POLICY "Authenticated users can view staff members" 
ON public.staff_members 
FOR SELECT 
USING (auth.uid() IS NOT NULL);