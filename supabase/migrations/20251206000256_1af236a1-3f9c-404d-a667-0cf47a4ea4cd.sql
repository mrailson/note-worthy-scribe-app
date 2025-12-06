-- Enable RLS on cso_assessments table
ALTER TABLE public.cso_assessments ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies
DROP POLICY IF EXISTS "Assessment owners can view their own assessments" ON public.cso_assessments;
DROP POLICY IF EXISTS "System admins can view all assessments" ON public.cso_assessments;
DROP POLICY IF EXISTS "Allow insert for assessment submission" ON public.cso_assessments;

-- Create policy for assessment owners to view their own assessments
-- Links through registration_id to cso_registrations (matched by email to auth.users)
CREATE POLICY "Assessment owners can view their own assessments"
ON public.cso_assessments
FOR SELECT
USING (
  registration_id IN (
    SELECT cr.id FROM public.cso_registrations cr
    WHERE cr.email = auth.email()
  )
);

-- Create policy for system admins to view all assessments
CREATE POLICY "System admins can view all assessments"
ON public.cso_assessments
FOR SELECT
USING (public.is_system_admin(auth.uid()));

-- Create policy for authenticated users to insert assessments (needed for assessment submission)
CREATE POLICY "Allow insert for assessment submission"
ON public.cso_assessments
FOR INSERT
WITH CHECK (true);

-- Create policy for system admins to manage all assessments
CREATE POLICY "System admins can manage assessments"
ON public.cso_assessments
FOR ALL
USING (public.is_system_admin(auth.uid()))
WITH CHECK (public.is_system_admin(auth.uid()));