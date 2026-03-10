

## Redesign Document Approval Email Template

### What changes

Rewrite the shared `emailWrapper`, `primaryButton`, and `infoRow` helpers in `supabase/functions/send-approval-email/index.ts` plus update the per-type HTML sections to produce a polished, NHS-branded email.

### Template redesign (all inline CSS, mobile-responsive)

**1. `emailWrapper` — new branded header & subtle footer**
- Header: solid NHS blue (`#005EB8`) bar with "Notewell AI" in white, 20px font, left-aligned with a thin accent underline in `#41B6E6`
- Body: white `#ffffff`, 600px max-width, centered, 0 outer padding
- Footer: light grey `#f8fafc` background, "Powered by Notewell AI" in 11px `#94a3b8` text, no "Document Approval Service" line — keep it minimal

**2. `infoRow` — wrap in a styled card**
- Instead of a bare `<table>`, wrap the info rows in a container `<div>` with `border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; background: #f8fafc; margin: 20px 0`
- Labels in `#64748b`, values in `#1a1a2e` bold — consistent 14px sizing
- Remove emoji prefixes (📄, 📁, 👤, 📅) for a cleaner professional look

**3. `primaryButton` — large NHS green CTA**
- Full-width block button: `background: #007f3b`, white text, `border-radius: 6px`, `padding: 16px`, `font-size: 16px`, `font-weight: 700`, centered text
- Remove the old gradient style

**4. New `secondaryButton` helper — "View Document" link**
- Below the primary button: a lighter outlined button or text link in NHS blue `#005EB8`, `font-size: 14px`, underlined, centered
- Added to `request` and `reminder` type emails pointing to the approval URL

**5. Per-type template updates**
- **Request**: Use new card for document details, NHS green "Approve Document" button, secondary "View Document" link below
- **Reminder**: Same card + button treatment, keep the warning banner
- **Confirmation**: Keep green success styling, use updated wrapper/footer
- **Completed / Send_completed**: Use updated wrapper, keep signatory table as-is with clean header
- **Declined**: Use updated wrapper, keep red alert styling

### File changes

Only `supabase/functions/send-approval-email/index.ts` — updating lines 32-61 (shared helpers) and the HTML in each type section to reference the new helpers. Then redeploy.

