

## Plan: Fix approval_signatories Anon RLS Policies

### The Problem
Two RLS policies on `approval_signatories` grant unrestricted SELECT and UPDATE access to the `anon` role (`USING: true`). This exposes NHS staff names, emails, IP addresses, and signature data to any unauthenticated internet user.

### Why It's Safe to Fix
- **Public approval flow**: Uses the `process-approval` edge function, which authenticates via the **service role key** (bypasses RLS entirely). No client-side code queries this table as anon.
- **Authenticated flows**: `useDocumentApproval.ts` runs as authenticated users and is covered by existing authenticated-role policies.

### Changes — Single Migration

Drop the two dangerous anon policies and replace with token-scoped versions (matching the `cso_registrations` pattern already used in the project):

```sql
-- Remove dangerous open policies
DROP POLICY "Public can view by approval token" ON approval_signatories;
DROP POLICY "Public can update by approval token" ON approval_signatories;

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
```

### What Does NOT Change
- The `process-approval` edge function — uses service role key, unaffected by RLS
- `useDocumentApproval.ts` — runs as authenticated, uses existing authenticated policies
- `PublicApproval.tsx` — calls the edge function, never queries the table directly
- All other approval tables and policies

### Risk Assessment
**Zero functional impact** — no code path queries this table as anon directly. The token-scoped policies are a defence-in-depth measure should any future code attempt direct anon access.

