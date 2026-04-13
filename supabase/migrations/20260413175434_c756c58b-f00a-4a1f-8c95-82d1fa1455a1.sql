
-- Drop the overly permissive anon policies
DROP POLICY IF EXISTS "Public can view by approval token" ON public.approval_signatories;
DROP POLICY IF EXISTS "Public can update by approval token" ON public.approval_signatories;

-- Scoped SELECT: anon can only read the signatory matching the token in the request header
CREATE POLICY "Public can view by approval token"
ON public.approval_signatories FOR SELECT TO anon
USING (
  approval_token = (current_setting('request.headers', true)::json ->> 'x-approval-token')::uuid
);

-- Scoped UPDATE: anon can only update the signatory matching the token in the request header
CREATE POLICY "Public can update by approval token"
ON public.approval_signatories FOR UPDATE TO anon
USING (
  approval_token = (current_setting('request.headers', true)::json ->> 'x-approval-token')::uuid
)
WITH CHECK (
  approval_token = (current_setting('request.headers', true)::json ->> 'x-approval-token')::uuid
);
