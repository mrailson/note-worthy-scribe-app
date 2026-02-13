-- Fix complaint_involved_parties_secure to use SECURITY INVOKER
-- The base table already has proper RLS policies, so definer privileges are unnecessary.
-- The view still hides the access_token column for security.

ALTER VIEW public.complaint_involved_parties_secure SET (security_invoker = true);