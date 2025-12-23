-- Allow system admins to view (select) service activations for any user
-- This fixes the admin UI showing NRES as disabled when it is already enabled, which then causes duplicate insert attempts.

CREATE POLICY "Only admins can view all service activations"
ON public.user_service_activations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'system_admin'::app_role
  )
);