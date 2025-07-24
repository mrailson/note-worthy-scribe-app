-- Update user_roles policies to include PCN manager permissions
DROP POLICY IF EXISTS "Practice and PCN managers can view roles in their practice" ON public.user_roles;
CREATE POLICY "Practice and PCN managers can view roles in their practice" 
ON public.user_roles 
FOR SELECT 
USING (
  is_system_admin() OR 
  (user_id = auth.uid()) OR 
  ((practice_id = get_practice_manager_practice_id()) AND (get_practice_manager_practice_id() IS NOT NULL)) OR
  (is_pcn_manager() AND practice_id = ANY(get_pcn_manager_practice_ids()))
);

DROP POLICY IF EXISTS "Practice and PCN managers can insert roles in their practice" ON public.user_roles;
CREATE POLICY "Practice and PCN managers can insert roles in their practice" 
ON public.user_roles 
FOR INSERT 
WITH CHECK (
  is_system_admin() OR 
  ((practice_id = get_practice_manager_practice_id()) AND (get_practice_manager_practice_id() IS NOT NULL) AND (role <> 'system_admin'::app_role)) OR
  (is_pcn_manager() AND practice_id = ANY(get_pcn_manager_practice_ids()) AND (role NOT IN ('system_admin'::app_role, 'pcn_manager'::app_role)))
);

DROP POLICY IF EXISTS "Practice and PCN managers can update roles in their practice" ON public.user_roles;
CREATE POLICY "Practice and PCN managers can update roles in their practice" 
ON public.user_roles 
FOR UPDATE 
USING (
  is_system_admin() OR 
  ((practice_id = get_practice_manager_practice_id()) AND (get_practice_manager_practice_id() IS NOT NULL) AND (role <> 'system_admin'::app_role)) OR
  (is_pcn_manager() AND practice_id = ANY(get_pcn_manager_practice_ids()) AND (role NOT IN ('system_admin'::app_role, 'pcn_manager'::app_role)))
);

DROP POLICY IF EXISTS "Practice and PCN managers can delete roles in their practice" ON public.user_roles;
CREATE POLICY "Practice and PCN managers can delete roles in their practice" 
ON public.user_roles 
FOR DELETE 
USING (
  is_system_admin() OR 
  ((practice_id = get_practice_manager_practice_id()) AND (get_practice_manager_practice_id() IS NOT NULL) AND (role <> 'system_admin'::app_role)) OR
  (is_pcn_manager() AND practice_id = ANY(get_pcn_manager_practice_ids()) AND (role NOT IN ('system_admin'::app_role, 'pcn_manager'::app_role)))
);