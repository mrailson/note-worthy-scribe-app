-- Drop the overly permissive policy that allows all practice users to see all profiles
DROP POLICY IF EXISTS "profiles_select_practice" ON public.profiles;

-- Create a new policy that only allows practice managers to view profiles within their practice
-- Regular users can only see their own profile (covered by profiles_select_own)
-- Practice managers need to see profiles to manage their team
CREATE POLICY "profiles_select_practice_managers" 
ON public.profiles 
FOR SELECT 
USING (
  -- User can view profiles of users in their practice IF they are a practice manager
  (
    user_id IN (
      SELECT ur.user_id
      FROM user_roles ur
      WHERE ur.practice_id = ANY (get_user_practice_ids(auth.uid()))
    )
    AND has_role(auth.uid(), 'practice_manager'::app_role)
  )
);