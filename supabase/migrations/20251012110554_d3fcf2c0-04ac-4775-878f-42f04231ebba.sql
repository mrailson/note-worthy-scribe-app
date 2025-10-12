-- Drop existing overly permissive policies on practice_fridges
DROP POLICY IF EXISTS "Enable read access for all users" ON public.practice_fridges;
DROP POLICY IF EXISTS "Public read access" ON public.practice_fridges;
DROP POLICY IF EXISTS "Anyone can view fridges" ON public.practice_fridges;

-- Create secure policies for practice_fridges table
-- Only allow authenticated users from the same practice to view fridge data
CREATE POLICY "Users can view fridges in their practice"
ON public.practice_fridges
FOR SELECT
TO authenticated
USING (practice_id = ANY (get_user_practice_ids(auth.uid())));

-- Allow practice managers and system admins to manage fridges
CREATE POLICY "Practice managers can manage fridges"
ON public.practice_fridges
FOR ALL
TO authenticated
USING (
  is_system_admin(auth.uid()) OR 
  (has_role(auth.uid(), 'practice_manager'::app_role) AND practice_id = ANY (get_user_practice_ids(auth.uid())))
)
WITH CHECK (
  is_system_admin(auth.uid()) OR 
  (has_role(auth.uid(), 'practice_manager'::app_role) AND practice_id = ANY (get_user_practice_ids(auth.uid())))
);