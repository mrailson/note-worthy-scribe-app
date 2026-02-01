-- Drop and recreate the view with security_invoker = off so it uses definer's privileges
DROP VIEW IF EXISTS public.complaint_involved_parties_secure;

CREATE VIEW public.complaint_involved_parties_secure 
WITH (security_invoker = false) AS
SELECT 
  id,
  complaint_id,
  staff_name,
  staff_email,
  staff_role,
  response_requested_at,
  response_submitted_at,
  response_text,
  access_token_expires_at,
  access_token_last_used_at,
  created_at
FROM public.complaint_involved_parties;

-- Grant SELECT on the view to authenticated users
GRANT SELECT ON public.complaint_involved_parties_secure TO authenticated;

-- Revoke direct access to base table to force use of view
REVOKE SELECT ON public.complaint_involved_parties FROM authenticated;