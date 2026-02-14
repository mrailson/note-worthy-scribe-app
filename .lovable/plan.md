
# Mobile Translation Service Redesign

## Problem
The `ReceptionTranslationView` (3,284 lines) was built for desktop with wide toolbars, sidebars, multiple button rows, and two-column chat layouts. Adding `embedded={true}` only changed CSS positioning — it didn't adapt any of the layout for small screens. On a phone, everything overflows, buttons wrap badly, and controls are unreachable.

## Solution
Rather than trying to make the massive desktop component responsive (which would be fragile and bloat it further), we will detect mobile viewports inside `ReceptionTranslationView` and conditionally render a simplified mobile layout. This means:

- Same component, same hooks, same state — just different JSX for the render
- No code duplication of business logic
- Mobile users get a clean, purpose-built interface

## Mobile Layout Design

### Header (compact, single row)
- Language badge (flag + name) on the left
- Three icon-only buttons on the right: QR, Report download, End Session
- No "Live Chat / Document Translate" tabs (live chat only on mobile — document translate accessible via a small toggle if enabled)
- No chat view mode selector (always single-column)
- No history button in header (accessible from overflow menu)

### Chat Area (single column, full width)
- Messages stacked vertically — each bubble shows both the original text and translation stacked
- GP messages aligned left (blue), patient messages aligned right (green/slate)
- No side-by-side columns
- Smooth scroll with `WebkitOverflowScrolling: 'touch'`
- Confirmation UI (edit/send/discard) renders inline as a card, not a two-column split

### Bottom Toolbar (sticky, safe-area-aware)
- Speaker mode toggle: two pill buttons — "You" / "Patient" — with active state highlighting
- Large central mic button (64px round)
- Pause/Resume button beside mic when listening
- `pb-safe` padding for notched iPhones

### Hidden on Mobile
- QR sidebar (use modal via header icon instead)
- Chat view mode icons (always single-column)
- "Voice On/Off" button (auto-play controlled via settings)
- Patient connection status badge (shown as a subtle dot on the header instead)
- System audio capture controls

## Technical Approach

### Step 1: Add mobile detection to ReceptionTranslationView
Use `window.innerWidth < 768` (consistent with existing mobile checks in the codebase) to set an `isMobile` flag at the top of the component.

### Step 2: Create a mobile render branch
Add a `renderMobileLayout()` function inside the component that returns the mobile-optimised JSX. The main return will check `if (isMobile && embedded) return renderMobileLayout()`.

### Step 3: Mobile-specific JSX
The mobile layout will reuse all existing state, handlers, and refs — it just arranges the UI differently:

- **Header**: Single row with `flex items-center justify-between px-3 py-2`
- **Chat**: `ScrollArea` with `flex-1 min-h-0` taking remaining space
- **Message bubbles**: Full-width cards with original + translated text stacked
- **Bottom bar**: `fixed bottom-0` or `sticky` with speaker pills + mic button
- **Confirmation flow**: Stacked vertically (textarea, then row of buttons)
- **QR modal**: Reuse existing `Dialog` for expanded QR

### Step 4: Update AI4GPService wrapper
Ensure the translation panel container in `AI4GPService.tsx` passes height correctly on mobile with `h-full` and proper flex containment.

## Files to Modify

1. **`src/components/admin-dictate/ReceptionTranslationView.tsx`** — Add `isMobile` detection and a `renderMobileLayout()` function that returns mobile-optimised JSX using the same state/handlers
2. **`src/components/AI4GPService.tsx`** — Minor tweak to ensure the translation container fills the viewport on mobile

## What Stays the Same
- All backend logic (Supabase channels, TTS, translation, moderation)
- Session setup flow (`LiveTranslationSetupModal`)
- Report generation
- Training mode support
- All existing desktop layout (unchanged for non-mobile)
