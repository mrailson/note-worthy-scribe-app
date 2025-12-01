-- Enable Row Level Security on cso_assessments table
ALTER TABLE public.cso_assessments ENABLE ROW LEVEL SECURITY;

-- Drop any existing public access policies
DROP POLICY IF EXISTS "Enable read access for all users" ON public.cso_assessments;
DROP POLICY IF EXISTS "Public users can view assessments" ON public.cso_assessments;
DROP POLICY IF EXISTS "Anyone can view assessments" ON public.cso_assessments;

-- Policy: Users can view their own assessments (matched via registration email)
CREATE POLICY "Users can view their own assessments"
ON public.cso_assessments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cso_registrations
    WHERE cso_registrations.id = cso_assessments.registration_id
    AND cso_registrations.email = auth.email()
  )
);

-- Policy: Users can insert their own assessment results
CREATE POLICY "Users can insert their own assessments"
ON public.cso_assessments
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.cso_registrations
    WHERE cso_registrations.id = cso_assessments.registration_id
    AND cso_registrations.email = auth.email()
  )
);

-- Policy: System admins can view all assessments
CREATE POLICY "System admins can view all assessments"
ON public.cso_assessments
FOR SELECT
TO authenticated
USING (is_system_admin(auth.uid()));

-- Policy: System admins can manage all assessments
CREATE POLICY "System admins can manage all assessments"
ON public.cso_assessments
FOR ALL
TO authenticated
USING (is_system_admin(auth.uid()))
WITH CHECK (is_system_admin(auth.uid()));

-- Note: No access for anonymous users - assessment data is sensitive and requires authentication