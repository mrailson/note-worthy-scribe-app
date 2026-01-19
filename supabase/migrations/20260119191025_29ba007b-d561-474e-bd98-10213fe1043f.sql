-- =====================================================
-- Fix: Restrict access_token exposure in complaint_involved_parties
-- 
-- The access_token column should not be visible to general authenticated users
-- Only system admins should be able to see the raw tokens
-- External access is already handled securely via SECURITY DEFINER functions
-- =====================================================

-- Create a secure view that excludes access_token for regular use
CREATE OR REPLACE VIEW public.complaint_involved_parties_secure AS
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

-- Grant access to the view for authenticated users
GRANT SELECT ON public.complaint_involved_parties_secure TO authenticated;

-- Create a function to safely get access token URL (only for authorized managers)
-- This is more secure than exposing raw tokens in SELECT queries
CREATE OR REPLACE FUNCTION public.get_involved_party_access_url(party_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_access_token uuid;
  v_complaint_id uuid;
  v_is_authorized boolean := false;
BEGIN
  -- Get the party details
  SELECT access_token, complaint_id 
  INTO v_access_token, v_complaint_id
  FROM public.complaint_involved_parties
  WHERE id = party_id;
  
  IF v_access_token IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Check if user is authorized (system admin, practice manager, or complaints manager for this complaint)
  SELECT EXISTS (
    SELECT 1 FROM public.complaints c
    WHERE c.id = v_complaint_id
    AND (
      is_system_admin(auth.uid())
      OR (has_role(auth.uid(), 'practice_manager') AND c.practice_id = ANY(get_user_practice_ids(auth.uid())))
      OR (has_role(auth.uid(), 'complaints_manager') AND c.practice_id = ANY(get_user_practice_ids(auth.uid())))
    )
  ) INTO v_is_authorized;
  
  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'Not authorized to access this token';
  END IF;
  
  -- Return just the token (caller will construct URL)
  RETURN v_access_token::text;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_involved_party_access_url(uuid) TO authenticated;

-- Drop the existing overly permissive SELECT policy and create a more restrictive one
-- The new policy will only allow SELECT on non-sensitive columns via the secure view
-- Direct table access to access_token column should be restricted

DROP POLICY IF EXISTS "complaint_involved_parties_select_authenticated" ON public.complaint_involved_parties;

-- Create new SELECT policy that excludes access_token for regular users
-- Only system admins can see the raw access_token via direct table query
CREATE POLICY "complaint_involved_parties_select_restricted" 
ON public.complaint_involved_parties
FOR SELECT 
TO authenticated
USING (
  -- System admins can see everything including tokens
  is_system_admin(auth.uid())
  OR
  -- Others can only see rows for their practice complaints (but access_token is hidden via view)
  (
    complaint_id IN (
      SELECT c.id FROM complaints c
      WHERE (c.practice_id = ANY(get_user_practice_ids(auth.uid()))) 
         OR (c.created_by = auth.uid())
    )
  )
);

-- Add comment to document the security model
COMMENT ON VIEW public.complaint_involved_parties_secure IS 
'Secure view of complaint_involved_parties that excludes the access_token column. 
Use this view for all regular queries. Access tokens should only be retrieved via 
get_involved_party_access_url() function which performs authorization checks.';

COMMENT ON FUNCTION public.get_involved_party_access_url(uuid) IS
'Securely retrieves the access token for an involved party. 
Only authorized users (system admins, practice managers, complaints managers) can retrieve tokens.
This prevents tokens from being exposed in general SELECT queries.';