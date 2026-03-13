
Goal: restore reliable manual scrolling in Ask AI after long responses, without reintroducing shaking.

What I found
- In `MessagesList.tsx`, the “break lock on upward scroll” logic is still tied to `!nearBottom` (`SCROLL_THRESHOLD = 150`), so small upward scrolls near the bottom do not release auto-scroll.
- Auto-scroll can still fire shortly after user interaction via delayed programmatic scroll paths.
- There is a nested scroll setup (`AI4GPService` wrapper uses `overflow-y-auto` while `MessagesList` also has `overflow-auto`), which can cause wheel/trackpad latching issues in some browsers.

Implementation plan
1) Fix lock release in `MessagesList.tsx` (primary root-cause fix)
- Track previous `scrollTop` with a ref.
- In `handleScroll`, detect upward intent by direction (`currentScrollTop < previousScrollTop`) and immediately set `autoScrollLocked.current = false` on any upward movement (not based on near-bottom threshold).
- Keep near-bottom re-engage logic so lock turns back on only when user returns to bottom.

2) Prevent delayed snap-backs
- Store the assistant auto-scroll timeout id in a ref.
- Clear pending timeout when the user scrolls up.
- Keep existing 300ms streaming throttle, but ensure no programmatic scroll runs once lock is released.

3) Ensure all programmatic scroll paths respect lock
- Verify/patch both:
  - “new assistant message” delayed scroll path
  - streaming auto-scroll path
- Both must early-return when `autoScrollLocked.current` is false.

4) Remove nested scroll conflict if needed (targeted fallback)
- In `AI4GPService.tsx`, change the immediate wrapper around `<MessagesList />` from `overflow-y-auto` to `overflow-hidden` so `MessagesList` is the sole scroll owner.
- This reduces wheel/trackpad event latching to the wrong ancestor.

Validation (desktop, long response)
- Start a long response and scroll up by 1–2 wheel notches: chat must immediately stop snapping to bottom.
- Continue scrolling up smoothly via wheel and trackpad.
- Let response finish, then verify scrolling still works both directions.
- Scroll back to bottom: auto-scroll should re-engage and “New response” button behavior remains correct.

Technical details
- File 1 (required): `src/components/ai4gp/MessagesList.tsx`
  - Add `previousScrollTopRef` and `pendingAutoScrollTimeoutRef`.
  - Update `handleScroll` to direction-based unlock.
  - Clear pending auto-scroll timer on manual upward scroll.
  - Guard all auto-scroll effects with lock state.
- File 2 (only if wheel/trackpad still inconsistent): `src/components/AI4GPService.tsx`
  - Make the parent wrapper non-scrollable (`overflow-hidden`) to avoid nested scroll ownership.
