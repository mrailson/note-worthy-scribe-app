

# Download Partial Signatures + Auto-Send Toggle

## What you asked for
1. **Download with signatures so far** — ability to download the document with whatever signatures have been collected, even if not all signatories have signed yet (avoids resending when chasing one manual signature)
2. **Auto-send toggle on creation** — option to control whether the completed signed document is automatically emailed to all parties when all signatures are in

## Current behaviour
- Download/signed PDF generation only appears when `isCompleted && allApproved` (line 493 of ApprovalDocumentDetail)
- On completion, `process-approval` automatically calls `generate-signed-pdf-server` which auto-sends the completed email
- No DB column exists for the auto-send preference

---

## Plan

### 1. Add "Download Current Progress" button to ApprovalDocumentDetail
- Show a new button in the action bar when status is `pending` and at least 1 signatory has approved
- Label: "Download with Signatures So Far"
- Reuse the existing `generateSignedPdfCore()` logic — it already includes only approved signatories' stamps and skips unsigned ones
- This generates a PDF with the original document + signature page showing who has signed and who hasn't, then triggers a browser download
- Does NOT upload to storage or update the document record (it's a transient local download)

### 2. Add `auto_send_on_completion` column to `approval_documents`
- New migration: `ALTER TABLE approval_documents ADD COLUMN auto_send_on_completion boolean NOT NULL DEFAULT true;`
- Default true preserves current behaviour

### 3. Add toggle to CreateApprovalFlow review step
- On the review step (before the Send button), add a Switch/toggle:
  - Label: "Auto-send signed document on completion"
  - Description: "When all parties have signed, automatically email the signed document to everyone"
  - Default: on
- Store the value in component state, pass it through to `uploadDocument` metadata so it's saved on the `approval_documents` row

### 4. Update `uploadDocument` in useDocumentApproval hook
- Accept `auto_send_on_completion` in the metadata parameter
- Include it in the insert to `approval_documents`

### 5. Update process-approval edge function
- When all signatories approve (single-doc flow, line ~485), read `auto_send_on_completion` from the document row
- If false, still generate the signed PDF (so it's ready) but pass `skip_email: true` to `generate-signed-pdf-server`
- For multi-doc groups, same logic: check the flag before sending the completion email

### 6. Update generate-signed-pdf-server edge function
- Already supports `skip_email` — no change needed here

### Files to modify
- `src/components/document-approval/ApprovalDocumentDetail.tsx` — add partial download button
- `src/components/document-approval/CreateApprovalFlow.tsx` — add auto-send toggle on review step
- `src/hooks/useDocumentApproval.ts` — pass `auto_send_on_completion` through upload
- `supabase/functions/process-approval/index.ts` — respect the flag
- New migration for the DB column

