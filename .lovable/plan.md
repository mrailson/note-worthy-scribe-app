

## Multi-Document Approval Request

### Current State
The flow currently handles **one document per approval request**: upload → signatories → stamp positions → review → send. Each `approval_documents` row has one `file_url`, one set of signatories, and one set of signature placements.

### Proposed Approach
Allow the user to upload **multiple PDF/DOCX files** in Step 1, then configure signatories once (shared across all documents), position signatures **per document** in Step 3, and send everything with a single confirmation. Each document becomes its own `approval_documents` row in the database but shares the same signatories and is linked via a common `multi_doc_group_id`.

### User Flow

1. **Step 1 (Upload)** — User can drop/select multiple files. Each file gets its own card showing filename, hash, and a remove button. Title and metadata apply to the group (individual titles default to filenames).
2. **Step 2 (Signatories)** — Unchanged. One set of signatories for all documents.
3. **Step 3 (Position Signatures)** — A document tab bar at the top lets the user switch between documents. Each document has its own `SignaturePositionPicker` state (stamp positions, field positions, text annotations). A "Next Document" button advances through them.
4. **Step 4 (Review)** — Shows all documents in a summary list with signatory count. Single "Send All" button.

### Database Changes

**Migration**: Add a nullable `multi_doc_group_id` (UUID) column to `approval_documents`:
```sql
ALTER TABLE approval_documents ADD COLUMN multi_doc_group_id uuid;
CREATE INDEX idx_approval_docs_multi_group ON approval_documents(multi_doc_group_id) WHERE multi_doc_group_id IS NOT NULL;
```

No new tables needed. Documents in the same multi-doc request share the same `multi_doc_group_id`. Single-document requests leave this `NULL`.

### Code Changes

#### `CreateApprovalFlow.tsx`
- Change `file` state from single `File | null` to `files: { file: File; hash: string | null; title: string; url: string | null; docId: string | null }[]`
- Upload step UI: multi-file drop zone, list of uploaded files with remove buttons
- `handleUploadAndContinue`: loops through files, calls `uploadDocument` for each, stores all document IDs
- Stamp position step: add a document selector (tabs/dropdown) with an `activeDocIndex` state. Each document gets its own `stampPositions`, `fieldPositions`, `textAnnotations` stored in a `Map<number, ...>` keyed by doc index
- Review step: list all documents with their titles
- `handleSend`: calls `sendForApproval` on each document ID, links them with `multi_doc_group_id`

#### `useDocumentApproval.ts`
- Add `sendMultiDocForApproval(docIds: string[], customEmail?: string)`: generates a shared `multi_doc_group_id`, updates all docs with it, then calls `sendForApproval` for each
- The existing `sendForApproval` logic (status update + email trigger) works per-document unchanged

#### `SignaturePositionPicker.tsx`
- No structural changes needed — the parent will swap props (fileUrl, signatories, positions) when the user switches between documents

#### `DocumentApproval.tsx` (list view)
- Group documents with the same `multi_doc_group_id` visually (e.g. show "3 documents" badge on the card, expand to see individual docs)

### Server-Side (Edge Functions)
- `process-approval` and `generate-signed-pdf-server` already operate per-document — no changes needed. Each document completes independently when all its signatories approve.

### Signatories
Each document gets its own copy of the signatories in `approval_signatories` (same people, different rows per doc). This means each signatory gets a separate approval link per document and must approve each one individually — but they're all sent in a single batch email listing all documents.

