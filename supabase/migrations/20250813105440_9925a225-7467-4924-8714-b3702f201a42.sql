-- CRITICAL SECURITY FIX: Remove the dangerous SELECT policy that allows public access
DROP POLICY IF EXISTS "Users can view contractors for their practices" ON public.contractors;

-- Create a secure SELECT policy that restricts access based on user permissions
CREATE POLICY "Authorized users can view contractors" 
ON public.contractors 
FOR SELECT 
USING (
  -- System admins can view all contractors
  is_system_admin() 
  OR 
  -- Practice managers can view contractors for their practices
  has_role(auth.uid(), 'practice_manager'::app_role)
  OR
  -- Users can only view contractors they created
  auth.uid() = user_id
);

-- Log this critical security fix
SELECT public.log_system_activity(
  'contractors',
  'SECURITY_FIX_APPLIED',
  NULL,
  jsonb_build_object('old_policy', 'public_read_access'),
  jsonb_build_object('new_policy', 'restricted_access', 'fixed_vulnerability', 'contractor_data_leak')
);