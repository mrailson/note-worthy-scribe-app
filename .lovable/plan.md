

# Fix Ctrl+V Screenshot Paste in SmartUploadZone

## Problem

Two bugs prevent Ctrl+V paste from working properly:

1. **Compact mode silently drops pasted files** — When `compact={true}` (used in all staff evidence rows), pasted files are added to `pendingFiles` state but the compact UI never renders the pending list or upload button. Files vanish silently.

2. **Multiple global listeners conflict** — Every `SmartUploadZone` instance registers a `document.addEventListener('paste', ...)`. When 10+ staff rows exist, a single Ctrl+V fires into ALL zones simultaneously, causing duplicates or race conditions.

## Fix (single file: `SmartUploadZone.tsx`)

### 1. Auto-upload pasted files in compact mode
When `compact` is true, bypass `pendingFiles` and call `onFilesSelected()` directly on paste — same as the `multiple=false` path. This gives instant upload with no extra click.

### 2. Scope paste to focused zone only
Replace the global `document` paste listener with a scoped approach:
- Track whether the zone (or its parent container) was the last one interacted with (clicked/focused)
- Only the "active" zone processes Ctrl+V
- Use a module-level variable (`activeZoneId`) so only one zone responds

### 3. Add visual feedback
In compact mode, show a brief toast or inline flash ("Screenshot pasted!") so users know it worked.

## Technical detail

- Add a unique `id` ref per SmartUploadZone instance
- On focus/click of the zone area, set `activeZoneId = thisId`
- In the paste handler, check `activeZoneId === thisId` before processing
- In compact mode, call `onFilesSelected(files)` directly instead of `setPendingFiles`
- All changes confined to `src/components/nres/hours-tracker/SmartUploadZone.tsx`

