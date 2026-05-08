## Goal

In the Hours-mode and Sessions-mode breakdown panels, make the "Amount to claim this month" line directly editable so the practice can claim **any value from £0 up to the smaller of**:
- the auto-derived amount (`hours × actualHourlyRate × on-costs` or `sessions × actualSessionRate × on-costs`), and
- the monthly maximum (`calculatedAmount`)

Today this row is read-only and always shows the auto-derived value. If a practice's true cost is lower than the cap, they should be able to type that lower figure; if they try to type higher, it must clamp to the cap.

## Changes (single file: `BuyBackPracticeDashboard.tsx`)

### 1. Make the amount row editable
Replace the static `<span>` showing `{fmtGBP(standardClaimedAmount)}` inside both the Hours-mode panel (~line 1424) and the Sessions-mode panel (~line 1526) with an inline `£ [number input]` field bound to `standardClaimedAmount`.

### 2. Dynamic cap
Compute `derivedAmount = actualRate × quantity × onCostMultiplier` and `effectiveCap = Math.min(derivedAmount, calculatedAmount)`. The input's `max` attribute and onChange clamp use `effectiveCap`. Round to 2dp.

### 3. Sync behaviour
The existing effect (lines ~556-566) auto-syncs `standardClaimedAmount` to the derived/capped value whenever hours, sessions, or rate change. Keep that — it re-defaults the field. But the user can then manually type a lower value. To avoid the effect immediately overwriting a user-typed lower value, add a small "user has manually edited" sentinel that resets whenever any of the upstream inputs change (hours/sessions/rate/period/unit). After a manual edit, the field stays at the typed value until the user changes an upstream input again.

### 4. Helper hint copy
Update the helper line under each panel:
- If `standardClaimedAmount < derivedAmount`: "Claiming £X of £Y derived. Max claimable this month £Z."
- If derived > cap: keep existing "Capped at the monthly maximum…" message.
- Otherwise: existing "Auto-calculated…" message.

### 5. Out of scope
- The standard (non-hours, non-sessions) editable amount field already supports this behaviour and isn't touched.
- WTE-mode logic, persistence schema, and verifier read-only views are unchanged.