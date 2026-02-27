
## Add Drag-and-Drop File Upload to the Document Vault

### What will change
The grey content area of the Document Vault will support drag-and-drop file uploads. Users will be able to drag files from their desktop and drop them directly into the vault area. A visual overlay will appear when files are dragged over, guiding the user. The empty folder message will also be updated to mention drag-and-drop as an option.

### Implementation

**File: `src/components/nres/vault/VaultContentView.tsx`**

1. **Add drag-and-drop state and handlers** -- introduce `isDragOver` state and `onDragEnter`, `onDragLeave`, `onDragOver`, `onDrop` handlers on the main content `div` (the grey area, around line 651).

2. **Visual drag overlay** -- when `isDragOver` is true and `canUpload` is true, render a semi-transparent overlay with an Upload icon and "Drop files here to upload" text over the content area.

3. **Handle the drop** -- on drop, extract files from `e.dataTransfer.files` and call the existing `onUploadFiles(Array.from(files))` callback.

4. **Update empty-state text** -- change the empty folder message from "Right-click to create a folder or upload files" to "Drag and drop files here, or right-click for more options".

5. **Handle paste** -- add a `onPaste` handler on the content div that checks `e.clipboardData.files` and, if files are present, calls `onUploadFiles`.

### Technical detail

- A drag counter ref will track nested drag enter/leave events to prevent flicker.
- The overlay will use `absolute` positioning within a `relative` wrapper, with a `pointer-events-none` style so it doesn't block the drop.
- All logic stays within `VaultContentView.tsx` -- no new files needed.
- The existing `onUploadFiles` prop already accepts `File[]`, so no interface changes are required.
