

## Plan: Add On-Costs Toggle and Daily Rate Allocation Type

### What This Does
1. **Inc/Excl On-Costs per role** — Each staff role gets a flag indicating whether on-costs (Employer NI + Pension) apply. Employed staff include on-costs; locums exclude them. This carries through all calculations, hover tooltips, invoices, and cost breakdowns.
2. **Daily Rate allocation type** — A new "daily" allocation option alongside sessions/hours/WTE, with a max daily rate value. GPs default to this.

### Changes Required

**1. Update `RoleConfig` interface** (`src/hooks/useNRESBuyBackRateSettings.ts`)
- Add `includes_on_costs: boolean` (default `true`) to `RoleConfig`
- Add `'daily'` to the `allocation_default` union type
- Add optional `daily_rate?: number` field for roles using daily allocation
- Update `DEFAULT_ROLES`: GP gets `allocation_default: 'daily'`, `daily_rate: 800` (or similar max), `includes_on_costs: false` for locum-type roles
- Add new roles like "GP Locum" with `includes_on_costs: false` if needed, or keep it per-role configurable

**2. Update `BuyBackStaffMember` interface** (`src/hooks/useNRESBuyBackStaff.ts`)
- Add `'daily'` to the `allocation_type` union: `'sessions' | 'wte' | 'hours' | 'daily'`

**3. Update rate settings admin UI** (`src/components/nres/hours-tracker/CostBreakdownSection.tsx` and rates config UI)
- Add an "Inc. On-Costs" toggle/checkbox column per role in the rates table
- Show/hide the on-costs columns based on each role's setting
- Add "Daily" as an allocation default option
- Add a "Max Daily Rate (£)" input when daily is selected

**4. Update calculation logic** (`src/hooks/useNRESBuyBackClaims.ts`)
- In `calculateStaffMonthlyAmount`: when `allocation_type === 'daily'`, calculate as `daily_rate × working_days_in_month`
- Check role's `includes_on_costs` flag — if `false`, skip the `onCostMultiplier` (use multiplier of 1.0)
- Pass `includes_on_costs` through `rateParams` or derive from role config

**5. Update hover tooltip** (`BuyBackClaimsTab.tsx` — `buildCalcTooltip`)
- For daily rate: show "X days × £Y/day = £Z/month"
- When on-costs excluded: show "On-costs: Excluded (Locum)" instead of the NI/Pension breakdown
- When included: show as current with "On-costs: Included (Employed Staff)"

**6. Update staff add/edit forms** (`BuyBackClaimsTab.tsx`, `EditStaffDialog.tsx`)
- Add "Daily" option to the allocation type dropdown
- When "daily" selected, max value = max daily rate from role config
- Step = 1 for daily

**7. Update claim line display** (`BuyBackClaimsTab.tsx`)
- Show "X daily" alongside existing "X sessions", "X hrs/wk", "X WTE" labels
- Display "(excl. on-costs)" or "(inc. on-costs)" indicator on the amount

**8. Update CostBreakdownSection** (`CostBreakdownSection.tsx`)
- Add column or indicator showing which roles include/exclude on-costs
- Calculate hourly equiv differently for excluded roles (no on-costs added)
- Handle daily rate rows appropriately

### Files Modified
- `src/hooks/useNRESBuyBackRateSettings.ts` — types, defaults
- `src/hooks/useNRESBuyBackStaff.ts` — interface update
- `src/hooks/useNRESBuyBackClaims.ts` — calculation logic
- `src/components/nres/hours-tracker/BuyBackClaimsTab.tsx` — UI, tooltips, forms
- `src/components/nres/hours-tracker/EditStaffDialog.tsx` — daily option
- `src/components/nres/hours-tracker/CostBreakdownSection.tsx` — on-costs column

### Technical Notes
- The `includes_on_costs` flag is stored on the `RoleConfig` in `nres_buyback_rate_settings` (JSONB), so no database migration needed
- Daily rate calculation: `daily_rate × working_days_per_month` (approx 21.67 days or derived from the specific month)
- Existing claims with sessions/hours/WTE continue to work unchanged

