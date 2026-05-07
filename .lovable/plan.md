## Goal
Add a centred link in the blue header bar that opens the Primary Care 2026/27 briefing inside the app (header stays visible above it), with a short title that makes its currency obvious and a "New" badge.

## Changes

### 1. New in-app route for the briefing
- Create `src/pages/PrimaryCare2026Briefing.tsx`:
  - Renders the standard `<Header />` at the top.
  - Below it, a full-height `<iframe src="/gms-2026.html" title="Primary Care Contracts 2026/27 Briefing">` filling the remaining viewport (`flex-1`, no border) so the briefing scrolls beneath the sticky blue bar.
  - Reuses the existing static `public/gms-2026.html` unchanged.
- Register a public route in `src/App.tsx`:
  - `<Route path="/briefings/primary-care-2026" element={<PrimaryCare2026Briefing />} />`
  - No `ProtectedRoute` — viewable while logged out.

### 2. Centre link in the blue header bar
- Edit `src/components/Header.tsx`.
- Insert a centred element between the left "Notewell AI" title and the right-hand nav cluster (absolute-centred on `sm+`; on mobile, a compact pill placed next to the title).
- Element is a `<Link to="/briefings/primary-care-2026">` styled as a translucent white pill on the blue bar:
  - Desktop label: **"May 2026 Update — Primary Care 2026/27 Briefing"**
  - Mobile label: **"May 26 Update — PC 2026/27"**
  - Small accent-coloured `NEW` badge (`bg-accent text-accent-foreground`) on the left.
  - Subtle hover lift.
- Visible to both logged-in and logged-out users (placed outside any `{user && …}` blocks).

### 3. Update the logged-out "Latest News" card
- In `src/pages/Index.tsx`, change the existing GMS/PCN news card from `<a href="/gms-2026.html" target="_blank">` to `<Link to="/briefings/primary-care-2026">` so it opens in-app under the header. Wording, "New" badge and "May 2026" date stay as-is.

## Technical notes
- Iframe approach avoids porting the standalone HTML into React; the sticky blue Header sits above and the iframe scrolls internally.
- Wrapper uses `flex flex-col min-h-[100dvh]` with the iframe `flex-1 w-full` so no hard-coded header height is needed.
- No business-logic, auth, or DB changes.

## Out of scope
- No edits to the briefing content itself (`public/gms-2026.html` unchanged).
- The existing news card on the logged-out page remains as a secondary entry point.
