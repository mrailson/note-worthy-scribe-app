-- Drop overly permissive policy on cso_training_progress
DROP POLICY IF EXISTS "Public can manage training progress" ON public.cso_training_progress;

-- Users can view their own training progress via their registration (matched by email)
CREATE POLICY "Users can view own training progress"
ON public.cso_training_progress
FOR SELECT
TO authenticated
USING (
  registration_id IN (
    SELECT cr.id FROM public.cso_registrations cr 
    WHERE cr.email = auth.email()
  )
);

-- Users can insert their own training progress
CREATE POLICY "Users can insert own training progress"
ON public.cso_training_progress
FOR INSERT
TO authenticated
WITH CHECK (
  registration_id IN (
    SELECT cr.id FROM public.cso_registrations cr 
    WHERE cr.email = auth.email()
  )
);

-- Users can update their own training progress
CREATE POLICY "Users can update own training progress"
ON public.cso_training_progress
FOR UPDATE
TO authenticated
USING (
  registration_id IN (
    SELECT cr.id FROM public.cso_registrations cr 
    WHERE cr.email = auth.email()
  )
);

-- System admins have full access
CREATE POLICY "System admins can manage all training progress"
ON public.cso_training_progress
FOR ALL
TO authenticated
USING (is_system_admin(auth.uid()))
WITH CHECK (is_system_admin(auth.uid()));