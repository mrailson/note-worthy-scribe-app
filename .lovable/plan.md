

## Problem

On high-scaling laptops (e.g. 1280x720 effective resolution), the Ask AI home screen shows the category grid clipped — only ~2 rows visible before running into the input area. On normal/larger screens, all 4 rows display comfortably. The difference comes from the vertical space consumed by: page header, card header (with tabs), role toggle row, and the fixed input area at the bottom.

The home screen area (`flex-1 overflow-y-auto`) should scroll, but the grid is inside a `max-w-2xl` container with padding, and on small viewports there isn't enough room. The key issue is that the welcome screen content area **does scroll** (`overflow-y-auto` on line 846), so all categories are technically accessible — but on cramped screens the user doesn't realize they can scroll, and the view looks broken.

## Plan

### 1. Make the category grid adapt to available height

In `GPHomeScreen.tsx`, change the main category grid from a fixed 3-column layout to one that responds to available vertical space:

- Use **`grid-cols-3 sm:grid-cols-4 lg:grid-cols-5`** for the main category grid (line 219) so that on wider screens, categories fit in fewer rows (2 rows of 5 instead of 4 rows of 3).
- Remove or reduce the `max-w-2xl` constraint on the grid wrapper (currently in `AI4GPService.tsx` line 849) — widen it to `max-w-3xl` or `max-w-4xl` to give the wider grid room.

### 2. Compact the vertical spacing on small viewports

In `AI4GPService.tsx`, the welcome screen wrapper (line 847) uses `space-y-2 sm:space-y-3` and `p-2 sm:p-4`. Tighten:
- Reduce padding: `p-1 sm:p-4`
- Reduce vertical gaps between role toggle and grid: `mb-1` → `mb-0` on the role toggle row (line 861), `gap-3` → `gap-2`.

### 3. Reduce card height for compact screens

In `GPHomeScreen.tsx`, the cards use `min-h-[40px]` and `p-2`. For smaller viewports, reduce to `min-h-[36px]` and `p-1.5` using responsive classes, keeping the current size on larger screens.

### 4. Add a subtle scroll indicator

When the home screen content overflows, add a small fade gradient at the bottom of the scrollable area (CSS pseudo-element or a conditional div) so users on cramped screens know there's more content below.

## Files to modify

- `src/components/ai4gp/GPHomeScreen.tsx` — wider grid columns, compact card sizing
- `src/components/AI4GPService.tsx` — widen max-w constraint, tighten vertical spacing, add scroll fade indicator
- Optionally `src/components/ai4gp/PMHomeScreen.tsx` — apply same grid changes for consistency

