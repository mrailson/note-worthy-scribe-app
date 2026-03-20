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

## Unified Multi-Document Approval Flow — IMPLEMENTED

Consolidated multi-document approvals into a single-email, single-action experience: One email → One link → One approval → One completion email with all signed documents attached.

### Database Changes
- `approval_signatories.group_token` (UUID, nullable) — groups signatory rows for the same email across all documents in a multi-doc group

### Changes
- `src/hooks/useDocumentApproval.ts` — Rewrote `sendMultiDocForApproval` to generate one `group_token` per unique signatory email, set all docs to pending, and call `send-approval-email` once with `multi_request` type
- `supabase/functions/process-approval/index.ts` — Added group_token flow: `get` returns all documents in the group, `approve` approves all signatory rows sharing the token, checks for multi-doc group completion, triggers PDF generation and consolidated completion email
- `supabase/functions/send-approval-email/index.ts` — Added `multi_request` (sends one email listing all documents with single approve button) and `multi_send_completed` (sends one completion email with all signed PDFs attached)
- `src/pages/PublicApproval.tsx` — Added tabbed multi-document view with single approval form for group tokens
- `src/App.tsx` — Added `/approve/group/:groupToken` route

## Recording Navigation Protection — Phase 1 IMPLEMENTED

Prevents recordings from being silently killed when users navigate away from the home page during an active meeting recording.

### Root Cause
`MeetingRecorder` was rendered only inside `Index.tsx` (the `/` route). Navigating to any other page unmounted the component, destroying MediaRecorder, audio streams, and transcription.

### Changes
- `src/components/MeetingRecorder.tsx` — Wrapped `setIsRecording` to also call `setRecordingState()` from `RecordingContext`, broadcasting recording status globally
- `src/hooks/useNavigationBlocker.ts` — NEW: Intercepts navigation (popstate/back button) while recording is active on `/`, shows confirmation dialog
- `src/components/NavigationBlockerDialog.tsx` — NEW: Alert dialog warning user that leaving will stop the recording
- `src/pages/Index.tsx` — Wired up navigation blocker and dialog
- `src/components/Header.tsx` — Added red pulsing "REC" indicator badge next to the app title when a recording is active, visible from any page

### Phase 2 (future)
Extract recording engine into a persistent singleton service so recordings survive route changes (true background recording).

## Notewell AI Governance-Grade Minutes Prompt — IMPLEMENTED

Replaced the legacy meeting minutes system prompt with a comprehensive, model-agnostic governance-grade prompt designed for NHS primary care. The new prompt enforces exhaustive topic extraction (15–40 topics), exact figure reproduction, risk categorisation, and frank political-context capture without sanitisation.

### Changes
- `supabase/functions/generate-meeting-notes-claude/index.ts` — Complete rewrite:
  - New `NOTEWELL_SYSTEM_PROMPT` replaces `SYSTEM_PROMPT_V2` — MHRA Class I registered, exhaustive extraction rules, NHS governance output format
  - New `buildUserPrompt()` function injects meeting context (organisation, meeting type, duration, speaker count) and the full output template (Discussion Summary, Decisions Register, Open Items & Risks, Action Log)
  - Removed `performProfessionalToneAudit()` — conflicted with "do not sanitise" instruction; the prompt now handles tone directly
  - Unified `callGemini()` and `callClaude()` helpers with `temperature: 0.15` and `max_tokens: 8192`
  - Both chunked and single paths use the same prompt for consistency
  - Fixed `npm:` import for supabase-js per edge function standards
- `src/pages/Settings.tsx` — Added Claude Haiku 4.5 as a third model option
- `src/components/meeting-history/LlmModelBadge.tsx` — Added full Haiku model string mapping
- `src/components/FullPageNotesModal.tsx` — Updated model label toast to include Haiku

### Model Options
| Setting value | Model | Notes |
|---|---|---|
| `gemini-3-flash` | Google Gemini 3 Flash | Default, fast |
| `claude-haiku-4-5-20251001` | Claude Haiku 4.5 | Fast, beta |
| `claude-sonnet-4-6` | Claude Sonnet 4.6 | Premium, beta |
