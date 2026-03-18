

## Auto-Send Signed Document on All-Party Completion

### Problem
Currently, when all signatories approve a document, the system sends a basic "All Approvals Received" notification to the sender (no attachment). The sender must then manually open the document detail, generate the signed PDF, and click "Send Completed Document". The signed PDF (with signatures, certificate, SHA-256 hash, QR code, and audit trail) is generated client-side using pdf-lib.

### Solution
Create a new server-side edge function (`generate-signed-pdf-server`) that replicates the core signed PDF generation logic (certificate pages, signature stamps, audit trail) using pdf-lib in Deno. Then modify `process-approval` to call this function when all signatories approve, which generates the signed PDF, uploads it to storage, and triggers `send_completed` to email it to all parties.

### Changes

#### 1. New Edge Function: `supabase/functions/generate-signed-pdf-server/index.ts`
Server-side PDF generation using `npm:pdf-lib` and `npm:qrcode`:
- Accept `document_id` as input
- Fetch the original document, signatories, audit log, and signature placement from the database
- Download the original PDF from storage
- Generate the signed PDF with:
  - Stamp/separated signature placements (matching client-side logic)
  - Text annotations
  - Full Electronic Signature Certificate (navy/gold theme, SHA-256 hash, QR code)
  - Audit Trail page
- Use `npm:@pdf-lib/fontkit` for custom fonts (fall back to TimesRomanItalic for cursive since DancingScript TTF won't be available server-side)
- Upload the signed PDF to storage (`approval-documents/signed/`)
- Update `approval_documents.signed_file_url`
- Log `signed_document_generated` to audit trail
- Then call `send-approval-email` with `type: 'send_completed'`

This function will be ~600-700 lines, porting the essential drawing logic from `src/utils/generateSignedPdf.ts` (certificate pages, stamp signatures, separated signatures, text annotations, audit trail page).

#### 2. Modify `supabase/functions/process-approval/index.ts`
In the `allApproved` block (lines 150-162), after marking the document as completed, call the new `generate-signed-pdf-server` edge function instead of the current `send-approval-email` with `type: 'completed'`:

```
// Replace lines 165-203 with:
if (allApproved) {
  // Call server-side PDF generation + auto-send
  await fetch(`${SUPABASE_URL}/functions/v1/generate-signed-pdf-server`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SERVICE_KEY}` },
    body: JSON.stringify({ document_id: document.id }),
  });
} else {
  // Send individual confirmation to this signatory only
  await fetch(send-approval-email, { type: 'confirmation', ... });
}
```

The confirmation email to the individual signatory is still sent regardless. The `completed` + `send_completed` emails are replaced by the auto-generation flow which ends with `send_completed` (includes the signed PDF attachment with certificate and audit trail).

#### 3. Update `supabase/config.toml`
Add `verify_jwt = false` entry for the new function.

### What the recipients get
The same professional email currently sent by "Send Completed Document" — including:
- NHS-branded email with signatory table
- Attached signed PDF containing signatures, Electronic Signature Certificate (SHA-256 hash, QR code, verification URL), and full audit trail
- Legal notice referencing the Electronic Communications Act 2000
- Sent to the document sender AND all signatories

### Limitation
The server-side version will use TimesRomanItalic instead of DancingScript for the cursive signature font (since the TTF asset isn't available in the edge function). All other visual elements (navy/gold certificate, QR code, hash, audit trail) will be identical.

