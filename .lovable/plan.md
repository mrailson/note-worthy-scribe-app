

## Problem

When an admin deletes a test claim, it appears that the associated staff member (e.g. Olivia Dove) also disappears. Investigation reveals:

1. **No database cascade** — deleting a claim does NOT cascade to `nres_buyback_staff` at the DB level.
2. **The real issue**: The `onRemoveStaff` prop (which calls `removeStaff` from `useNRESBuyBackStaff`) is passed to the Practice Dashboard for ALL users, including admins. Admins have a visible "Remove staff" button (trash icon) next to each staff member. If an admin clicks this — even accidentally — it permanently deletes the staff record from the database. RLS policies explicitly allow admins to delete any staff (`is_nres_admin()`).
3. Additionally, `removeStaffFromClaim` in `useNRESBuyBackClaims` (line 442-454) will delete the entire claim if the last staff line is removed, but this doesn't touch the `nres_buyback_staff` table.

## Plan

### Changes to `src/components/nres/hours-tracker/BuyBackClaimsTab.tsx`
- **Stop passing `onRemoveStaff` to admins**: Only pass `removeStaff` as `onRemoveStaff` when the user is the practice owner (non-admin), not when they are viewing as admin. This prevents admins from accidentally deleting practice staff entries.

### Changes to `src/components/nres/hours-tracker/BuyBackPracticeDashboard.tsx`
- **Hide the remove staff button for admins**: In the `StaffRowCard` component, only show the trash/remove button when the current user is the staff owner (not an admin viewing another practice's staff). Add an `isOwner` or `adminViewing` prop to control this.

### Changes to `src/hooks/useNRESBuyBackStaff.ts`
- **Guard `removeStaff` against admin usage on other users' staff**: Add a safety check so that even if called, admins cannot delete staff belonging to other users. The function should only allow deletion when `user_id` matches the current user, regardless of admin status.

### Summary of protections
- UI: Admins won't see the remove button for staff they don't own
- Hook: `removeStaff` will always filter by `user_id` (no admin bypass for deletion)
- DB: RLS remains unchanged (defence in depth — the hook guard is the primary protection)

No database migration needed.

