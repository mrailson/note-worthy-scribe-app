I’ll update the invoice generation workflow so that, when an invoice is created after SNO approval, the system automatically emails PML Finance with the invoice PDF and all claim evidence files attached.

Planned changes:

1. Update the email sender function to support BCC
- Add a `bcc_emails` field to the existing email function request.
- Pass BCC recipients through to the email provider.
- Keep existing `to`, `cc`, invoice and extra attachment behaviour unchanged.

2. Change the invoice email recipient logic
- When a claim is approved and the invoice PDF is generated, send the invoice email to PML Finance rather than the claim submitter/practice manager.
- Use `amanda.palin2@nhs.net` as the PML Finance recipient unless there is already a more specific configured PML Finance address in the code path.
- Add BCC recipients:
  - `malcolm.railson@nhs.net`
  - `amanda.palin2@nhs.net`
- Note: if Amanda is also the main recipient, the implementation will avoid duplicating her in both To and BCC where possible, because some email providers reject duplicate recipients.

3. Add all supporting evidence/screenshots as attachments
- After the invoice PDF is created, fetch all `nres_claim_evidence` records for the claim.
- Download each corresponding file from the `nres-claim-evidence` storage bucket.
- Convert them to base64 and attach them alongside the invoice PDF.
- Preserve original filenames and file types where available.
- Keep this non-blocking where sensible, but surface an error if the invoice email cannot be prepared/sent.

4. Update the invoice email subject
- Prefix the subject with:
  `TEST EMAIL PRIOR TO GOLIVE PLEASE IGNORE`
- Keep the claim details afterwards, e.g. practice, claim month and total value.

5. Update the email body text
- Add a bold test warning at the very top:
  `TEST EMAIL PRIOR TO GOLIVE PLEASE IGNORE`
- State that the claim is part of the NRES SDA Pilot.
- State that the claim has been approved by the SNO Approver, using the actual approver name if available, otherwise falling back to the approving email/local name. If needed, Andrew Moore can be used as the assumed SNO Approver label only when no better value is available.
- Include approval date and time in British format with hours and minutes only.
- State that all evidence used in support of the claim has been added.
- Direct PML Finance to log into: `Notewell NRES Dashboard > SDA Claims` for further details.

6. Keep existing invoice generation intact
- Leave invoice number generation, PDF generation, storage upload, claim status update and payment workflow setup as they are.
- Only replace the current “invoice emailed to submitter/PM” behaviour with the new “invoice emailed to PML Finance with all evidence” behaviour.

Technical details:
- Main frontend change: `src/hooks/useNRESBuyBackClaims.ts` in the `approveClaim` invoice-generation block.
- Email function change: `supabase/functions/send-meeting-email-resend/index.ts` to support BCC.
- Existing attachment path: invoice PDF already uses `extra_attachments`; evidence files will be added to the same array.
- Existing storage bucket: `nres-claim-evidence`.
- Existing generated invoice field: `invoice_pdf_path`.
- Existing approver field: `approved_by_email`, with current user/profile name available through `emailConfig.currentUserName`.

Verification after implementation:
- Confirm TypeScript code paths use the existing email request shape plus BCC.
- Confirm the subject and bold body warning contain the exact test wording.
- Confirm generated invoice PDF remains attached.
- Confirm supporting evidence files are loaded from storage and included as extra attachments.
- Confirm time formatting uses British date/time and no seconds.