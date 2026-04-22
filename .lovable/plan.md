

## Plan: Add Sessions Column and Max Claimable Calculation Breakdown to All Claim Views

### Summary

Add a "Sessions" column to locum claims and display a clear "Max Claimable" calculation breakdown in the staff line items table across all four dashboard views (Practice, Management/Verifier, SNO Approver, and SNO Finance). This helps reviewers and finance teams understand how invoice totals are calculated and verify they do not exceed maximum reclaimable values.

### What Changes

**1. `src/components/nres/hours-tracker/BuyBackPracticeDashboard.tsx` — Practice View (submitted claim table)**

- Add a "Sessions" column to the staff table headers for locum claims (between GL Cat and Date columns)
- Populate with `allocation_value` (number of sessions) for `gp_locum` staff
- Add a "Max Claimable" column after "Amount" for all claim categories, showing the calculated maximum amount
- In the table footer, show a summary row: "Claimed Total vs Max Claimable Total" so the practice can see the comparison
- For locum rows: display `sessions × £375/session = max £X,XXX.XX`
- For salaried/buy-back rows: display the `calculated_amount` from the claim data as the max
- Highlight in amber/red if the claimed amount equals or exceeds the max

**2. `src/components/nres/hours-tracker/BuyBackVerifierDashboard.tsx` — Management View**

- Add "Sessions" column for locum claims (same pattern)
- Add "Max Claimable" column to the existing staff table (currently has: Name, Role, GL Cat, Date, Hours Worked, Hrs, Amount)
- New headers become: Name, Role, GL Cat, Sessions (locum only), Date, Hours Worked, Hrs, Amount, Max Claimable
- Show the max calculation inline for each staff row
- Add a footer comparison: Total Claimed vs Total Max Claimable
- Add a summary box below the table showing the calculation formula (e.g. "4 sessions × £375 = £1,500 max")

**3. `src/components/nres/hours-tracker/BuyBackPMLDashboard.tsx` — SNO Approver and SNO Finance View**

- Same additions as the Verifier dashboard: Sessions column + Max Claimable column
- Update the existing staff details table which currently uses the same 7-column layout
- Add the calculation summary below the table

**4. Shared Helper (extracted into a common pattern across all three files)**

- `formatMaxClaimableInfo(staffDetail)` — returns the max claimable amount and a human-readable formula string:
  - GP Locum (sessions): `{n} sessions × £375 = £{max}`
  - GP Locum (daily): `{n} days × £750 = £{max}`
  - Salaried/Buy-Back: `{WTE} × £{annual}/yr ÷ 12 × {on-cost multiplier} = £{max}`
  - Management: `{hrs/wk} × {weeks} × £{rate}/hr = £{max}`
  - Meeting: `{hours} hrs × £{rate}/hr = £{max}`
- The max amount itself is already stored as `calculated_amount` on each staff detail, so the primary source of truth remains the database value
- The formula string is for display purposes to help reviewers understand the derivation

### Technical Details

- The `staff_details` JSON array on each claim already contains `calculated_amount` (max), `claimed_amount` (actual), `allocation_value`, `allocation_type`, `staff_category`, `hourly_rate`, and `staff_role` for each staff line
- No database changes needed — all data is already available in the claim payload
- The `MINUTES_PER_SESSION = 250` (4h 10m) constant and `formatLocumHours` helper already exist in the Practice dashboard and will be reused/replicated in the other dashboards
- GP Locum rates: £375/session, £750/day (from `useNRESBuyBackClaims.ts` constants)
- The "Max Claimable" column will use a distinct visual style (lighter background, smaller font) to differentiate it from the actual claimed amount
- If `claimed_amount > calculated_amount`, the Amount cell will be highlighted in red with an overage indicator (this pattern already exists in the PML dashboard)

