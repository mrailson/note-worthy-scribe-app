## Goal

In the claim modal's "Claim as" panel, drop the WTE option entirely. Replace the three-way toggle with two controls:

1. **Period slider**: Weekly ↔ Monthly
2. **Unit toggle**: Hours / Sessions (Sessions only shown for session-priced GP roles)

The right-hand input then auto-relabels:
- Weekly + Hours → "hrs/wk"
- Weekly + Sessions → "sess/wk"
- Monthly + Hours → "hrs/month"
- Monthly + Sessions → "sess/month"

Whatever the user types becomes the **default monthly hours/sessions** that drives the breakdown panel below. The breakdown still shows the auto-derived monthly amount and lets the user adjust hours/sessions and the actual rate paid, capped at the role's funded maximum (e.g. £55.38/hr or £230.77/sess for a £12k/yr session GP).

## Changes (single file: `BuyBackPracticeDashboard.tsx`)

### 1. State refactor
Replace `overrideAllocType: 'wte' | 'hours' | 'sessions' | null` with:
- `claimPeriod: 'weekly' | 'monthly'` (default `'weekly'`)
- `claimUnit: 'hours' | 'sessions'` (default mirrors current staff allocation; falls back to hours if not session-priced)
- `claimPeriodValue: number` (the figure the user types — interpreted per current period+unit)

Drop all WTE branches in the override block (lines ~1121-1240). `hoursMode` / `sessionsMode` become driven by `claimUnit` rather than `overrideAllocType`.

### 2. Conversion helpers
- `HOURS_PER_SESSION = 4 + 10/60`
- `weeksInMonth = rateParams.rawWorkingWeeksInMonth ?? 52/12`
- Convert the typed value into a canonical **weekly hours** number (used everywhere downstream that currently reads `effectiveStaff.allocation_value`):
  - weekly+hours → value
  - weekly+sessions → value × HOURS_PER_SESSION
  - monthly+hours → value / weeksInMonth
  - monthly+sessions → (value / weeksInMonth) × HOURS_PER_SESSION
- `effectiveStaff.allocation_type` becomes `'hours'`; `allocation_value` = canonical weekly hours.

### 3. UI in the override panel
```text
Claim as   [ Weekly ●──────○ Monthly ]   [ Hours | Sessions ]   [ 8.69 ] hrs/wk   Max 37.5 hrs/wk
                                                                                   Reset to default
```
- Period: shadcn `Switch` or a two-button segmented control acting as a slider (Weekly left / Monthly right).
- Unit: two-button segmented control. "Sessions" hidden when role isn't session-priced.
- Right-side numeric input + dynamic suffix label.
- "Max" hint recomputes per period+unit (e.g. Monthly+Sessions → "Max ~39 sess/month").
- Keep the existing "Total monthly: X hrs · X sess" quick links so users can see the cross-unit equivalent at a glance.

### 4. Breakdown panel (below)
No structural change — it continues to show:
- Sessions/Hours claimed this month (editable, defaults to value derived from the slider/unit input)
- Actual rate paid (editable, capped at role max)
- Auto-calculated amount, capped at monthly maximum

When the user changes the top slider/unit/value, the "claimed this month" field re-defaults (same `useEffect` pattern already in place, just keyed off the new canonical values).

### 5. Cleanup
- Remove WTE button, WTE conversion ratios, `overrideAllocType === 'wte'` branches, and the WTE-only "Max 1.0 WTE" label.
- Persistence (`useNRESBuyBackClaims.ts`) is unchanged — claim still snapshots `claimed_hours_in_month` / `actual_hourly_rate_gross` or the sessions equivalents.

## Out of scope
- WTE display elsewhere on the dashboard (header chips, summary tiles) stays as-is.
- Non-session-priced roles keep the standard amount input (no breakdown panel).
- No DB schema changes.