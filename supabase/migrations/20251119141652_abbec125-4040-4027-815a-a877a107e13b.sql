-- Add CSO governance access control to user_roles table
ALTER TABLE user_roles 
ADD COLUMN IF NOT EXISTS cso_governance_access boolean DEFAULT false;

-- Add helpful comment for documentation
COMMENT ON COLUMN user_roles.cso_governance_access IS 
'Grants access to view CSO Report, DPIA, Hazard Log, DCB0129, and other sensitive clinical safety and governance documentation. Should only be granted to authorized personnel including Clinical Safety Officers, ICB IT staff, DPOs, and senior practice managers.';

-- Create helper function to check CSO governance access
CREATE OR REPLACE FUNCTION public.has_cso_governance_access(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND cso_governance_access = true
  ) OR EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'system_admin'
  );
$$;

COMMENT ON FUNCTION public.has_cso_governance_access IS 
'Checks if a user has access to CSO governance documentation. System admins automatically have access.';