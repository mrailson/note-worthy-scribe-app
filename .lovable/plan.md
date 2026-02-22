
## Improved Delete Confirmation for Stock Images

### What changes
Replace the browser's native `confirm()` dialog with a proper styled confirmation dialog, and add a "Bulk Delete Mode" toggle that, when enabled, skips the confirmation for 15 minutes to allow rapid bulk deletion.

### How it works

1. **Proper Delete Confirmation Dialog** -- A styled AlertDialog (Radix) will appear when deleting a stock image, showing the image thumbnail, title, and a clear "Delete" / "Cancel" button pair.

2. **Bulk Delete Mode Toggle** -- A switch/slider labelled "Bulk Delete Mode (skip confirmations for 15 min)" visible only to admins. When toggled on:
   - A timestamp is recorded
   - For the next 15 minutes, clicking delete will immediately delete without confirmation
   - A subtle badge/timer shows remaining time
   - After 15 minutes, the mode automatically expires and confirmations resume

3. **Two delete points updated** -- Both the grid overlay delete button and the lightbox modal delete button will use the new logic.

### Technical details

**File: `src/components/ai4gp/studio/StockImageLibrary.tsx`**

- Import `AlertDialog`, `AlertDialogAction`, `AlertDialogCancel`, `AlertDialogContent`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogHeader`, `AlertDialogTitle` from Radix, and `Switch` from the UI library.
- Add state:
  - `deleteTarget: StockImage | null` -- the image pending deletion confirmation
  - `bulkDeleteUntil: number | null` -- timestamp when bulk mode expires
- Add a helper `isBulkDeleteActive` that checks if `bulkDeleteUntil` is set and `Date.now() < bulkDeleteUntil`.
- Add a `handleDelete(image)` function: if bulk mode is active, delete immediately; otherwise set `deleteTarget` to show the confirmation dialog.
- Replace both `confirm(...)` calls with `handleDelete(...)`.
- Add an `AlertDialog` component rendering the confirmation with image preview.
- Add a `Switch` toggle in the admin toolbar area for "Bulk Delete Mode" that sets `bulkDeleteUntil` to `Date.now() + 15 * 60 * 1000`.
- Use a `useEffect` with a timer to auto-clear `bulkDeleteUntil` when it expires and show a toast notification.
