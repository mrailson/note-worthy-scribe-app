-- Fix the SECURITY DEFINER view issue - change to SECURITY INVOKER
-- Drop and recreate the view with proper security settings

DROP VIEW IF EXISTS public.complaint_involved_parties_secure;

CREATE VIEW public.complaint_involved_parties_secure 
WITH (security_invoker = true)
AS
SELECT 
  id,
  complaint_id,
  staff_name,
  staff_email,
  staff_role,
  response_requested_at,
  response_submitted_at,
  response_text,
  created_at,
  access_token_expires_at,
  access_token_last_used_at,
  -- Show token status without revealing the actual token
  CASE 
    WHEN access_token IS NOT NULL THEN true 
    ELSE false 
  END as has_access_token,
  CASE 
    WHEN access_token_expires_at < now() THEN 'expired'
    WHEN access_token_expires_at IS NULL THEN 'no_expiry'
    ELSE 'active'
  END as token_status
FROM public.complaint_involved_parties;

-- Re-grant access
GRANT SELECT ON public.complaint_involved_parties_secure TO authenticated;

-- Re-add comment
COMMENT ON VIEW public.complaint_involved_parties_secure IS 
'Secure view of complaint_involved_parties that excludes the access_token column. 
Uses SECURITY INVOKER to enforce RLS policies of the querying user.
Use this view for all regular queries. Access tokens should only be retrieved via 
get_involved_party_access_url() function which performs authorization checks.';