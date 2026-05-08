## Goal
When a sessional GP claim is recast to **Hours/wk** in the Create-Draft panel, present the entire calculation in hours and let the practice enter an **Actual Hourly Rate Paid** (pre on-costs) plus an editable total hours figure. The "Amount to claim this month" then auto-derives from those two inputs and is capped at the equivalent maximum staff hourly rate held in the system for that role.

Only applies to session-priced GP roles (e.g. GP Over 2 Years CCT, GP Under 2 Years CCT, GP Retainer). Behaviour for WTE-claim mode and for non-session roles is unchanged.

## What changes in the UI

Inside the Create-Draft panel (per-staff month modal in the SDA Claims tab), when `Claim as = Hours/wk` and the role is session-priced:

1. **Formula line** is restated end-to-end in hours:
   `X hrs/wk × W working wks = H hrs/month × £R/hr (incl. 1.2938 on-costs) = £Total`

2. **Breakdown panel** adds three new lines under "Total incl. on-costs":
   - Staff hourly rate (excl. on-costs): **£55.39/hr** (= annual sessional cost ÷ annual hours)
   - Employer on-costs per hour (29.38%): **£16.27/hr**
   - Total hourly rate (incl. on-costs): **£71.66/hr**
   All to 2 decimal places, dynamic.

3. **New "Hours claimed this month" input** (editable number):
   - Defaults to `weekly hours × working weeks in claim month` (using the existing `rateParams.workingWeeksInMonth`).
   - User can adjust up or down; min 0, soft warning if above the default.

4. **New "Actual hourly rate paid (gross, before on-costs)" input** (editable £/hr):
   - Defaults to the equivalent staff hourly rate (£55.39 in the example).
   - Capped at that maximum — if the user types higher, clamp and show "Capped at £55.39/hr — this is the maximum staff hourly rate funded for {role}".
   - 2-decimal formatting.

5. **"Amount to claim this month"** stops being free-text and becomes the live derived value:
   `actualHourlyRate × hoursClaimedThisMonth × onCostMultiplier`
   Read-only display, with a small note "Auto-calculated from hours and hourly rate". Maximum-claimable cap is unchanged (existing `calculatedAmount`), so any combination above the role's monthly cap is clamped down to the maximum.

WTE mode and non-session-priced roles keep the current behaviour exactly.

## Persistence
Store the two new inputs on the existing `staff_details` line in the claim so they round-trip and appear in admin/verifier views:
- `claimed_hours_in_month` (number)
- `actual_hourly_rate_gross` (number, pre on-costs)

These are passed through `onCreateClaim(...)` alongside the existing `amountToUse`. Verifier/admin read-only panels will display them as plain text under the existing breakdown — no editing.

## Out of scope
- WTE claim mode (no change).
- Non-session-priced roles (Practice Manager, salaried GP on WTE, etc.).
- Locum / management / meeting categories (already use distinct flows).
- Backfilling old claims — new fields are nullable; older claims simply omit them.

## Technical notes
- File: `src/components/nres/hours-tracker/BuyBackPracticeDashboard.tsx` — extend `getCalcBreakdown()` for the hours/session-priced branch and add the two inputs into the panel near "Amount to claim this month".
- Constants already in scope: `HOURS_PER_SESSION = 25/6`, `rateParams.onCostMultiplier`, `rateParams.workingWeeksInMonth`, `rateParams.getRoleAnnualRate`.
- New state: `hoursClaimedMonth`, `actualHourlyRate`. Effect resets defaults whenever role / sessions / month / on-cost % change.
- Derived `amountToUse = round2(actualHourlyRate × hoursClaimedMonth × onCostMultiplier)`, then `Math.min(amountToUse, calculatedAmount)`.
- Migration: add nullable columns `claimed_hours_in_month numeric`, `actual_hourly_rate_gross numeric` to wherever the staff line JSON or table lives — needs confirmation that `staff_details` is JSONB (it is, based on existing `(claim.staff_details as any[])` usage), so **no DB migration required** — fields just live inside the JSONB blob.
- Verifier/admin read-only display added to `BuyBackVerifierDashboard.tsx` and `BuyBackPMLDashboard.tsx` calc tooltip/breakdown sections so reviewers can see the rate the practice paid.