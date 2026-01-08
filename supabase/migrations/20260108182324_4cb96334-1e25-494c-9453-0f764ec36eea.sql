-- Allow practice managers to view service activations for users in their practice

CREATE POLICY "Practice managers can view service activations for their practice"
ON public.user_service_activations
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.user_roles manager_role
    JOIN public.user_roles target_role
      ON target_role.user_id = user_service_activations.user_id
    WHERE manager_role.user_id = auth.uid()
      AND manager_role.role = 'practice_manager'::public.app_role
      AND manager_role.practice_id IS NOT NULL
      AND target_role.practice_id = manager_role.practice_id
  )
);