Plan to add editable invoice descriptions to claim details

1. Add a claim description editor in the claim details UI
- Add a multi-line free-text field labelled along the lines of “Invoice description / claim details”.
- Show it on draft and queried claims so Management/practice users can add details before submission.
- The helper text will explain that the text will appear on the invoice, for example multiple dates, times, or notes about the work claimed.
- Existing submitted/invoiced claims will show the saved description read-only where relevant.

2. Persist the text safely
- Reuse the existing `practice_notes` field on `nres_buyback_claims`, which is already being saved during claim submission.
- Add/update a save path so the description can be stored against the claim before submission, not only at the moment the claim is submitted.
- Keep the text length bounded client-side and avoid rendering it as raw HTML.

3. Wire the editor into claim actions
- In the practice/management claim card, pass the entered description through when the user clicks “Submit Claim”.
- For queried claims, preserve or update the description when resubmitting.
- Ensure the parent `BuyBackClaimsTab` passes the necessary update handler down to the practice dashboard.

4. Add the description to the invoice PDF
- Update `src/utils/invoicePdfGenerator.ts` so that if a claim has `practice_notes`, it prints a “Claim details” / “Invoice description” block above or just below the line-item table.
- Use wrapped text (`splitTextToSize`) so multiple dates/times and longer free text fit without clipping.
- Adjust the invoice layout Y positions so GL subtotals, bank details and footer remain correctly placed.

5. Ensure it appears in regenerated/downloaded invoices
- Since invoices are generated from the claim object, the saved description will be included both when the invoice is auto-generated on approval and when users later download/regenerate an invoice PDF from the dashboard.

Technical notes
- Main files to change:
  - `src/hooks/useNRESBuyBackClaims.ts`: expose/update saved claim notes safely.
  - `src/components/nres/hours-tracker/BuyBackClaimsTab.tsx`: pass the update function to the practice dashboard.
  - `src/components/nres/hours-tracker/BuyBackPracticeDashboard.tsx`: add the editable text area in claim details and submit/resubmit flow.
  - `src/utils/invoicePdfGenerator.ts`: render the saved description on the invoice.
- No new database column is required because `practice_notes` already exists on `nres_buyback_claims`.