-- Enable RLS on cso_registrations table
ALTER TABLE public.cso_registrations ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies
DROP POLICY IF EXISTS "Registration owners can view their own records" ON public.cso_registrations;
DROP POLICY IF EXISTS "System admins can view all registrations" ON public.cso_registrations;
DROP POLICY IF EXISTS "Allow insert for registration" ON public.cso_registrations;
DROP POLICY IF EXISTS "Registration owners can update their own records" ON public.cso_registrations;

-- Create policy for registration owners to view their own records (matched by email)
CREATE POLICY "Registration owners can view their own records"
ON public.cso_registrations
FOR SELECT
USING (email = auth.email());

-- Create policy for system admins to view all registrations
CREATE POLICY "System admins can view all registrations"
ON public.cso_registrations
FOR SELECT
USING (public.is_system_admin(auth.uid()));

-- Create policy for registration owners to update their own records
CREATE POLICY "Registration owners can update their own records"
ON public.cso_registrations
FOR UPDATE
USING (email = auth.email())
WITH CHECK (email = auth.email());

-- Create policy for authenticated users to insert registrations (needed for initial registration)
CREATE POLICY "Allow insert for registration"
ON public.cso_registrations
FOR INSERT
WITH CHECK (true);

-- Create policy for system admins to manage all registrations
CREATE POLICY "System admins can manage registrations"
ON public.cso_registrations
FOR ALL
USING (public.is_system_admin(auth.uid()))
WITH CHECK (public.is_system_admin(auth.uid()));