
-- Remove dangerous open policies
DROP POLICY IF EXISTS "Public can view by approval token" ON approval_signatories;
DROP POLICY IF EXISTS "Public can update by approval token" ON approval_signatories;

-- Token-scoped SELECT for anon
CREATE POLICY "Public can view by approval token"
  ON approval_signatories FOR SELECT TO anon
  USING (
    approval_token = (
      current_setting('request.headers', true)::json ->> 'x-approval-token'
    )::uuid
  );

-- Token-scoped UPDATE for anon
CREATE POLICY "Public can update by approval token"
  ON approval_signatories FOR UPDATE TO anon
  USING (
    approval_token = (
      current_setting('request.headers', true)::json ->> 'x-approval-token'
    )::uuid
  )
  WITH CHECK (
    approval_token = (
      current_setting('request.headers', true)::json ->> 'x-approval-token'
    )::uuid
  );
