

# Restrict "Admin" Preview Mode for PML Director and PML Finance

## What changes

Andrew Moore (PML Director) and Maria (PML Finance) currently see the full "Preview as" bar including the "Admin" option. We need to:

1. **Hide the "Admin" pill** from users who are PML Director or PML Finance but not Super Admin or Management Lead
2. **Set default preview role** to `pml_director` for Andrew and `pml_finance` for Maria (based on their system role, not hardcoded emails)

## Technical approach

### 1. `TestModeBar.tsx` — accept a `hiddenRoles` prop and filter options

- Add an optional `hiddenRoles?: TestRole[]` prop
- Filter `ROLE_OPTIONS` to exclude any roles in `hiddenRoles` before rendering pills
- The reset button should go to the first available role instead of always `'admin'`

### 2. `BuyBackClaimsTab.tsx` — pass role-aware defaults and restrictions

- Compute `defaultTestRole` based on system roles: if `isPMLDirector` (and not super_admin/management_lead) → `'pml_director'`; if `isPMLFinance` (and not super_admin/management_lead) → `'pml_finance'`; otherwise → `'admin'`
- Compute `hiddenRoles`: if the user is PML Director or PML Finance (but not super_admin or management_lead), hide `'admin'` from the list
- Initialise `testMode` with the computed default role
- Pass `hiddenRoles` to `TestModeBar`

### Files changed
1. **`src/components/nres/hours-tracker/TestModeBar.tsx`** — add `hiddenRoles` prop, filter role options
2. **`src/components/nres/hours-tracker/BuyBackClaimsTab.tsx`** — compute default role and hidden roles based on system roles, pass to TestModeBar

