## Goal

Make it quick for a practice user (e.g. Lucy) to add a missing claimant — like James Toplis or Staci Boston — directly from the "Log Hours" form, without having to open the separate Claimants Manager screen first.

## Current behaviour

- The "Claim For" dropdown on the Log Hours card only lists already-saved claimants for the user's practice (plus a "Personal Rate" option).
- To add someone new, the user has to navigate to the Claimants Manager, add them, save, then come back to log hours.
- Result: claimants like James Toplis and Staci Boston aren't in the database, so Lucy can't log on their behalf without leaving the form.

## Proposed change

Add a single "+ Add new staff member…" entry at the bottom of the "Claim For" dropdown. Selecting it opens a small dialog asking for:

- Full name
- Role: GP (£100/hr) or Practice Manager (£50/hr)

On save:
- The new claimant is created in `nres_claimants` against the user's own practice (using the existing `addClaimant` hook — no schema changes).
- The dropdown automatically refreshes and the newly added person becomes the selected claimant, ready to have hours logged against them.
- A toast confirms "Staff member added".

The existing Claimants Manager screen stays in place for full editing (deactivate, change role, delete).

## Scope guardrails

- Only changes the Hours Entry form and adds one small dialog component.
- No database migration — uses the existing `nres_claimants` table and `addClaimant` function.
- No change to permissions: a user can only add staff for the practice they're already attached to.
- Lucy's existing access to Bugbrooke is unchanged; this just removes the friction of having to add Toplis / Boston via a separate screen.

## Technical notes

- Edit `src/components/nres/hours-tracker/HoursEntryForm.tsx`:
  - Add a sentinel `__add_new__` option at the bottom of the Select.
  - On selection, open a new `<QuickAddClaimantDialog>` and revert the Select value.
  - On dialog success, call the parent's refetch and set `claimantSelection` to the returned claimant id.
- New component `src/components/nres/hours-tracker/QuickAddClaimantDialog.tsx` — a thin wrapper over `useNRESClaimants().addClaimant`.
- `BuyBackClaimsTab` already owns the claimants list / refetch — pass `addClaimant` and `refetch` down as props (or call the hook directly inside the new dialog).
