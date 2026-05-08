## Goal
Add a third **Sessions/wk** option to the "Claim as" toggle in the SDA Claims Create-Draft panel, with the breakdown panel re-labelling itself for sessions when chosen. Also surface a quick "Total monthly" link in the top toggle row that jumps to / mirrors the corresponding monthly figure in the breakdown.

## Changes

### 1. Extend the "Claim as" toggle — three options
Toggle becomes: **WTE | Hours/wk | Sessions/wk** (sessions option only shown for session-priced GP roles to keep WTE-only roles uncluttered).

Override state: `overrideAllocType: 'wte' | 'hours' | 'sessions' | null` (existing 'sessions' allocation_type is already supported by the calculator).

Conversion when switching units (1 session = 4 h 10 m = `HOURS_PER_SESSION` = 25/6):
- WTE ↔ Hours: × / ÷ 37.5 (existing)
- Hours ↔ Sessions: ÷ / × 4.1667
- WTE ↔ Sessions: × / ÷ 9 (37.5 / 4.1667)

Caps:
- WTE: 1.0
- Hours: 37.5
- Sessions: 9

Input label/units update accordingly ("Max 9 sess/wk").

### 2. Sessions-mode in the breakdown panel
Rename the existing `hoursMode` block to a generic claim-mode panel that renders one of two variants:

**Hours mode** (current behaviour, unchanged labelling):
- "Hours claimed this month" + "Actual hourly rate paid (gross, excl. on-costs)"
- Cap on hourly rate: `annualRate / (52 × HOURS_PER_SESSION)` (e.g. £55.38/hr).

**Sessions mode** (new):
- "Sessions claimed this month" + "Actual session rate paid (gross, excl. on-costs)"
- Default monthly sessions = `sessionsPerWeek × workingWeeksInMonth`
- Cap on session rate: `annualRate / 52` (e.g. £230.77/session for £12k/session/yr)
- Derived amount = `actualSessionRate × sessionsClaimedMonth × onCostMultiplier`, capped at `calculatedAmount`
- Breakdown lines:
  - Staff cost (`N` sess × £R/sess) = £…
  - + Employer on-costs (× 1.2938) = £…
  - = Amount to claim this month

State: `sessionsClaimedMonth`, `actualSessionRate`. Reset effects mirror the hours-mode ones. The same `standardClaimedAmount`-sync effect handles both modes.

### 3. Top-section "Total monthly" link
Add a small underlined link beside the weekly value input in the Claim-as row that always shows the live monthly equivalent:
- Hours mode → "Total monthly: 36.50 hrs"
- Sessions mode → "Total monthly: 8.69 sess"
- WTE mode → hidden (monthly totals not used in the current panel below)

Clicking the link scrolls the breakdown panel into view and focuses the matching monthly input. Useful as a fast jump from the top toggle to the editable monthly figure.

### 4. Persistence
Extend the staff-line snapshot in `useNRESBuyBackClaims.createClaim` with two more optional fields, alongside the existing `claimed_hours_in_month` / `actual_hourly_rate_gross`:
- `claimed_sessions_in_month`
- `actual_session_rate_gross`

The Create Draft button attaches whichever pair is active.

### Out of scope
- Verifier / PML read-only views (will continue to display amount only; can add a follow-up to surface session metadata).
- WTE-mode breakdown (no editable per-period inputs there — unchanged).
- Non-session-priced roles do not get the Sessions/wk option.

## Technical notes
- File: `src/components/nres/hours-tracker/BuyBackPracticeDashboard.tsx` — extend toggle, generalise hours-mode block, add link, attach session metadata.
- File: `src/hooks/useNRESBuyBackClaims.ts` — add the two new optional fields to the staff snapshot mapping.
- Existing `getCalcBreakdown()` already handles `allocation_type === 'sessions'`, so the formula/breakdown box auto-recasts when the override switches to sessions — no change needed there.
- `rateParams.workingWeeksInMonth` (or `rawWorkingWeeksInMonth`) supplies the month-week multiplier.