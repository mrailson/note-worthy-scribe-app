

# Add Calculation Breakdown to All Claim Detail Views

## Problem
When a claim is submitted, invoiced, or paid, the expanded detail panel only shows the total amount and status. Users cannot see **how** the amount was calculated, what the maximum claimable was, or what the claim is actually for. The rich calculation breakdown (on-costs, allocation, rates) is only visible when creating a new draft.

## What changes

Add a **"Claim Breakdown"** section to all non-draft expanded claim views (submitted, verified, invoiced, paid) that shows:

1. **Max Claimable** — the calculated maximum for the staff member's role/allocation
2. **Amount Claimed** — what the practice actually claimed (and difference from max if lower)
3. **Calculation Formula** — reuse the existing `getCalcBreakdown()` logic to show the formula row and on-costs table
4. **What the claim covers** — role, allocation, programme context

## Where it appears

### For Submitted/Verified claims (lines ~1123-1141)
Currently just shows amount + status pill. Will add the calculation breakdown between the amount card and the "Submitted" date line.

### For Invoiced/Paid claims (lines ~1153-1269)
Currently shows invoice header + detail grid + audit trail. Will add the calculation breakdown between the invoice header card and the detail grid.

## Technical approach

1. **Extract `getCalcBreakdown()` call** — it's already computed as `calcBreakdownData` at line 569 for every `StaffClaimRow`. It just isn't rendered in the submitted/invoiced/paid branches. Re-use the same variable.

2. **Create a shared `CalcBreakdownPanel` inline section** — renders:
   - A header row: "Max Claimable: £X,XXX.XX" with the formula pills (already built)
   - If `claimTotal(claim) < calculatedAmount`: a note "Practice claimed £Y — £Z below maximum"
   - The on-costs breakdown table (already built)
   - For management: the hourly rate × weeks × on-costs row
   - For locum: sessions × rate breakdown

3. **Insert the panel** into:
   - The simple submitted/verified view (after the amount card, before the submitted date)
   - The invoiced/paid view (after the invoice header card, before the detail grid)

4. **All changes in one file**: `BuyBackPracticeDashboard.tsx` — the `StaffClaimRow` component only.

## Visual design
- Light background panel (`#f8fafc`) with subtle border, matching existing breakdown styling
- "CLAIM CALCULATION" uppercase label header (10px, slate)
- Max claimable prominently shown
- Formula pills row (existing style)
- On-costs table (existing style)
- If claimed < max: green note showing difference

