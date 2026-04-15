

# Add Thumbnail Preview for Pasted Screenshots

## What changes

When a user pastes a screenshot via Ctrl+V in compact mode, show a small thumbnail of the pasted image alongside the "Screenshot pasted!" confirmation. This gives immediate visual feedback that the correct image was captured.

## Approach

In `SmartUploadZone.tsx`:

1. **Add `pastedThumbnailUrl` state** — stores a temporary `URL.createObjectURL()` blob URL of the last pasted image file
2. **Set it in the paste handler** — when a file is pasted in compact mode, generate a blob URL before calling `onFilesSelected`
3. **Render a thumbnail** — in the compact `pasteFlash` branch, show a 32x32px rounded thumbnail next to the "Screenshot pasted!" text
4. **Clean up** — revoke the object URL when the flash timer expires (after ~4 seconds, extended from 2s so users can actually see it) or on unmount

## Visual result

```text
[Upload] [📷 32px thumb] ✓ Screenshot pasted!
```

The thumbnail appears for ~4 seconds alongside the success message, then fades back to the "Click here, then Ctrl+V" hint.

## Technical detail

- Use `URL.createObjectURL(file)` for the thumbnail — no network request needed
- Revoke with `URL.revokeObjectURL()` on cleanup to prevent memory leaks
- Only show thumbnail for image files (check `file.type.startsWith('image/')`)
- For non-image pastes, keep the existing text-only confirmation
- Single file change: `src/components/nres/hours-tracker/SmartUploadZone.tsx`

