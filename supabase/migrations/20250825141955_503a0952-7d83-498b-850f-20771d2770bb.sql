-- CRITICAL SECURITY FIX: Remove public access to patient consultation transcripts
-- Issue: meeting_transcription_chunks table allows unauthenticated access to sensitive medical data

-- Drop the existing vulnerable SELECT policy
DROP POLICY IF EXISTS "Allow transcription chunk access for meeting participants" ON public.meeting_transcription_chunks;

-- Create a secure SELECT policy that ONLY allows authenticated users with proper access
CREATE POLICY "Secure transcription chunk access for authenticated users only" 
ON public.meeting_transcription_chunks
FOR SELECT 
TO authenticated
USING (
  -- User must be authenticated (auth.uid() IS NOT NULL)
  -- AND either:
  -- 1. User owns the transcription chunk directly
  (auth.uid() = user_id) 
  OR 
  -- 2. User has explicit access to the meeting (through meeting ownership or sharing)
  ((meeting_id IS NOT NULL) AND user_has_meeting_access(meeting_id, auth.uid()))
);

-- Log this critical security fix
INSERT INTO public.system_audit_log (
  table_name,
  operation,
  user_id, 
  user_email,
  new_values
) VALUES (
  'meeting_transcription_chunks',
  'SECURITY_FIX_APPLIED',
  COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
  COALESCE(auth.email(), 'system@security.fix'),
  jsonb_build_object(
    'issue', 'Removed public access to patient consultation transcripts',
    'severity', 'CRITICAL',
    'fix_applied_at', now(),
    'policy_updated', 'Allow transcription chunk access for meeting participants',
    'new_policy', 'Secure transcription chunk access for authenticated users only'
  )
);