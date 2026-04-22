

## Plan: Enable Claim Expansion in Admin View and Update Title

### What Changes

**1. Update the Admin section title**
- Change "Buy-Back & Claims" with the "ADMIN" badge to read **"Claims - Notewell Admin View"**
- Remove the separate "ADMIN" badge pill since the title itself now indicates admin context
- Update the subtitle from "System Admin View — Manage staff, create and review claims across all practices" to something shorter, e.g. "Manage staff, create and review claims across all practices"

**2. Enable individual claim expansion in Admin view**
- Add `expandedClaimId` state (currently hardcoded to `null`) in the admin section of `BuyBackClaimsTab.tsx`
- Wire the `onToggleCard` callback to toggle the expanded claim, matching the behaviour in the Practice view
- This will allow admins to click on a claim row in the Individual Claim View and see the full detail panel (evidence, query responses, staff line breakdown, etc.)

### Files Modified

- `src/components/nres/hours-tracker/BuyBackClaimsTab.tsx` — title text update (~line 1068), add `expandedClaimId` state, update `onToggleCard` and `expandedClaimId` props passed to `ClaimsViewSwitcher` (~lines 1378-1393)

### No database or migration changes required.

