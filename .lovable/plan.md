
# Fix Manage Access Modal: Scrolling and Default Access

## Issues
1. **No scroll on the modal body** -- the modal content overflows but the body area is not scrollable, so users cannot reach content below the fold.
2. **No default "All NRES Users" read access indicator** -- there should be a visible, persistent entry showing that all logged-in NRES Dashboard users have Viewer (read) access by default, until the user explicitly changes it.

## Changes

### 1. Make modal body scrollable (`VaultPermissionManager.tsx`)
- Wrap the main content `div` (currently `px-8 sm:px-10 py-6 space-y-6`) inside a `ScrollArea` with a max height (e.g. `max-h-[70vh]`) so the entire modal body scrolls when content exceeds the viewport.
- This ensures the "Add Permissions" section, divider, and "Current Permissions" list are all accessible via scroll.

### 2. Add default "All NRES Users -- Viewer" entry (`VaultPermissionManager.tsx`)
- In the "Current Permissions" section, always render a top-level read-only row before any explicit permissions:
  - **Label**: "All NRES Users" with a `Users` icon
  - **Badge**: "Viewer" (blue) 
  - **Note**: Small helper text like "Default access for all NRES Dashboard users"
  - This row is **not deletable** -- it serves as a visual indicator of the baseline access level
- This row appears regardless of whether explicit permissions exist, reinforcing that all NRES users can read by default unless overridden with "No Access".

### Technical Detail
- The `ScrollArea` component is already imported in the file.
- The modal body `div` at line 301 will be wrapped: `<ScrollArea className="max-h-[70vh]"><div className="px-8 sm:px-10 py-6 space-y-6">...existing content...</div></ScrollArea>`
- A new static row will be inserted at the top of the "Current Permissions" list, styled consistently with existing permission rows but with a distinct "default" visual treatment (e.g. subtle background, no delete button).
