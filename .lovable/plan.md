

# Batch Approval: Send One Document to Multiple Practices

## What this does

You upload a single document once, then select multiple practices and pick specific signatories for each practice. The system creates independent approval requests per practice — each with its own tracking, status, and sign-off progress. This saves you from manually creating the same request 7 times.

## User flow

1. **Upload document** (existing Step 1 — unchanged)
2. **New Step: Choose send mode** — "Single request" (current behaviour) or "Batch to practices"
3. **If Batch mode:**
   - Show a practice picker (checkboxes) combining NRES practices + Notewell directory practices
   - For each selected practice, expand a section to pick signatories from that practice's staff (from Notewell directory) or add manually
   - Shared settings: signature method (stamp/append), deadline, custom email message — applied to all
4. **Stamp positioning** (if stamp method) — position once, applied to all copies
5. **Review & Send** — shows a summary table: Practice → Signatories → Status. One "Send All" button creates all requests.

## Technical approach

### New component: `BatchPracticeSelector.tsx`
- Practice list from NRES_PRACTICES + `useNotewellDirectory` practice groups
- Checkbox multi-select for practices
- Per-practice expandable panel to pick signatories (reusing the existing directory modal logic)
- State: `Map<practiceKey, SignatoryRow[]>`

### Modified: `CreateApprovalFlow.tsx`
- Add a send mode toggle after upload: "Single Signatory Request" vs "Batch to Practices"
- When batch mode is selected, replace the signatories step with the `BatchPracticeSelector`
- On send, loop through selected practices and for each:
  1. Clone the uploaded document record (new `approval_documents` row pointing to the same `file_url` and `file_hash`)
  2. Add practice-specific signatories via `addSignatories()`
  3. Call `sendForApproval()` for each

### Modified: `useDocumentApproval.ts`
- Add a `cloneDocumentForBatch()` function that inserts a new `approval_documents` row with the same file details but a unique ID, appending the practice name to the title (e.g. "DPIA — The Parks MC")
- Add a `sendBatchForApproval()` function that orchestrates: clone → add signatories → send, for each practice

### Database
- No schema changes needed. Each batch item is a standard `approval_documents` row. We add an optional `batch_id` column (UUID, nullable) so batch requests can be grouped in the history view.
- Migration: `ALTER TABLE approval_documents ADD COLUMN batch_id uuid DEFAULT NULL;`

### History view enhancement
- In `ApprovalHistory.tsx`, batch documents are visually grouped with a "Batch: [title]" header showing aggregate progress (e.g. "4/7 practices signed")

## Files to create/modify

| File | Change |
|------|--------|
| `src/components/document-approval/BatchPracticeSelector.tsx` | New — practice picker + per-practice signatory selection |
| `src/components/document-approval/CreateApprovalFlow.tsx` | Add batch mode toggle, integrate BatchPracticeSelector, batch send logic |
| `src/hooks/useDocumentApproval.ts` | Add `cloneDocumentForBatch()` and `sendBatchForApproval()` |
| `src/components/document-approval/ApprovalHistory.tsx` | Group batch documents visually |
| Migration | Add `batch_id` column to `approval_documents` |

