

## Plan: Fix Management Claim Calculation and Add Holiday Deduction

### What Changes

**1. Change the working weeks calculation for Management claims**

Currently the system counts weekdays in the month, subtracts bank holidays, then divides by 5. The user wants a simpler, straight calculation: count the Mon-Fri weeks in the month (e.g. a month with 20 weekdays = 4.0 weeks, 22 weekdays = 4.4 weeks). Bank holidays should **not** be subtracted from this count — the formula is purely weekdays ÷ 5.

The formula becomes:
```
(working_weeks - holiday_weeks) × hours_per_week × effective_hourly_rate
```

**2. Add "Holiday Weeks Taken" input per management staff member per month**

A new dropdown/input on each management claim card allowing the practice to enter 0, 0.5, 1, 1.5, or 2 weeks of holiday taken that month. This deducts from the working weeks before multiplying.

**3. Store holiday weeks on the claim record**

Add a `holiday_weeks_deducted` column (numeric, default 0) to `nres_buyback_claims` so the deduction is persisted and visible in all dashboards.

### Files to Change

| File | Change |
|------|--------|
| **New migration** | Add `holiday_weeks_deducted NUMERIC DEFAULT 0` to `nres_buyback_claims` |
| `src/hooks/useNRESBuyBackClaims.ts` | Remove bank holiday subtraction from management working weeks calc (lines 128-132). Apply `workingWeeks - holidayWeeks` in the formula. Pass `holiday_weeks_deducted` when creating claims. |
| `src/components/nres/hours-tracker/BuyBackClaimsTab.tsx` | Remove bank holiday subtraction from `getWorkingDaysInMonth` for management context. Update breakdown text to show holiday deduction instead of bank hols. |
| `src/components/nres/hours-tracker/BuyBackPracticeDashboard.tsx` | Add holiday weeks selector (0, 0.5, 1, 1.5, 2) per management staff card. Update the breakdown display (lines 818-856) to show the deduction. Pass the value into claim creation. |
| `src/components/nres/hours-tracker/BuyBackPMLDashboard.tsx` | Display holiday weeks deducted in the claim detail view |
| `src/components/nres/hours-tracker/BuyBackVerifierDashboard.tsx` | Display holiday weeks deducted in the claim detail view |
| `src/components/nres/hours-tracker/ClaimsUserGuide.tsx` | Update FAQ and help text to reflect the new calculation method |
| `src/utils/workingDays.ts` | No change needed — the utility stays; management claims just won't use the bank holiday subtraction |

### Calculation Example

April 2026: 22 weekdays = 4.4 working weeks.
- No holiday: 4.4 × 8 hrs × £85/hr = £2,992
- 1 week holiday: 3.4 × 8 hrs × £85/hr = £2,312
- 2 weeks holiday: 2.4 × 8 hrs × £85/hr = £1,632

### UI for Holiday Deduction

On each management staff card in the Practice Dashboard, below the hours/week display, a labelled dropdown:
- **"Holiday taken this month"**: 0 weeks (default), 0.5, 1, 1.5, 2 weeks
- The breakdown line updates live to show: `8 hrs/wk × 3.4 weeks (4.4 less 1 wk holiday) × £85/hr`

