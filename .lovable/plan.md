

## Plan: Apply ENN Compact Header Style to NRES Dashboard

### What Changes

**1. Create `src/components/nres/NRESHeader.tsx`**
A new compact 48px sticky header, mirroring `ENNHeader.tsx` exactly but with NRES branding:
- Left: "Notewell AI ✦" logo → divider → "Rural East & South" → "SDA Programme" subtitle
- Right: "Go-Live: 1st April 2026" green pill, Home, Services dropdown, User menu, Feedback icon
- Same auth/navigation logic as ENNHeader

**2. Update `src/pages/SDADashboard.tsx`**
- Remove `<Header />` import and the tall hero section (lines 30–52)
- Add `<NRESHeader activeTab={activeTab} />` in its place
- Replace the floating `TabsList` with a slim sticky `<nav>` bar (white background, `sticky top-12 z-40`, bottom border) using plain `<button>` elements — identical pattern to ENNDashboard lines 60–90
- Keep all `TabsContent` blocks and content components completely unchanged
- Remove `SDAFeedbackButton` import (feedback moves into the header icon)

### What Does NOT Change
- `Header.tsx` — untouched, still used by other pages
- All tab content components (SDAExecutiveSummary, SDAEstatesCapacity, etc.)
- All NRES data, providers, and business logic
- ENN dashboard — completely unaffected

### Responsiveness
- Compact header uses `truncate`, `hidden sm:inline`, `hidden md:inline` — proven patterns from ENNHeader
- Tab bar uses `overflow-x-auto no-scrollbar` with `shrink-0` tabs — scrollable on small screens, wraps naturally on larger ones
- Saves ~80px vertical space, benefiting 1366×768 NHS laptop viewports

