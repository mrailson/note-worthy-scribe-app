

# Move Help & Settings Icons Inline with Title

## Summary
Remove the separate toolbar row from `NRESHoursTracker` and render the Help (?) and Settings (⚙) icons inline with the "Buy-Back Claims" title in each sub-dashboard. This saves vertical space and keeps actions contextually close to the heading.

## Approach
Pass `onGuideOpen` and `onSettingsOpen` callbacks (plus a `showSettings` boolean) from `NRESHoursTracker` → `BuyBackClaimsTab` → each sub-dashboard, then render the icon buttons in each dashboard's existing title row.

## Changes

### File 1: `src/components/nres/hours-tracker/NRESHoursTracker.tsx`
- Remove the toolbar `<div className="flex items-center gap-2">` block (lines 35–59)
- Pass new props to `BuyBackClaimsTab`: `onGuideOpen`, `onSettingsOpen`, `showSettings`

### File 2: `src/components/nres/hours-tracker/BuyBackClaimsTab.tsx`
- Extend the component's props to accept `onGuideOpen?: () => void`, `onSettingsOpen?: () => void`, `showSettings?: boolean`
- In the Admin header row (line ~891), add the help/settings icon buttons after the ADMIN badge
- Pass same props through to `BuyBackPracticeDashboard`, `BuyBackVerifierDashboard`, `BuyBackPMLDashboard`

### File 3: `src/components/nres/hours-tracker/BuyBackPracticeDashboard.tsx`
- Accept `onGuideOpen`, `onSettingsOpen`, `showSettings` props
- In the title row (line ~2035–2038), add small icon buttons after the NRES badge

### File 4: `src/components/nres/hours-tracker/BuyBackVerifierDashboard.tsx`
- Same pattern — add icon buttons inline with the title row (line ~519–522)

### File 5: `src/components/nres/hours-tracker/BuyBackPMLDashboard.tsx`
- Same pattern — add icon buttons inline with the title row (line ~818–821)

## Button style
Small inline icon buttons matching the existing design language — subtle outline style, ~20px, sitting right after the role badge in the title row. Consistent across all four dashboard views.

