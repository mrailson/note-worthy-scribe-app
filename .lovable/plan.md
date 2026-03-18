## Separated Signature Field Placement — IMPLEMENTED

Added a second placement mode ("Separated") alongside the existing "Block" (stamp) mode. In Separated mode, each signatory gets 5 independently draggable elements on the PDF: Signature (cursive), Name, Role, Organisation, and Date. Font size is configurable (8–24pt, default 14). Block mode remains unchanged.

### Files Changed
- `src/utils/generateSignedPdf.ts` — Added `FieldPosition` type, extended `SignaturePlacement` with `fieldPositions` and `separatedFontSize`, added `drawSeparatedSignatures` function
- `src/components/document-approval/SignaturePositionPicker.tsx` — Added Block/Separated mode toggle, per-field placement UI with draggable tags, font size slider
- `src/components/document-approval/CreateApprovalFlow.tsx` — Added state for `placementMode`, `fieldPositions`, `separatedFontSize`; passes to picker and saves to DB
- `src/pages/PublicApproval.tsx` — Renders per-field ghost indicators in separated mode

## Auto-Send Signed Document on All-Party Completion — IMPLEMENTED

When all signatories approve a document, the system now automatically generates the signed PDF server-side (with signatures, Electronic Signature Certificate, SHA-256 hash, QR code, and audit trail) and emails it to the sender and all signatories. No manual intervention required.

### Files Changed
- `supabase/functions/generate-signed-pdf-server/index.ts` — NEW: Server-side PDF generation using pdf-lib, replicating stamp/separated/text annotation drawing, certificate pages (navy/gold theme), and audit trail. Uploads to storage and triggers `send_completed` email.
- `supabase/functions/process-approval/index.ts` — Modified `allApproved` block: sends individual confirmation email to the approving signatory, then calls `generate-signed-pdf-server` to auto-generate and distribute the signed PDF.
- `supabase/config.toml` — Added `generate-signed-pdf-server` with `verify_jwt = false`.

## Multi-Document Approval Request — IMPLEMENTED

Users can now upload multiple PDF/DOCX files in a single approval request. All documents share the same signatories but have independent signature positioning per document. Documents are linked via `multi_doc_group_id` and sent with a single confirmation.

### User Flow
1. **Upload** — Drop/select multiple files, each with its own editable title
2. **Signatories** — One set of signatories shared across all documents
3. **Position Signatures** — Tab bar to switch between documents; each has independent stamp/separated/text positions
4. **Review & Send** — Shows all documents in summary; single "Send All" button

### Database Changes
- `approval_documents.multi_doc_group_id` (UUID, nullable) — groups documents in the same multi-doc request

### Files Changed
- `src/components/document-approval/CreateApprovalFlow.tsx` — Refactored from single-file to multi-file: array of DocFile objects, per-document signature state maps, document tab bar in positioning step, multi-doc review display
- `src/hooks/useDocumentApproval.ts` — Added `multi_doc_group_id` to `ApprovalDocument` interface; added `sendMultiDocForApproval()` function that assigns a shared group ID and sends each doc
- `src/pages/DocumentApproval.tsx` — Added "Multi-doc" badge on DocumentCard for grouped documents
