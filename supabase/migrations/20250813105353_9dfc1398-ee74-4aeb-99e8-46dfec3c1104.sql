-- CRITICAL SECURITY FIX: Replace the overly permissive RLS policy for contractors table
-- The current SELECT policy "Users can view contractors for their practices" has qual="true"
-- which means ANYONE can read ALL contractor data - this is a severe security breach!

-- First, drop the dangerous policy that allows universal access
DROP POLICY IF EXISTS "Users can view contractors for their practices" ON public.contractors;

-- Create secure RLS policies for contractors table
-- Policy 1: System admins can view all contractors
CREATE POLICY "System admins can view all contractors" 
ON public.contractors 
FOR SELECT 
USING (is_system_admin(auth.uid()));

-- Policy 2: Practice managers can view contractors for their practices only
CREATE POLICY "Practice managers can view contractors for their practices" 
ON public.contractors 
FOR SELECT 
USING (
  has_role(auth.uid(), 'practice_manager'::app_role) 
  AND practice_id = ANY(get_user_practice_ids(auth.uid()))
);

-- Policy 3: Users can view contractors they created (for self-service scenarios)
CREATE POLICY "Users can view contractors they created" 
ON public.contractors 
FOR SELECT 
USING (auth.uid() = user_id);

-- Policy 4: PCN managers can view contractors in their managed practices
CREATE POLICY "PCN managers can view contractors in their practices" 
ON public.contractors 
FOR SELECT 
USING (
  has_role(auth.uid(), 'pcn_manager'::app_role) 
  AND practice_id = ANY(get_pcn_manager_practice_ids(auth.uid()))
);

-- Update the UPDATE policy to be more restrictive - only allow updates to contractors
-- by practice managers of the relevant practice or system admins
DROP POLICY IF EXISTS "Users can update contractors" ON public.contractors;

CREATE POLICY "Authorized users can update contractors" 
ON public.contractors 
FOR UPDATE 
USING (
  is_system_admin(auth.uid()) 
  OR (
    has_role(auth.uid(), 'practice_manager'::app_role) 
    AND practice_id = ANY(get_user_practice_ids(auth.uid()))
  )
  OR (
    has_role(auth.uid(), 'pcn_manager'::app_role) 
    AND practice_id = ANY(get_pcn_manager_practice_ids(auth.uid()))
  )
);

-- Update INSERT policy to ensure contractors can only be created for practices the user manages
DROP POLICY IF EXISTS "Users can create contractors" ON public.contractors;

CREATE POLICY "Authorized users can create contractors" 
ON public.contractors 
FOR INSERT 
WITH CHECK (
  auth.uid() = user_id 
  AND (
    is_system_admin(auth.uid())
    OR (
      has_role(auth.uid(), 'practice_manager'::app_role) 
      AND practice_id = ANY(get_user_practice_ids(auth.uid()))
    )
    OR (
      has_role(auth.uid(), 'pcn_manager'::app_role) 
      AND practice_id = ANY(get_pcn_manager_practice_ids(auth.uid()))
    )
  )
);

-- Update DELETE policy to be more restrictive
DROP POLICY IF EXISTS "Users can delete contractors they created" ON public.contractors;

CREATE POLICY "Authorized users can delete contractors" 
ON public.contractors 
FOR DELETE 
USING (
  is_system_admin(auth.uid())
  OR (
    auth.uid() = user_id 
    AND (
      has_role(auth.uid(), 'practice_manager'::app_role) 
      OR has_role(auth.uid(), 'pcn_manager'::app_role)
    )
  )
);

-- Log this critical security fix
INSERT INTO public.system_audit_log (
  table_name,
  operation,
  user_email,
  old_values,
  new_values
) VALUES (
  'contractors',
  'SECURITY_POLICY_UPDATE',
  'system@security-fix',
  jsonb_build_object(
    'issue', 'Critical: contractors table was publicly readable',
    'risk', 'Competitor data theft, contractor poaching, privacy breach'
  ),
  jsonb_build_object(
    'fix', 'Implemented role-based access control',
    'access', 'Limited to system admins, practice managers, and PCN managers only'
  )
);