-- Drop all overly permissive policies on cso_certificates
DROP POLICY IF EXISTS "Allow insert for certificate generation" ON public.cso_certificates;
DROP POLICY IF EXISTS "Certificate owners can view their own certificates" ON public.cso_certificates;
DROP POLICY IF EXISTS "Certificates can be inserted via service role only" ON public.cso_certificates;
DROP POLICY IF EXISTS "Public can insert certificates" ON public.cso_certificates;
DROP POLICY IF EXISTS "Public can view certificates" ON public.cso_certificates;
DROP POLICY IF EXISTS "System admins can manage certificates" ON public.cso_certificates;
DROP POLICY IF EXISTS "System admins can view all certificates" ON public.cso_certificates;

-- Users can only view their own certificates (matched via email through registration)
CREATE POLICY "Users can view own certificates"
ON public.cso_certificates
FOR SELECT
TO authenticated
USING (
  registration_id IN (
    SELECT cr.id FROM public.cso_registrations cr 
    WHERE cr.email = auth.email()
  )
);

-- Users can insert certificates for their own registration
CREATE POLICY "Users can insert own certificates"
ON public.cso_certificates
FOR INSERT
TO authenticated
WITH CHECK (
  registration_id IN (
    SELECT cr.id FROM public.cso_registrations cr 
    WHERE cr.email = auth.email()
  )
);

-- System admins have full access
CREATE POLICY "System admins can manage all certificates"
ON public.cso_certificates
FOR ALL
TO authenticated
USING (is_system_admin(auth.uid()))
WITH CHECK (is_system_admin(auth.uid()));