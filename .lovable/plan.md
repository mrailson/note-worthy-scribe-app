

## Investigation Report: Policy Profile Defaults Persistence for Nicola Draper

### User Details
- **User**: Nicola Draper (user_id: `8637a642-97d1-4a5a-ba0f-6ea503a4ae3c`)
- **Practice**: Denton Village Surgery (practice_id: `b2cbe569-30e3-4a66-838a-c2ad54b41ff2`)
- **Role**: `practice_manager`

### Findings

**1. Duplicate records with no default marker**
Nicola has **3 `practice_details` records**, all with `is_default: false`:
- `f9e8fffe` — created 12 Feb, `is_default: false`
- `54b8a23a` — created 12 Feb, `is_default: false`
- `dd2c6a96` — updated 19 Feb, `is_default: false` ← most recent, contains valid data

The most recent record **does** contain her data (practice name, ODS code K83068, list size 6300, SystmOne, personnel names etc.). So the data was saved at least once. But it hasn't been updated since 19 Feb, which suggests subsequent saves are failing silently.

**2. Root cause: RLS policy mismatch**
The INSERT and DELETE policies on `practice_details` are granted `TO public` instead of `TO authenticated`:

| Policy | Role | Issue |
|--------|------|-------|
| INSERT | `public` | Should be `authenticated` — `auth.uid()` may not resolve correctly for `public` role in some PostgREST flows |
| DELETE | `public` | Same issue |
| SELECT | `authenticated` | Correct |
| UPDATE | `authenticated` | Correct |

This explains why it works for you (Malcolm) — the UPDATE policy includes `is_system_admin()` which bypasses all checks. For Nicola, the UPDATE policy's `user_id = auth.uid()` condition *should* work, but the duplicate records and stale timestamps suggest an issue.

**3. Why it works for you (Malcolm)**
Your UPDATE path hits `is_system_admin() = true` first, bypassing all other checks. Nicola relies on `user_id = auth.uid()`, which should work but may be affected by session/token timing.

### Proposed Fix

**Step 1: Fix RLS policies** — Change INSERT and DELETE to `TO authenticated` for consistency and security.

**Step 2: Clean up duplicate records** — Delete the 2 older duplicate records for Nicola and set `is_default = true` on the remaining one (`dd2c6a96`).

**Step 3: Add defensive code** — Ensure the save handler sets `is_default: true` on both INSERT and UPDATE paths to prevent this state in future.

### Technical Details
- **Files to modify**: `src/components/policy/PolicyProfileDefaults.tsx` (add `is_default: true` to update payload)
- **Database changes**: 2 SQL migrations — fix RLS policies, clean up duplicates

