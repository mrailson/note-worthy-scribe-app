-- Update profiles policies to allow PCN managers to view users in their practices
DROP POLICY IF EXISTS "Practice and PCN managers can view users in their practice" ON public.profiles;
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

DROP POLICY IF EXISTS "Practice and PCN managers can update users in their practice" ON public.profiles;
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