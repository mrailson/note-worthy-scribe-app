
## Goal

On the GP Locum claim creation card (Practice dashboard → SDA Claims → "Claim" on a locum row), let the user choose whether to enter their work for the month in **sessions** or **hours**. The monetary cap stays exactly the same — sessions are still the master unit, with one session defined as 4h 10m (25/6 hours), so £375/session ↔ £90/hour equivalent.

## What the user will see

Step 1 — "Actual locum work this month" gains a small unit toggle:

```
[ Sessions | Hours ]   [  3  ] sessions  × £375.00/session  =  max £1,125.00
                       (= 12h 30m equivalent)
```

If "Hours" is chosen:

```
[ Sessions | Hours ]   [ 12.5 ] hours    × £90.00/hour     =  max £1,125.00
                       (= 3.00 sessions equivalent)
```

- Hourly rate is derived from the configured session rate: `sessionRate ÷ (25/6)`.
- The max claimable, the £ entry box (Step 2) and the "Use max" button behave identically — the cap is the same money either way.
- The small "configured: N sess/mo" hint stays, shown in whichever unit is active.

## Behaviour rules

- Default unit = **Sessions** (preserves current behaviour for everyone).
- Switching unit converts the current value (sessions ↔ hours) so the £ max doesn't jump.
- Increments: sessions step `0.5`, hours step `0.25`.
- Hours displayed in British format hours + minutes only (e.g. "4h 10m"), per project rule.
- On "Create Draft":
  - If unit is Hours, the entered hours are converted to fractional sessions (`hours ÷ 25/6`) before being passed to `onCreateLocumClaim`. This keeps all downstream code (claim storage, PDF invoice, GL codes, verifier/PML dashboards, max-claimable formula) completely unchanged — sessions remain the canonical stored value.
  - The chosen entry unit and the original entered value are also written into the staff detail line as `entry_unit: 'sessions' | 'hours'` and `entered_value` so the claim card / invoice can show "Claimed as 12h 30m" alongside the equivalent sessions for transparency.

## Files to change

1. `src/components/nres/hours-tracker/BuyBackPracticeDashboard.tsx`
   - In the locum claim block (around lines 449–460, 815–929):
     - Add `locumUnit` state and a derived `hourlyRate = sessionRate / HOURS_PER_SESSION`.
     - Add a compact pill toggle above the number input.
     - Bind input value/step/label to the active unit; show the equivalent in the other unit underneath.
     - On Create Draft, if unit = hours convert to sessions before calling `onCreateLocumClaim`, and pass through the entry unit/value via a new optional 4th-arg shape (or extend the staff member object).

2. `src/components/nres/hours-tracker/BuyBackClaimsTab.tsx` (lines ~945–957)
   - Extend the `onCreateLocumClaim` wrapper to accept and forward `entryUnit` + `enteredValue`, attaching them to the modified staff line so they persist on the claim's `staff_details`.

3. `src/utils/buybackMaxClaimable.ts`
   - In the `gp_locum` branch of `formatMaxClaimableInfo`, when the staff line has `entry_unit === 'hours'`, render the formula as `12h 30m × £90.00/hr = £1,125.00` instead of sessions, so the verifier/PML and invoice views reflect what the practice actually entered. Sessions branch stays as today.

4. `src/utils/buybackMaxClaimable.ts` — extend `formatLocumHours` (already converts sessions→hours) is reused; no change needed beyond the above.

No DB migration: `staff_details` is a JSONB column, so the two new keys can be added without schema changes.

## Out of scope

- Verifier and PML dashboards continue to use sessions for max-claimable maths; they will simply display the entered-as unit when present (read-only).
- Configuration UI (Edit Staff / Add Staff) stays sessions-only — the toggle is a per-claim entry preference, not a config change.
