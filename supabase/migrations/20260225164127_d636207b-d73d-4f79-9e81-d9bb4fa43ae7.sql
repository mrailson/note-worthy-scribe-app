
-- Create a helper function to check if user is an NRES admin by email
CREATE OR REPLACE FUNCTION public.is_nres_admin(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE id = user_id
      AND email IN (
        'm.green28@nhs.net',
        'mark.gray1@nhs.net',
        'amanda.taylor75@nhs.net',
        'carolyn.abbisogni@nhs.net'
      )
  )
$$;

-- Fix nres_estates_config policies
DROP POLICY IF EXISTS "System admins can insert estates config" ON nres_estates_config;
DROP POLICY IF EXISTS "System admins can update estates config" ON nres_estates_config;

CREATE POLICY "NRES admins can insert estates config"
  ON nres_estates_config FOR INSERT TO authenticated
  WITH CHECK (is_system_admin(auth.uid()) OR is_nres_admin(auth.uid()));

CREATE POLICY "NRES admins can update estates config"
  ON nres_estates_config FOR UPDATE TO authenticated
  USING (is_system_admin(auth.uid()) OR is_nres_admin(auth.uid()));

-- Also fix nres_recruitment_config - replace the overly broad policy with proper ones
DROP POLICY IF EXISTS "Authenticated users can manage recruitment config" ON nres_recruitment_config;

CREATE POLICY "NRES admins can insert recruitment config"
  ON nres_recruitment_config FOR INSERT TO authenticated
  WITH CHECK (is_system_admin(auth.uid()) OR is_nres_admin(auth.uid()));

CREATE POLICY "NRES admins can update recruitment config"
  ON nres_recruitment_config FOR UPDATE TO authenticated
  USING (is_system_admin(auth.uid()) OR is_nres_admin(auth.uid()));

CREATE POLICY "NRES admins can delete recruitment config"
  ON nres_recruitment_config FOR DELETE TO authenticated
  USING (is_system_admin(auth.uid()) OR is_nres_admin(auth.uid()));
