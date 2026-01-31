
# Permanent Fix: Mobile Input Bar Always Visible on /ai4gp

## Problem Summary

On iPhone (Safari & Chrome) and Android, the message input bar at the bottom of the Ask AI page (/ai4gp) is pushed off-screen. Users must scroll to see it, and many won't realise it exists.

**Root Cause**: The CSS classes `.mobile-container` and `.mobile-scroll` apply `transform: translateZ(0)` for scroll smoothing. In iOS Safari, any `transform` on a parent container creates a new **stacking context**, causing `position: fixed` elements to become positioned relative to that container rather than the viewport. The result: the "fixed" input bar scrolls with the content instead of staying pinned to the bottom.

---

## Solution Architecture

Instead of tweaking height calculations repeatedly, we will restructure the mobile layout to use a **flexbox viewport lock** approach that guarantees the input bar is always visible at the bottom, regardless of content length.

```text
+--------------------------------+
|         Header (fixed)         |
+--------------------------------+
|                                |
|      Scrollable Content        |
|      (flex-1, overflow-y)      |
|                                |
+--------------------------------+
|   Input Bar (flex-shrink-0)    |
+--------------------------------+
|     Safe Area Bottom Padding   |
+--------------------------------+
```

### Key Changes

1. **Remove `transform: translateZ(0)` on mobile ancestors** (scoped to AI4GP only)
   - Add a new utility class `.ai4gp-no-transform` that overrides the transform to `none`
   - Apply this class to the AI4GP page wrapper
   - This restores correct `position: fixed` behaviour

2. **Restructure AI4GPService layout for mobile**
   - Change the parent container to use `flex flex-col h-dvh` (dynamic viewport height)
   - Make the messages area `flex-1 overflow-y-auto` so it takes remaining space and scrolls internally
   - Make the input bar `flex-shrink-0` so it never shrinks and stays at the bottom
   - Move `FloatingMobileInput` from a `position: fixed` element to a **static flex child** at the bottom of the layout

3. **Update FloatingMobileInput for non-fixed mode**
   - Add a prop `useFixedPosition` (default true) to control positioning mode
   - When `false`, render without `position: fixed` or `inset-x-0 bottom-0` classes, relying on parent flex layout

4. **Handle safe area padding**
   - Keep `padding-bottom: env(safe-area-inset-bottom)` on the input bar for home indicator clearance
   - Remove complex keyboard height calculations (since keyboard covers is acceptable per requirements)

---

## Detailed File Changes

### 1. `src/index.css`
Add a scoped override class:

```css
/* AI4GP-specific: disable transform to fix position:fixed on iOS */
.ai4gp-no-transform,
.ai4gp-no-transform .mobile-container,
.ai4gp-no-transform .mobile-scroll,
.ai4gp-no-transform .mobile-scroll-container {
  transform: none !important;
  will-change: auto !important;
}
```

### 2. `src/pages/AI4GP.tsx`
- Add `.ai4gp-no-transform` class to the outermost `<div>`
- Remove the `mobile-container` class from the root element (it applies the problematic transform)

### 3. `src/components/AI4GPService.tsx`

**Mobile layout restructure:**

- Wrap the entire mobile view in a full-height flex container: `flex flex-col h-[100dvh]`
- Remove the `max-h-[calc(80vh-60px)]` constraint on the Card (no longer needed)
- Change the main content area to `flex-1 overflow-y-auto` so it scrolls independently
- Move the mobile input bar **inside** the main flex layout as the last child, not as a fixed-positioned overlay
- Pass a new prop `inlineMode={true}` to FloatingMobileInput when in mobile view

### 4. `src/components/ai4gp/FloatingMobileInput.tsx`

- Add `inlineMode?: boolean` prop
- When `inlineMode` is true:
  - Remove `position: fixed`, `inset-x-0`, `bottom-0`, and `z-[9999]` classes
  - Just render as a normal `<div>` with `flex-shrink-0`
  - Keep safe area padding for home indicator
- When `inlineMode` is false (default): preserve existing behaviour for other pages

---

## Technical Details

### Why flexbox solves this permanently

| Current Approach | New Approach |
|-----------------|--------------|
| `position: fixed` relies on viewport | Static flex child always visible |
| `transform` breaks fixed positioning | No transform on ancestors |
| Height calculations prone to error | Flex takes remaining space automatically |
| Requires iOS-specific hacks | Works consistently across browsers |

### Browser Compatibility

- `h-[100dvh]` uses dynamic viewport height, supported in iOS 15.4+, Android Chrome 108+
- Fallback: `h-screen` for older browsers (acceptable degradation)
- `env(safe-area-inset-bottom)` widely supported for home indicator clearance

---

## Files to Modify

| File | Change Summary |
|------|----------------|
| `src/index.css` | Add `.ai4gp-no-transform` utility class |
| `src/pages/AI4GP.tsx` | Add no-transform class, remove mobile-container |
| `src/components/AI4GPService.tsx` | Restructure to flexbox viewport, move input inline |
| `src/components/ai4gp/FloatingMobileInput.tsx` | Add `inlineMode` prop for static positioning |

---

## Testing Checklist (Post-Implementation)

After approval and implementation, please verify:

- [ ] iPhone Safari: Input bar visible without scrolling on fresh load
- [ ] iPhone Chrome: Input bar visible without scrolling
- [ ] Android Chrome: Input bar visible without scrolling
- [ ] Typing a message: Input bar remains visible (keyboard may cover, but bar visible when keyboard closes)
- [ ] Long AI response: Messages area scrolls, input bar stays at bottom
- [ ] Quick picks work and trigger AI response
- [ ] Desktop view unchanged
