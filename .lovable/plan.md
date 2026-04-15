
Goal: make the Access Permissions settings the single source of truth for Bugbrooke practice behaviour, so Lorraine’s assigned View/Submitter roles control what she can see and do.

What I found
- Lorraine’s profile exists and her live user id is `d3c8b2ec-5553-4ccf-99c2-f1ea9348d428`.
- She already has both `submit` and `view` access rows for `bugbrooke` in `nres_buyback_access`.
- The live Bugbrooke staff rows are owned by other users, not Lorraine.
- `useNRESBuyBackStaff.ts` currently restricts non-admin staff loading to `user_id = current user`.
- The `nres_buyback_staff` RLS policies also only allow `auth.uid() = user_id` or NRES admin.
- That is why Lorraine cannot see the created Bugbrooke staff. The NRES Management section still shows names because that block is partly driven from management role config, not from the live staff table.
- Claims are already closer to the correct model because claim visibility has a practice-access policy, but I will still re-check that the client logic is fully tied to the same permissions source.

Implementation plan
1. Make practice access drive staff visibility
- Update the staff hook so non-admin users are no longer limited to their own `user_id`.
- Load staff by what the user is allowed to see via practice assignment, not by row creator.
- Keep the existing practice dashboard filtering, so Lorraine only sees Bugbrooke rows.

2. Mirror the settings in database security
- Add a Supabase migration for `nres_buyback_staff` to reuse `has_nres_buyback_access(...)`.
- New rule set:
  - `view` and `submit` can read staff for their assigned practice.
  - `submit` can add/edit/remove staff for their assigned practice.
  - View-only users remain read-only.
  - Amanda/Lucy and other elevated admin roles keep broader visibility through existing admin logic.

3. Remove conflicting client-side owner checks
- In `useNRESBuyBackStaff.ts`, remove the extra non-admin `.eq('user_id', user.id)` restrictions on fetch/update/delete, because they currently block legitimate practice submitters from managing rows created by somebody else.
- Let RLS enforce the real permission boundary.

4. Reconfirm claim-side wiring to the same settings
- Audit `useNRESBuyBackClaims.ts` and the practice dashboard props so:
  - `view` users can see Bugbrooke claims.
  - `submit` users can create/edit/resubmit/submit Bugbrooke claims.
  - View-only users do not get submit/edit actions.
- If any remaining owner-based claim restriction is still present, remove it so claims and staff behave consistently.

5. Verify the exact scenarios you described
- Lorraine with `submit + view` on Bugbrooke:
  - can see Bugbrooke staff rows in Buy-Back / GP Locum / New SDA
  - can see Bugbrooke claims
  - can submit/manage as a practice user
- A View-only Bugbrooke user:
  - can see the same roster and claims
  - cannot add/edit/delete/submit
- Amanda and Lucy:
  - continue to behave as elevated oversight users, not restricted practice users

Technical details
- Files likely affected:
  - `src/hooks/useNRESBuyBackStaff.ts`
  - possibly `src/hooks/useNRESBuyBackClaims.ts` for consistency
  - one new Supabase migration updating `nres_buyback_staff` RLS policies
- No new tables should be needed; this is mainly a permissions alignment fix.
- I will keep the change targeted to access logic only and avoid touching unrelated dashboard UI.
