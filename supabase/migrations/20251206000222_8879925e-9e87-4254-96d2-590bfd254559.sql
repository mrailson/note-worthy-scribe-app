-- Enable RLS on cso_certificates table
ALTER TABLE public.cso_certificates ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies
DROP POLICY IF EXISTS "Certificate owners can view their own certificates" ON public.cso_certificates;
DROP POLICY IF EXISTS "System admins can view all certificates" ON public.cso_certificates;
DROP POLICY IF EXISTS "Allow insert for certificate generation" ON public.cso_certificates;

-- Create policy for certificate owners to view their own certificates
-- Links through registration_id to cso_registrations (matched by email to auth.users)
CREATE POLICY "Certificate owners can view their own certificates"
ON public.cso_certificates
FOR SELECT
USING (
  registration_id IN (
    SELECT cr.id FROM public.cso_registrations cr
    WHERE cr.email = auth.email()
  )
);

-- Create policy for system admins to view all certificates
CREATE POLICY "System admins can view all certificates"
ON public.cso_certificates
FOR SELECT
USING (public.is_system_admin(auth.uid()));

-- Create policy for authenticated users to insert certificates (needed for certificate generation)
CREATE POLICY "Allow insert for certificate generation"
ON public.cso_certificates
FOR INSERT
WITH CHECK (true);

-- Create policy for system admins to update/delete
CREATE POLICY "System admins can manage certificates"
ON public.cso_certificates
FOR ALL
USING (public.is_system_admin(auth.uid()))
WITH CHECK (public.is_system_admin(auth.uid()));