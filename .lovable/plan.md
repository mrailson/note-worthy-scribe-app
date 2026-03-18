

## Unified Multi-Document Approval Flow

### Problem
Currently, multi-doc sends N separate emails (one per document) with N separate approval links. Each signatory must approve each document individually, and receives N separate completion emails. Users miss emails and the experience is fragmented.

### Solution
Consolidate to: **One email → One link → One approval → One completion email with all signed documents attached.**

### Database Change

Add `group_token` (UUID, nullable) to `approval_signatories`:

```sql
ALTER TABLE approval_signatories ADD COLUMN group_token uuid;
CREATE INDEX idx_sig_group_token ON approval_signatories(group_token) WHERE group_token IS NOT NULL;
```

For multi-doc groups, all signatory rows for the same email across all documents in the group share the same `group_token`. Single-doc requests leave this NULL and work as before.

### Changes

#### 1. `useDocumentApproval.ts` — `sendMultiDocForApproval`
Instead of calling `sendForApproval` per document (which sends N emails), do:
- Tag all docs with `multi_doc_group_id`
- Set all docs to `pending` status
- For each unique signatory email across all docs, generate ONE `group_token` UUID and update all their signatory rows with it
- Call `send-approval-email` ONCE with a new type `multi_request`, passing the `multi_doc_group_id` — this sends one consolidated email per signatory with a link like `/approve/group/{group_token}`

#### 2. `send-approval-email` — New type: `multi_request`
- Accept `group_id` instead of `document_id`
- Fetch all documents in the group and all signatories
- For each unique signatory email, look up their `group_token`
- Send ONE email listing all document titles in a table, with ONE "Approve All Documents" button linking to `/approve/group/{group_token}`
- Attach all PDFs (if combined size < 5MB)

#### 3. `process-approval` — Handle group token
- Add a new flow: when `action === 'get'` and a `group_token` is provided, fetch ALL signatory rows with that token, then fetch ALL their linked documents
- Return an array of `{ signatory, document }` pairs
- When `action === 'approve'` with `group_token`, approve ALL signatory rows sharing that token in one operation, then check each document for `allApproved` status
- For multi-doc groups, only trigger the completion flow when ALL documents in the group are completed

#### 4. `PublicApproval.tsx` — Tabbed multi-document view
- Add route `/approve/group/:groupToken` (reuse the same component)
- When a group token is detected, fetch all documents via process-approval
- Show a tabbed interface: each tab shows one document's PDF viewer with its title
- ONE approval form at the bottom — fills name/role/org once, approves all documents
- Post-submit confirmation shows all document titles

#### 5. Completion flow — One email, all attachments
- In `process-approval`, after approving via group token, check if ALL documents in the `multi_doc_group_id` are now completed
- If yes, call `generate-signed-pdf-server` for each document that doesn't yet have a signed PDF
- Then call `send-approval-email` with a new type `multi_send_completed` passing the `group_id`
- This sends ONE email to sender + all signatories with ALL signed PDFs attached

#### 6. `send-approval-email` — New type: `multi_send_completed`
- Fetch all docs in the group
- Download all signed PDFs
- Send ONE email with a table listing all documents and their signatories, with all signed PDFs attached

#### 7. Route update in `App.tsx`
- Add `/approve/group/:groupToken` route pointing to `PublicApproval`

### Files Changed
- **Migration** — Add `group_token` column
- `src/hooks/useDocumentApproval.ts` — Rewrite `sendMultiDocForApproval`
- `supabase/functions/send-approval-email/index.ts` — Add `multi_request` and `multi_send_completed` types
- `supabase/functions/process-approval/index.ts` — Handle group token get/approve/decline + group completion check
- `src/pages/PublicApproval.tsx` — Tabbed multi-doc view with single approval form
- `src/App.tsx` — Add group approval route

### Backward Compatibility
Single-document requests are unaffected — `group_token` is NULL, existing flow unchanged. The old per-document `approval_token` still works for single docs and reminders.

