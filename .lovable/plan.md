

## Send Completed Document with Certificate

### What

Add a "Send Completed Document" button (visible when all signatures are received) that:
1. Generates the signed PDF with the Electronic Signature Certificate appended as the final page
2. Emails it to the sender (and optionally all signatories) with the signed PDF attached

### Changes

#### 1. `src/components/document-approval/ApprovalDocumentDetail.tsx`
- Add a new "Send Completed Document" button in the completed/allApproved card (next to existing Generate/Download buttons)
- The button handler will:
  - Generate the signed PDF (reusing `handleGenerateSignedPdf` logic, or using the already-generated `signedFileUrl`)
  - Call `send-approval-email` with a new type `send_completed` that attaches the signed PDF
- Add `Send` icon import from lucide-react
- Show loading state while sending

#### 2. `supabase/functions/send-approval-email/index.ts`
- Add a new email type: `send_completed`
- This type will:
  - Download the signed PDF from storage (using `signed_file_url` from the document record)
  - If no signed PDF exists yet, download the original and note that in the email
  - Compose a professional email to the sender with the signed PDF attached, including signatory summary table
  - Also send a copy to each signatory with the completed signed document
  - Log to audit as `email_sent_completed_document`

#### 3. Flow
1. User clicks "Send Completed Document"
2. If no signed PDF exists yet, auto-generate it first (reuse existing logic), upload to storage
3. Call edge function `send-approval-email` with `type: 'send_completed'`
4. Edge function downloads the signed PDF from storage, emails it to sender + all signatories
5. Toast confirmation shown

### Technical Details
- The signed PDF already includes the certificate page via `generateSignedPdf` with `placement.method === 'append'`
- The edge function will fetch the signed PDF blob from Supabase storage and attach it using Resend's attachment API
- Email subject: "Completed Signed Document: {title}"
- No database schema changes needed — `signed_file_url` already exists on `approval_documents`

