## Scope

The "My" tab on `/nres/time-tracker` currently loads `nres_time_entries` with no `user_id` filter, so if a user happens to have broader visibility (e.g. verifier / super admin / management lead RLS), entries from other users can leak into their personal Recent entries list and totals. The Manager View is the only place cross-user data should appear.

## Change

In `src/pages/NRESTimeTracker.tsx`, scope the personal entries query to the logged-in user only.

- Around line 264, update the `nres_time_entries` select to add `.eq('user_id', user.id)` so the personal "My" view always returns just the current user's rows, regardless of RLS scope.

That's the only edit — Manager View (`NRESTimeManagerView.tsx`) keeps its existing cross-user query and stays gated behind `useIsNRESVerifier`, so verifiers/admins still see everyone there.

## Files touched

- `src/pages/NRESTimeTracker.tsx` (one-line filter addition)

No schema, RLS, hook, or Manager View changes.