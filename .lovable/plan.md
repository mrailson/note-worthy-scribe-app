

## Plan: Add Privacy Notice & Accessibility Statement as Public Pages

### What This Does
Adds the two uploaded HTML documents as publicly accessible pages at `/privacy-notice` and `/accessibility-statement`, and adds links to them in the logged-out homepage footer area (the governance trust bar section).

### Changes

#### 1. Copy HTML files to `public/documents/`
- Copy `privacy-notice.html` → `public/documents/privacy-notice.html`
- Copy `accessibility-statement.html` → `public/documents/accessibility-statement.html`

#### 2. Create two new page components
- `src/pages/PrivacyNotice.tsx` — renders the HTML in an iframe (same pattern as `GPContract.tsx`), with a back button, print, and download controls.
- `src/pages/AccessibilityStatement.tsx` — same pattern.

#### 3. Add public routes in `App.tsx`
- `/privacy-notice` → `<PrivacyNotice />` (no `ProtectedRoute` wrapper)
- `/accessibility-statement` → `<AccessibilityStatement />` (no `ProtectedRoute` wrapper)

#### 4. Add links to the logged-out homepage
- In `src/pages/Index.tsx`, below the governance trust bar (around line 522), add a small footer row with links: "Privacy Notice" and "Accessibility Statement", styled as subtle text links consistent with the existing trust bar aesthetic.

