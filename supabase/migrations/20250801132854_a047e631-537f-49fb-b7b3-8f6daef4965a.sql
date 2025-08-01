-- Check current RLS policies for staff_members
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'staff_members';

-- Update RLS policy to allow authenticated users to manage staff members
DROP POLICY IF EXISTS "Practice managers can manage staff members" ON public.staff_members;

-- Create more permissive policy for managing staff members
CREATE POLICY "Authenticated users can manage staff members" 
ON public.staff_members FOR ALL 
USING (auth.uid() IS NOT NULL);

-- Also ensure users can insert staff members
CREATE POLICY "Authenticated users can insert staff members" 
ON public.staff_members FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);