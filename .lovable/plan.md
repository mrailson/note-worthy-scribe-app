

# Add "Close Document" Button for Partially-Signed Documents

## What this does
Adds a "Close" action for pending documents that stops all chase reminders and marks the document as permanently closed, while keeping the download button available so you can still get the PDF with whatever signatures were collected.

## Changes

### 1. Add `closeDocument` function to `useDocumentApproval.ts`
- Similar to `revokeDocument` but sets `status: 'closed'` and `completed_at: now()`
- Logs an audit entry with action `'closed'`
- Toast: "Document closed — download remains available"

### 2. Add "Close" button to `ApprovalDocumentDetail.tsx`
- New button next to Revoke when `doc.status === 'pending'`, styled with amber/warning colors (not destructive red like Revoke)
- Icon: `XCircle` or `Archive`
- Confirmation dialog before closing (AlertDialog: "Close this document? Chase reminders will stop. You can still download with signatures collected so far.")
- Once closed, hide Chase/Revoke buttons but keep the Download button visible

### 3. Show download for closed documents
- Change the download button condition from `doc.status === 'pending'` to `doc.status === 'pending' || doc.status === 'closed'`

### 4. Add "Closed" badge to `ApprovalHistory.tsx`
- Add a new status case for `'closed'` showing an amber badge with Archive icon, between completed and revoked in the status display

### 5. Add "Closed" to `SignatureCertificate.tsx` event labels
- Add `closed: { emoji: '📁', label: 'Document closed' }` to the event type map

### Files to modify
- `src/hooks/useDocumentApproval.ts` — add `closeDocument` function + export it
- `src/components/document-approval/ApprovalDocumentDetail.tsx` — add Close button with confirmation, show download for closed status
- `src/components/document-approval/ApprovalHistory.tsx` — add Closed badge
- `src/components/document-approval/SignatureCertificate.tsx` — add closed event label

No database migration needed — the `status` column is a plain string, not an enum.

