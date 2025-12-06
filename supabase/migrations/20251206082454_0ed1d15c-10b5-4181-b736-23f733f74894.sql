-- Drop overly permissive policies that expose healthcare professional data publicly
DROP POLICY IF EXISTS "Public can view registrations" ON public.cso_registrations;
DROP POLICY IF EXISTS "Public can update registrations" ON public.cso_registrations;

-- Drop redundant/duplicate policies to clean up
DROP POLICY IF EXISTS "Allow insert for registration" ON public.cso_registrations;
DROP POLICY IF EXISTS "Allow public registration submission" ON public.cso_registrations;
DROP POLICY IF EXISTS "Anyone can register (insert only)" ON public.cso_registrations;

-- Keep only the secure policies:
-- 1. "Public can insert registrations" - allows new registrations (INSERT only, no data exposure)
-- 2. "Registration owners can view/update their own records" - email-based ownership
-- 3. "System admins can manage all registrations" - admin access
-- 4. "Users can view/update their own registration by email" - authenticated user access
-- 5. "Users can view their own registration via token" - access token based access