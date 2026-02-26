
# Buy-Back Rate Settings & Role Management

## Overview

Add a new **"Rates & Roles"** tab inside the existing Settings cog modal (alongside the current access permissions grid). This tab allows admins to:

1. **Configure base annual rates per role** (e.g. GP = £11,000/session, ANP = £55,000, ACP = £50,000)
2. **Edit the employer on-costs percentage** (currently fixed at 29.38%)
3. **Add or delete staff role types** (currently hardcoded as GP, ANP, ACP, Practice Nurse, HCA, Pharmacist, Other)
4. **View a cost breakdown table** showing annual base, on-costs, total annual cost, and equivalent hourly locum rate per role

---

## What Changes

### 1. New Database Table: `nres_buyback_rate_settings`

A single-row config table storing the rates, on-costs percentage, and role definitions:

```text
id              TEXT (PK, default 'default')
on_costs_pct    NUMERIC (default 29.38)
roles_config    JSONB — array of { key, label, annual_rate, allocation_default, working_hours_per_year }
updated_at      TIMESTAMPTZ
updated_by      UUID
```

`roles_config` example:
```json
[
  { "key": "gp", "label": "GP", "annual_rate": 11000, "allocation_default": "sessions", "working_hours_per_year": 1950 },
  { "key": "anp", "label": "ANP", "annual_rate": 55000, "allocation_default": "hours", "working_hours_per_year": 1950 },
  { "key": "acp", "label": "ACP", "annual_rate": 50000, "allocation_default": "hours", "working_hours_per_year": 1950 },
  { "key": "practice_nurse", "label": "Practice Nurse", "annual_rate": 35000, "allocation_default": "hours", "working_hours_per_year": 1950 },
  { "key": "hca", "label": "HCA", "annual_rate": 25000, "allocation_default": "hours", "working_hours_per_year": 1950 },
  { "key": "pharmacist", "label": "Pharmacist", "annual_rate": 45000, "allocation_default": "hours", "working_hours_per_year": 1950 }
]
```

Working hours per year defaults to 1,950 (37.5 hrs/wk x 52 weeks) and is used to derive the hourly locum equivalent.

RLS: Admin-only write, authenticated read (same pattern as access table).

### 2. New Hook: `useNRESBuyBackRateSettings`

- Fetches the rate settings from the new table (falls back to current hardcoded defaults if no row exists)
- Provides `updateSettings(onCostsPct, rolesConfig)` for saving
- Exposes derived values: `getAnnualRate(roleKey)`, `getRoleConfig(roleKey)`, `staffRoles` (list of role labels for dropdowns)

### 3. Updated Settings Modal: Add "Rates & Roles" Tab

The existing `BuyBackAccessSettingsModal` gains a second tab:

- **Tab 1: "Access Permissions"** — the existing user/practice/role grid (no change)
- **Tab 2: "Rates & Roles"** — new content:

**Section A: Employer On-Costs**
- Editable input for the on-costs percentage (default 29.38%)

**Section B: Role Management**
- Table showing each role with: Label, Base Annual Rate (editable input), Allocation Default (sessions/hours/wte dropdown)
- "Add Role" button to add a new custom role
- Delete button per role (with confirmation, prevents deleting if role is in use by active staff)

**Section C: Cost Breakdown Table** (read-only, auto-calculated)

| Role | Base Annual | On-Costs (%) | On-Costs (£) | Total Annual | Equiv. Hourly Locum Rate |
|------|------------|-------------|-------------|-------------|------------------------|
| GP (per session) | £11,000 | 29.38% | £3,231.80 | £14,231.80 | £7.30/hr |
| ANP (1.0 WTE) | £55,000 | 29.38% | £16,159.00 | £71,159.00 | £36.49/hr |
| ACP (1.0 WTE) | £50,000 | 29.38% | £14,690.00 | £64,690.00 | £33.17/hr |
| ... | ... | ... | ... | ... | ... |

Hourly rate = Total Annual / Working Hours Per Year (default 1,950).

For GP sessions specifically, the table will note "per session/year" and the hourly equivalent will be calculated as total annual per session / (1,950 / 9) = per session hours.

### 4. Update Calculation Logic

Modify `useNRESBuyBackClaims.ts` to use the configurable rates instead of hardcoded constants:

- Replace `GP_SESSION_ANNUAL = 11000 * 1.2938` with a lookup from rate settings
- Replace `WTE_ANNUAL = 60000 * 1.2938` with role-specific annual rate x on-costs
- The `calculateStaffMonthlyAmount` function will accept a rate config parameter

Similarly update `BuyBackClaimsTab.tsx` where `calcBreakdown()` and `buildCalcTooltip()` reference hardcoded values.

### 5. Update Staff Role Dropdown

Replace the hardcoded `STAFF_ROLES` array in `BuyBackClaimsTab.tsx` with the dynamic list from the rate settings hook, so new roles added in settings automatically appear in the "Add Staff" form.

---

## Technical Details

### Database Migration

```sql
CREATE TABLE public.nres_buyback_rate_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  on_costs_pct NUMERIC NOT NULL DEFAULT 29.38,
  roles_config JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.nres_buyback_rate_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read rate settings"
  ON public.nres_buyback_rate_settings FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins can manage rate settings"
  ON public.nres_buyback_rate_settings FOR ALL
  TO authenticated
  USING (public.is_nres_admin(auth.uid()))
  WITH CHECK (public.is_nres_admin(auth.uid()));

-- Seed default row
INSERT INTO public.nres_buyback_rate_settings (id, on_costs_pct, roles_config)
VALUES ('default', 29.38, '[
  {"key":"gp","label":"GP","annual_rate":11000,"allocation_default":"sessions","working_hours_per_year":1950},
  {"key":"anp","label":"ANP","annual_rate":55000,"allocation_default":"hours","working_hours_per_year":1950},
  {"key":"acp","label":"ACP","annual_rate":50000,"allocation_default":"hours","working_hours_per_year":1950},
  {"key":"practice_nurse","label":"Practice Nurse","annual_rate":35000,"allocation_default":"hours","working_hours_per_year":1950},
  {"key":"hca","label":"HCA","annual_rate":25000,"allocation_default":"hours","working_hours_per_year":1950},
  {"key":"pharmacist","label":"Pharmacist","annual_rate":45000,"allocation_default":"hours","working_hours_per_year":1950}
]'::jsonb);
```

### Files to Create

1. `src/hooks/useNRESBuyBackRateSettings.ts`

### Files to Modify

1. `src/components/nres/hours-tracker/BuyBackAccessSettingsModal.tsx` — add Tabs with "Access Permissions" and "Rates & Roles" tabs, rename to `BuyBackSettingsModal` (or keep name, add tab)
2. `src/hooks/useNRESBuyBackClaims.ts` — replace hardcoded rate constants with configurable lookups
3. `src/components/nres/hours-tracker/BuyBackClaimsTab.tsx` — use dynamic role list from settings; update `calcBreakdown` and `buildCalcTooltip` to use configurable rates
