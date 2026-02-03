-- Add public access policy for complaint capture sessions lookup by short_code
-- This allows unauthenticated mobile users to validate their session

CREATE POLICY "Anyone can view sessions by short_code for validation"
ON public.complaint_capture_sessions
FOR SELECT
USING (true);

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Users can view their own capture sessions" ON public.complaint_capture_sessions;