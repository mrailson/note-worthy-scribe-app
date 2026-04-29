Plan to add an invoice preview facility in the Management / Verifier view

What will change
1. Add a “Preview invoice” button beside the invoice description editor
   - It will appear in the management/verifier claim card where the extra invoice wording is entered.
   - It will work before saving, using the current text in the box.
   - It will also work after saving, using the saved description.

2. Show the actual PDF layout in a modal
   - Opening the preview will generate the same PDF layout currently used for invoice downloads.
   - The PDF will be displayed inside a large in-page modal, so the verifier can check wording, spacing, wrapping, and overall appearance before forwarding the claim.
   - The modal will include a close control and a download/open option if useful.

3. Ensure unsaved wording is included in the preview
   - The preview will create a temporary claim object with `practice_notes` replaced by the text currently typed in the editor.
   - This means users can type, preview, adjust, preview again, and only save when happy.

4. Improve preview availability before invoice number exists
   - If the claim does not yet have an invoice number, the preview will use a clear draft number such as `DRAFT-INVOICE-PREVIEW` or `Preview invoice` in the generated PDF metadata.
   - This avoids blocking preview in the management stage, before the final invoice number is assigned.

5. Keep the existing save behaviour
   - “Save description” will continue to store the invoice wording.
   - “Verify & Forward to SNO Approver” will still save changed wording before forwarding, as it does now.

Technical details
- Update `src/components/nres/hours-tracker/BuyBackVerifierDashboard.tsx`.
- Reuse `generateInvoicePdf` from `src/utils/invoicePdfGenerator.ts` so the preview matches the downloaded invoice PDF.
- Add a small PDF preview modal component, likely using the existing shadcn `Dialog` pattern.
- Generate a browser object URL from `jsPDF.output('blob')` and display it in an iframe/object/embed.
- Clean up object URLs when the modal closes or the preview regenerates to prevent memory leaks.
- No database migration is needed because the feature uses the existing `practice_notes` invoice wording field.