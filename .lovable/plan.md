

## Fix Modal Overflow on Scaled/Low-Resolution Laptop Displays

**Problem**: At 1920x1080 with 150% scaling (effective ~1280x720 CSS pixels), modals using `max-h-[85vh]` still overflow because the base `DialogContent` in `dialog.tsx` has `overflow-hidden` and uses fixed centering with `top-[50%] translate-y-[-50%]` plus `my-4` margins, which can cause content to be clipped at the bottom.

### Changes

**1. `src/components/ui/dialog.tsx` (base fix)**
- Change the positioning approach: instead of `top-[50%] translate-y-[-50%]` with `overflow-hidden`, use `top-0` with flexbox centering inside a full-viewport container, and change `overflow-hidden` to `overflow-auto` so the dialog itself can scroll if it exceeds viewport height.
- Specifically: wrap content in a full-viewport flex container that centers the dialog, with proper padding, so the dialog can never extend beyond the viewport edges.

Updated `DialogContent` base classes:
```
fixed inset-0 z-[90] flex items-center justify-center p-4
```
And the inner content div gets:
```
relative w-full max-w-lg max-h-[calc(100vh-2rem)] bg-background border shadow-lg sm:rounded-lg overflow-hidden
```

This ensures no dialog can ever overflow the viewport regardless of scaling.

**2. `src/components/PracticeUserManagement.tsx` — User Modal**
- Change `max-h-[85vh]` to `max-h-[calc(100vh-3rem)]` for better use of available space on small viewports.

**3. `src/components/PracticeUserManagement.tsx` — Email Preview Modal**  
- Same change: `max-h-[85vh]` → `max-h-[calc(100vh-3rem)]`.

### Approach Detail

The root cause is the base `DialogContent` using `overflow-hidden` with absolute centering. On small effective viewports, the content gets clipped at the bottom with no way to scroll. The fix restructures the dialog to use a flex container for centering (which naturally prevents overflow) and ensures `max-h` constraints work correctly with the viewport.

This is a global fix that benefits all 188+ dialogs across the app, not just the user management modal.

