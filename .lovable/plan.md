

## Problem

The `usePracticeProfileCompletion` hook only queries `practice_details` for the current user's own record (`user_id = user.id`). For Julia Railson, who has no roles filled, it shows "12 of 12 missing" — but Sarah Berry has already completed all 12 for the same practice. The hook should use the same shared-record inheritance logic that `PolicyProfileDefaults.tsx` uses.

## Fix

Update `usePracticeProfileCompletion.ts` to:

1. First fetch the user's own `practice_details` record (as now).
2. If the user's record is mostly empty (fewer than 3 personnel fields filled), look up the practice name (from the record itself or from `user_roles` + `gp_practices`).
3. Query for a shared colleague's `practice_details` record at the same practice using flexible name matching (stripping "The " prefix, using `ilike`).
4. Merge: for each of the 12 role fields, consider it "filled" if either the user's own record or the shared record has a value.

This mirrors exactly what `PolicyProfileDefaults.tsx` already does at load time, so the completion badge will reflect the inherited state.

**Single file change:** `src/hooks/usePracticeProfileCompletion.ts`

