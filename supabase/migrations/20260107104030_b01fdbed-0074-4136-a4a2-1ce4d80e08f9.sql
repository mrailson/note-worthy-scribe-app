-- Create RLS policy for admin users to view all NRES hours entries
CREATE POLICY "Admin users can view all hours entries"
ON public.nres_hours_entries
FOR SELECT
USING (
  -- Own entries
  auth.uid() = user_id
  OR
  -- System admins (using existing function)
  public.is_system_admin(auth.uid())
  OR
  -- Specific authorised users (Mark Gray and Maureen Green)
  auth.uid() IN (
    '31a9cb05-1a66-4c81-811b-8861874c7f5b',
    '7ed97e1c-4f3c-435d-b753-17424c5aab00'
  )
);

-- Also allow admins to view all user settings for hourly rates
CREATE POLICY "Admin users can view all user settings"
ON public.nres_user_settings
FOR SELECT
USING (
  -- Own settings
  auth.uid() = user_id
  OR
  -- System admins
  public.is_system_admin(auth.uid())
  OR
  -- Specific authorised users
  auth.uid() IN (
    '31a9cb05-1a66-4c81-811b-8861874c7f5b',
    '7ed97e1c-4f3c-435d-b753-17424c5aab00'
  )
);