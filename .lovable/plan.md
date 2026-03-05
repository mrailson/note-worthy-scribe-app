
## Fix: Info popover bleeding off the top of the screen

The popover on the countdown timer info icon (ℹ️) is set to `side="top"` on line 328, which pushes it above the viewport when the card is near the top of the page (as shown in the screenshot).

### Change
In `src/pages/PolicyServiceMyPolicies.tsx`, line 328:
- Change `side="top"` to `side="bottom"` and add `align="start"` so the popover opens downward and stays within the viewport.

This is a single-line fix.
