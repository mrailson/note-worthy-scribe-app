-- =====================================================
-- Fix: Enforce column-level security on access_token
-- 
-- Revoke direct SELECT on access_token column from authenticated users
-- Only service role and system admins can access the raw token
-- All other access must go through the secure view or RPC function
-- =====================================================

-- Step 1: Grant SELECT on all columns EXCEPT access_token to authenticated role
-- We need to explicitly grant columns we want accessible

-- First, revoke all SELECT from the table for authenticated users
REVOKE SELECT ON public.complaint_involved_parties FROM authenticated;

-- Grant SELECT on specific columns (excluding access_token)
GRANT SELECT (
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
  access_token_last_used_at
) ON public.complaint_involved_parties TO authenticated;

-- Grant UPDATE on the table (needed for staff feedback submission)
-- The UPDATE policy will still control which rows can be updated
GRANT UPDATE ON public.complaint_involved_parties TO authenticated;

-- Grant DELETE on the table (needed for removing involved parties)
-- The DELETE policy will still control which rows can be deleted  
GRANT DELETE ON public.complaint_involved_parties TO authenticated;

-- Grant INSERT on the table (needed for adding involved parties)
GRANT INSERT ON public.complaint_involved_parties TO authenticated;

-- Ensure the secure view still has SELECT access
GRANT SELECT ON public.complaint_involved_parties_secure TO authenticated;

-- Add documentation
COMMENT ON COLUMN public.complaint_involved_parties.access_token IS 
'SECURITY: This column is protected by column-level security. 
Direct SELECT access is revoked from authenticated users.
Access tokens can only be retrieved via get_involved_party_access_url() RPC function
or the complaint_involved_parties_secure view (which excludes the token).
Service role and system admins retain full access for administrative purposes.';