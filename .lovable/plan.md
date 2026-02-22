

## Fix: Delete Confirmation Locking the Page

### Problem
The delete confirmation `AlertDialog` opens on top of the lightbox `Dialog`, causing two overlapping overlays (both at `z-[100]`). This makes the background go completely black and the page appears locked — clicks don't reach through properly.

### Solution
Two changes to `src/components/ai4gp/studio/StockImageLibrary.tsx`:

1. **Close the lightbox before showing the delete confirmation** -- When delete is clicked from within the lightbox, close the lightbox first, then show the `AlertDialog`. This avoids stacking two modal overlays.

2. **Ensure the AlertDialog has a higher z-index** -- As a safety measure, give the `AlertDialogContent` and its overlay a `z-[110]` or higher so it always renders above anything else, matching what the alert-dialog component already supports.

### Technical details

- In the lightbox delete button's `onClick` handler (around line 841), add `setLightboxImage(null)` before calling `handleDelete(lightboxImage)`, so the lightbox closes first.
- Optionally add a `className` override on `AlertDialogContent` to ensure `z-[110]` stacking.

This is a small, targeted fix -- two lines changed.

