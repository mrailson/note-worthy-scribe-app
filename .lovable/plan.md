

# Fix: Document Vault Tab Not Visible

## Problem
The "Document Vault" tab IS in the code and renders correctly, but on your screen width the tab bar overflows and the `no-scrollbar` CSS class hides the scrollbar. This means the third tab is off-screen to the right with no visual cue that you can scroll to it.

## Solution
Make the NRES Dashboard's main tab list wrap or display more compactly so all three tabs are always visible without scrolling.

### Changes

**1. Update `NRESDashboard.tsx` - Add `flex-wrap` to the TabsList**
- Add a className override to the `TabsList` in the NRES Dashboard to allow wrapping, e.g. `className="flex-wrap h-auto"` so all three tabs are visible on narrower screens.
- Alternatively, shorten the tab labels on smaller screens (e.g. "Vault" instead of "Document Vault") to fit.

**2. Approach: Allow the tab bar to wrap**
- Override the `TabsList` with `className="flex-wrap h-auto gap-1"` so that on narrow screens, tabs wrap to a second row rather than being hidden off-screen.
- This is a single-line change and consistent with how the sub-tabs in Claims & Oversight already work.

### Technical Detail

```tsx
// In NRESDashboard.tsx, line 72
<TabsList className="mb-4 flex-wrap h-auto gap-1">
```

This ensures all three tabs (Dashboard, Claims & Oversight, Document Vault) are always visible regardless of screen width.

