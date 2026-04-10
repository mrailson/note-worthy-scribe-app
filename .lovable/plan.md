

## Plan: Calculate Management Hours Based on Actual Working Days per Month

### Problem
Currently, all claim amounts are calculated by dividing the annual rate by 12 (flat monthly). For management claims, the user wants the monthly hours to be based on the actual number of working weeks in the claim month — excluding weekends **and** bank holidays from the `bank_holidays_closed_days` table.

**Example**: If a management role has `max_hours_per_week = 8` and the claim month has 20 working days (4 exact weeks), the total hours for that month = 8 × 4 = 32 hours.

### What changes

**1. New utility function: `getWorkingDaysInMonth`** (`src/utils/workingDays.ts`)
- Takes a `claimMonth` string (e.g. `2026-04-01`)
- Counts weekdays (Mon-Fri) in that month
- Fetches bank holidays from `bank_holidays_closed_days` that fall in that month and subtracts them
- Returns the number of working days

**2. New helper: `getWorkingWeeksInMonth`** (`src/utils/workingDays.ts`)
- Divides working days by 5 to get the precise number of working weeks (e.g. 20 days = 4.0 weeks, 22 days = 4.4 weeks)

**3. Update `calculateStaffMonthlyAmount`** (`src/hooks/useNRESBuyBackClaims.ts`)
- For management category staff (detected via `staff_category === 'management'` or `staff_role === 'NRES Management'`):
  - Instead of `÷ 12`, calculate as: `hourly_rate × max_hours_per_week × working_weeks_in_month`
  - This replaces the annual-rate-divided-by-12 approach for management lines only
- Non-management claims continue using `÷ 12` as before
- The function signature will accept an optional `workingWeeks` parameter (pre-calculated and passed in)

**4. Update `calcBreakdown` display** (`src/components/nres/hours-tracker/BuyBackClaimsTab.tsx`)
- For management lines, show: `8 hrs/wk × 4.0 working weeks × £30/hr = £960.00` (or similar)
- Include a note about bank holidays excluded if any fall in the month

**5. Fetch bank holidays at claim creation/display time**
- In the claims tab component, fetch bank holidays once and pass working-weeks data down to the calculation functions
- Use the existing `bank_holidays_closed_days` table (already populated in the system)

### Technical detail

```text
Monthly hours = max_hours_per_week × (working_days_in_month / 5)

working_days_in_month = weekdays_in_month - bank_holidays_in_month

Example: April 2026
  Total weekdays: 22
  Bank holidays: 1 (Good Friday 3rd April? or Easter Monday 6th)
  Working days: 21
  Working weeks: 21 / 5 = 4.2
  Hours at 8 hrs/wk: 8 × 4.2 = 33.6 hours
  Amount at £30/hr: £30 × 33.6 = £1,008.00
```

### Files to modify
- `src/utils/workingDays.ts` — add `getWorkingDaysInMonth` and `getWorkingWeeksInMonth`
- `src/hooks/useNRESBuyBackClaims.ts` — update `calculateStaffMonthlyAmount` for management category
- `src/components/nres/hours-tracker/BuyBackClaimsTab.tsx` — update breakdown display, fetch bank holidays, pass working weeks

