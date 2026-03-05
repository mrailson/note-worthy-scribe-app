

## Plan: Load Practice Manager Defaults for Same-Practice Users

### Problem
Currently, each user at a practice must manually enter all practice profile defaults (practice name, address, key personnel, services, branch sites, etc.) independently. If a Practice Manager (e.g. Sarah Berry) has already configured these details, other users at the same practice should automatically inherit them rather than re-entering everything.

### Approach
Modify the `PolicyProfileDefaults.tsx` load logic to add a **Priority 2** fallback: when the current user has no `practice_details` record, look up their `practice_id` from `user_roles`, find the `gp_practices` name, then search `practice_details` for any existing record matching that practice name. If found, pre-populate all fields from it (but do NOT set `practiceDetailsId` — the user will create their own record on save).

This mirrors the existing pattern already used successfully in `usePracticeContext.ts`.

### Changes — Single File

**`src/components/policy/PolicyProfileDefaults.tsx`** — lines ~187-212 (the `else` branch when no user-specific `practice_details` exists):

1. Look up the user's `practice_id` from `user_roles` (already done partially)
2. Get the practice name from `gp_practices`
3. Search `practice_details` for any record matching that practice name (from any user — i.e. the Practice Manager's record)
4. If found, populate **all** fields (practice info, branch sites, personnel, services) from that shared record
5. Show a subtle info banner: "Practice defaults loaded from [Practice Manager Name]'s profile" so users know the data was pre-populated
6. `practiceDetailsId` remains `null` — on save, the user creates their own record (so each user owns their copy but starts from the shared baseline)

### Key Details

- **Matching logic**: Use `ilike` on `practice_name` (exact first, then flexible), same as `usePracticeContext.ts`
- **All fields copied**: practice name, address, postcode, ODS code, list size, clinical system, branch sites, all personnel names, services offered
- **No RLS changes needed**: `practice_details` already allows authenticated users to read records (the existing `usePracticeContext` hook reads other users' records successfully)
- **Banner UX**: A dismissible blue info banner at the top saying "Defaults loaded from existing practice profile" — disappears once the user saves their own copy

