

# GP Locum Category for Buy-Back Claims

## Summary

Add a new **"GP Locum"** staff category that allows practices to record multiple locum GPs per month, respecting the £750/day maximum rate and the standard session length of 4 hours 10 minutes.

## How It Works for Practices

1. **Adding a Locum**: In the staff roster, select category **"GP Locum"**. Enter the locum's name, choose allocation type (Days or Sessions), and enter the value.
2. **Rate Rules**:
   - **Daily rate**: Capped at £750/day (8 hrs 20 mins = 2 sessions). If user enters more than £750, it is auto-capped.
   - **Session rate**: Fixed at £375/session (half of £750). A session = 4 hrs 10 mins.
   - **No on-costs** applied (locums are self-employed).
3. **Multiple Locums**: Each locum is a separate staff entry under the same practice and month — the existing multi-staff roster handles this naturally.
4. **Monthly Calculation**: Days × £750 (or Sessions × £375), pro-rated if they start mid-month (existing logic).

## Technical Changes

### 1. Database — Add `gp_locum` to `staff_category` allowed values
- Migration: `ALTER` column check constraint (or update app-level validation) to accept `'gp_locum'` alongside `'buyback'`, `'new_sda'`, `'management'`.

### 2. Types & Constants
- **`useNRESBuyBackStaff.ts`**: Extend `BuyBackStaffMember.staff_category` type to include `'gp_locum'`.
- **`useNRESBuyBackRateSettings.ts`**: No new role needed — GP Locum uses a hardcoded max daily rate of £750 and session rate of £375.

### 3. Calculation Engine (`useNRESBuyBackClaims.ts`)
- In `calculateStaffMonthlyAmount`: Add a check for `staff_category === 'gp_locum'`:
  - If `allocation_type === 'daily'`: `min(allocation_value, 750) × workingDaysInMonth`
  - If `allocation_type === 'sessions'`: `allocation_value × 375 × (workingDaysInMonth / 1)` — actually: sessions per week × 375 × working weeks, or simply sessions-per-day approach matching existing patterns.
- Ensure on-costs multiplier is always 1.0 for this category.

### 4. Add Staff Form (`BuyBackClaimsTab.tsx`)
- Add `"GP Locum"` option to the Category dropdown.
- When selected:
  - Role auto-set to **"GP Locum"** (read-only).
  - Allocation type limited to **Days** or **Sessions** only.
  - Daily rate input capped at £750 with validation message.
  - Session rate fixed at £375 (displayed, not editable).
- Show info tooltip: "1 Day = 2 sessions (8 hrs 20 mins). Max £750/day."

### 5. Edit Staff Dialog (`EditStaffDialog.tsx`)
- Same constraints as the add form when category is `gp_locum`.

### 6. Display & Badges
- `categoryBadge()`: Add orange badge **"GP Locum"** for the new category.
- `calcBreakdown()` and `buildCalcTooltip()`: Add locum-specific breakdown text, e.g. "2 days × £750/day × 21.67 working days".

### 7. Invoice/PDF & Excel Export
- Map `gp_locum` to display label "GP Locum" in invoice line items and Excel exports.
- GL code: Use same as GP or a separate one if configured.

### 8. Evidence Config
- `gp_locum` category uses same evidence requirements as `buyback` (or a dedicated set if needed — will default to buyback config).

