Plan to add the requested SDA Claims invoice GL mappings

I will update the SDA Claims finance mapping so the relevant claim lines and invoices show the new GL code plus the finance description:

```text
GP Partner Meeting Attend        -> 6100 - Locum GP
Practice Manager Meeting Attend  -> 6104 - Local Non-Clinical
NRES Management Hours            -> 6104 - Local Non-Clinical
```

What I will change

1. Centralise the new mappings
- Extend the GL-code utility so it can resolve codes by claim category and role, not just by the older buy-back/additional clinical mappings.
- Add invoice-facing labels for:
  - `6100 - Locum GP`
  - `6104 - Local Non-Clinical`

2. Fix invoice PDF generation for standard SDA claim invoices
- Update `src/utils/invoicePdfGenerator.ts` so these claim line types resolve correctly:
  - staff category `meeting` + role `GP Partner` -> `6100 - Locum GP`
  - staff category `meeting` + role `Practice Manager` -> `6104 - Local Non-Clinical`
  - staff category `management` or role `NRES Management` -> `6104 - Local Non-Clinical`
  - staff category `gp_locum` / role `GP Locum` -> `6100 - Locum GP`, if those are the locum lines being invoiced
- Ensure both the invoice table and GL subtotal box show the description, not just the number.

3. Fix meeting-attendance invoice PDFs
- Update `src/utils/meetingInvoicePdfGenerator.ts` so meeting attendance invoices include a GL category column.
- Use the meeting role/person config to map:
  - GP attendance -> `6100 - Locum GP`
  - Practice Manager attendance -> `6104 - Local Non-Clinical`
- Add GL subtotals to meeting attendance invoices so Finance can see the split where an invoice contains more than one type.

4. Preserve correct stored GL codes for newly created claims
- Update the claim creation path in `src/hooks/useNRESBuyBackClaims.ts` so new staff snapshots store `gl_code` / `gl_category` as `6100` or `6104` for these categories.
- This prevents newly generated emails, PDFs and dashboards from falling back to older values like `5411`, `5421`, `N/A`, or `PML`.

5. Fix the meeting attendance fallback currently using `PML`
- In the meeting attendance log flow, replace the fallback `gl_code: 'PML'` with the correct role-based GL code.
- This covers the case where a meeting staff member was created directly on the claim rather than from a configured management role.

6. Align the visible dashboards/emails where they show GL codes
- Update the PML/practice/verifier claim-line displays so these categories show the same mapped codes.
- Update invoice email rows/subtotals so the email content matches the PDF invoice.

Verification after implementation

- Check TypeScript/build verification output from the harness.
- Generate or inspect representative invoice paths for:
  - GP Partner meeting attendance
  - Practice Manager meeting attendance
  - NRES Management hours
  - GP Locum, if present in the same GL family
- Confirm the PDF table and subtotal labels read exactly as requested, using British English date/number formatting already present in the app.