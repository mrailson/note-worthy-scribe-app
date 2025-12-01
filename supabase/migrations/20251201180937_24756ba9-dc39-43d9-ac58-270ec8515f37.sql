-- Enable Row Level Security on cso_registrations table to prevent public access
ALTER TABLE public.cso_registrations ENABLE ROW LEVEL SECURITY;

-- Drop any existing public access policies that may exist
DROP POLICY IF EXISTS "Enable read access for all users" ON public.cso_registrations;
DROP POLICY IF EXISTS "Public users can view CSO registrations" ON public.cso_registrations;
DROP POLICY IF EXISTS "Anyone can view registrations" ON public.cso_registrations;
DROP POLICY IF EXISTS "Public read access" ON public.cso_registrations;

-- Policy: Authenticated users can view their own registration by email
CREATE POLICY "Users can view their own registration by email"
ON public.cso_registrations
FOR SELECT
TO authenticated
USING (auth.email() = email);

-- Policy: Authenticated users can update their own registration by email
CREATE POLICY "Users can update their own registration by email"
ON public.cso_registrations
FOR UPDATE
TO authenticated
USING (auth.email() = email)
WITH CHECK (auth.email() = email);

-- Policy: System admins can view all registrations
CREATE POLICY "System admins can view all registrations"
ON public.cso_registrations
FOR SELECT
TO authenticated
USING (is_system_admin(auth.uid()));

-- Policy: System admins can manage all registrations
CREATE POLICY "System admins can manage all registrations"
ON public.cso_registrations
FOR ALL
TO authenticated
USING (is_system_admin(auth.uid()))
WITH CHECK (is_system_admin(auth.uid()));

-- Policy: Allow public INSERT only (for initial registration form submission)
-- Users can register but cannot read or update without authentication
CREATE POLICY "Allow public registration submission"
ON public.cso_registrations
FOR INSERT
TO anon
WITH CHECK (true);

-- Note: No SELECT policy for anon users - this prevents public reading of sensitive data
-- Access tokens should be handled through secure edge functions, not direct database access