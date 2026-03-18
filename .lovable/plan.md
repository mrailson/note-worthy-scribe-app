

## Fix: Document Not Disappearing After Delete

### Problem
When deleting a document card from Document Sign-Off, the card remains visible until the user navigates away and returns. The `deleteDocument` function in `useDocumentApproval.ts` performs the server-side delete and then calls `fetchDocuments()`, but the UI doesn't update immediately.

### Root Cause
The `fetchDocuments()` call sets `loading: true` (line 82), re-fetches all documents, then updates state. This round-trip can be slow or get interrupted. There is no optimistic removal of the deleted document from local state.

Additionally, there's a **duplicate toast** — `deleteDocument` in the hook shows "Document deleted" (line 706), and the `DocumentApproval.tsx` page shows it again (line 416).

### Fix

**`src/hooks/useDocumentApproval.ts`** — In the `deleteDocument` function (line 674):
- **Optimistically remove** the document from `documents` state immediately before performing any async operations: `setDocuments(prev => prev.filter(d => d.id !== documentId))`
- Keep the `fetchDocuments()` call at the end as a background sync to ensure consistency
- Keep the existing toast in the hook

**`src/pages/DocumentApproval.tsx`** — In the `onDelete` handler (line 413):
- Remove the duplicate `toast.success('Document deleted')` call since the hook already handles it

**`src/components/document-approval/ApprovalDocumentDetail.tsx`** — The detail view delete (line 617) already calls `onBack()` after deletion, which works fine with the optimistic update.

### Summary
One-line addition of optimistic state update + removal of duplicate toast. No new files or dependencies needed.

