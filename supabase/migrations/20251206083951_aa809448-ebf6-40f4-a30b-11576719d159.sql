-- Drop the overly permissive policy that allows any authenticated user to view all staff members
DROP POLICY IF EXISTS "Staff members require authentication" ON public.staff_members;