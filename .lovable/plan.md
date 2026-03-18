## Separated Signature Field Placement — IMPLEMENTED

Added a second placement mode ("Separated") alongside the existing "Block" (stamp) mode. In Separated mode, each signatory gets 5 independently draggable elements on the PDF: Signature (cursive), Name, Role, Organisation, and Date. Font size is configurable (8–24pt, default 14). Block mode remains unchanged.

### Files Changed
- `src/utils/generateSignedPdf.ts` — Added `FieldPosition` type, extended `SignaturePlacement` with `fieldPositions` and `separatedFontSize`, added `drawSeparatedSignatures` function
- `src/components/document-approval/SignaturePositionPicker.tsx` — Added Block/Separated mode toggle, per-field placement UI with draggable tags, font size slider
- `src/components/document-approval/CreateApprovalFlow.tsx` — Added state for `placementMode`, `fieldPositions`, `separatedFontSize`; passes to picker and saves to DB
- `src/pages/PublicApproval.tsx` — Renders per-field ghost indicators in separated mode
