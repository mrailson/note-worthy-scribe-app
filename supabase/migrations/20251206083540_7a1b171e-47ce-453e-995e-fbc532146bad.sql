-- Drop all overly permissive policies on cso_assessments
DROP POLICY IF EXISTS "Allow insert for assessment submission" ON public.cso_assessments;
DROP POLICY IF EXISTS "Assessment owners can view their own assessments" ON public.cso_assessments;
DROP POLICY IF EXISTS "Public can insert assessments" ON public.cso_assessments;
DROP POLICY IF EXISTS "Public can view assessments" ON public.cso_assessments;
DROP POLICY IF EXISTS "System admins can manage all assessments" ON public.cso_assessments;
DROP POLICY IF EXISTS "System admins can manage assessments" ON public.cso_assessments;
DROP POLICY IF EXISTS "System admins can view all assessments" ON public.cso_assessments;
DROP POLICY IF EXISTS "Users can insert their own assessments" ON public.cso_assessments;
DROP POLICY IF EXISTS "Users can view their own assessments" ON public.cso_assessments;

-- Users can only view their own assessments (matched via email through registration)
CREATE POLICY "Users can view own assessments"
ON public.cso_assessments
FOR SELECT
TO authenticated
USING (
  registration_id IN (
    SELECT cr.id FROM public.cso_registrations cr 
    WHERE cr.email = auth.email()
  )
);

-- Users can insert their own assessments
CREATE POLICY "Users can insert own assessments"
ON public.cso_assessments
FOR INSERT
TO authenticated
WITH CHECK (
  registration_id IN (
    SELECT cr.id FROM public.cso_registrations cr 
    WHERE cr.email = auth.email()
  )
);

-- Users can update their own assessments
CREATE POLICY "Users can update own assessments"
ON public.cso_assessments
FOR UPDATE
TO authenticated
USING (
  registration_id IN (
    SELECT cr.id FROM public.cso_registrations cr 
    WHERE cr.email = auth.email()
  )
);

-- System admins have full access
CREATE POLICY "System admins can manage all assessments"
ON public.cso_assessments
FOR ALL
TO authenticated
USING (is_system_admin(auth.uid()))
WITH CHECK (is_system_admin(auth.uid()));