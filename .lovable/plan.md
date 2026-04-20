

## Goal
Simplify the PML Finance payment flow in SDA Claims so Finance only needs to mark a claim as **Paid** — with an optional payment date. Remove the "Schedule Payment" step and its mandatory date entry.

## Current Flow (3 steps)
`Received → Scheduled (date required) → Paid`

The "Schedule Payment" button is currently disabled until Finance picks a date, and there's a separate "Confirm Payment Sent" step afterwards. This is more friction than the team needs.

## New Flow (2 steps)
`Received → Paid`

After Finance clicks "Received & Processing", they go straight to a single "Mark as Paid" panel with:
- **Payment date** — optional (defaults to today if left blank)
- **BACS / Cheque reference** — optional (existing)
- **PO reference** — optional (existing)
- **Method** — optional, defaults to BACS (existing)
- **Note** — optional (existing)

One green **✓ Mark as Paid** button. No date validation, no disabled state based on date.

## Changes (single file: `BuyBackPMLDashboard.tsx`)

1. **Step indicator**: drop the middle "Scheduled" pill. Show only `Received → Paid` (2 circles instead of 3).
2. **STATE 2 (Received, not yet paid)**: replace the existing "Schedule payment run" block with a "Record payment" block — same field layout (date, BACS, PO, method, note) but the primary action becomes **✓ Mark as Paid** (green `#166534`), always enabled.
   - On click, call `onMarkPaid(claim.id, "Paid <date or today> · BACS: <ref> · <note>")` and persist the optional fields via the existing payment-update path (BACS ref, PO, method, actual_payment_date).
3. **STATE 3 (Scheduled)**: delete entirely — no longer reachable for new claims. Existing scheduled claims will be handled by the same new "Record payment" UI (the panel shows whether `isReceived || isScheduled`).
4. **STATE 4 (Paid audit summary)**: unchanged — still shows paid date, BACS, PO, method, processed-by, history.
5. **Header chips** (lines 499-504): keep "Scheduled payment" pill display logic for any legacy claims still in `scheduled` status, so historic data still renders correctly. New claims simply won't enter that state.

## Out of scope
- No DB schema changes — `expected_payment_date`, `bacs_reference`, `payment_method`, `pml_po_reference`, `actual_payment_date` columns all stay.
- `onSchedulePayment` callback remains in the prop signature (used elsewhere, and harmless) but is no longer invoked from the new UI.
- BuyBackPracticeDashboard "Scheduled payment" display blocks stay as-is for backwards compatibility with any in-flight scheduled claims.

## Files touched
- `src/components/nres/hours-tracker/BuyBackPMLDashboard.tsx` — replace STATE 2 + STATE 3 blocks and shrink the step indicator.

No migration, no edge function changes, no impact on Director / Practice / Verifier views.

