

## Plan: Add "Click here, then Ctrl+V to paste" to Required Evidence Slots

### Summary

Currently, the individual evidence upload slots (e.g. "Contract of Employment — Required") only have a basic "Upload" button with no paste support. The `SmartUploadZone` component already supports a compact mode with "Click here, then Ctrl+V to paste" functionality. This change replaces the basic upload button in `EvidenceSlot` with the `SmartUploadZone` compact mode for all editable slots that do not yet have a file uploaded.

### What Changes

**`src/components/nres/hours-tracker/ClaimEvidencePanel.tsx`**

In the `EvidenceSlot` component (around lines 140-148), replace the basic file input + Upload button with the `SmartUploadZone` component in compact mode:

- Remove the hidden `<input type="file">` and the manual "Upload" `<Button>`
- Replace with `<SmartUploadZone compact onFilesSelected={(files) => onUpload(files[0])} uploading={uploading} multiple={false} />`
- This gives each required evidence slot the same "Click here, then Ctrl+V to paste" prompt alongside the Upload button
- Only applies when `canEdit` is true and no file is yet uploaded (same condition as current)

No other files need changing — this is a single-component edit.
