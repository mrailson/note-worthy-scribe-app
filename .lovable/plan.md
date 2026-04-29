The formatting is off because the notes content being rendered contains raw markdown/table syntax that is no longer being reliably converted before display/email. In your screenshots I can see two related symptoms:

1. In the notes modal, a whole numbered section is being shown as one long paragraph, with raw markers like `--- ### Key Points ###` left in the text.
2. In the emailed body, Outlook is receiving the same unnormalised content, so headings, numbered sections, and markdown tables collapse into dense blue/black text instead of proper sections, paragraphs, bullets, and tables.

This is not a Word-only problem; it is a formatting pipeline problem. The Word attachment may now generate, but the source content needs normalising before it is displayed, emailed, and exported.

Plan to fix it:

1. Add a meeting-notes normalisation helper
   - Clean obvious markdown artefacts such as inline `---`, repeated `###`, escaped asterisks, and divider lines.
   - Split collapsed numbered agenda items back onto separate lines.
   - Convert malformed table-like lines using `|` into proper markdown table blocks where possible.
   - Preserve important governance prefixes such as **RESOLVED**, **AGREED**, and **NOTED** and keep them visually distinct.
   - Keep British English/date/time conventions unchanged.

2. Apply the normaliser to the notes modal display
   - Use the cleaned content before rendering the notes tab in `SafeModeNotesModal` / related modal render path.
   - Ensure numbered points appear as separate paragraphs rather than one wall of text.
   - Ensure action/risk table sections show as tables or readable rows, not raw pipes.

3. Apply the same normalisation before email HTML generation
   - Update `src/utils/meetingEmailBuilder.ts` so `convertToStyledHTML()` handles collapsed numbered sections and imperfect markdown tables.
   - Make the Outlook HTML more robust by using simple email-safe tables/paragraphs rather than relying on markdown-looking plain text.
   - Remove the duplicate full-notes body from the email if required, or keep it but properly formatted; the email currently says “summary below” but then includes the full raw notes, which is why the message becomes huge.

4. Apply the same cleanup before Word generation
   - Feed cleaned content into `generateProfessionalWordFromContent()` / `generateProfessionalWordBlob()`.
   - Keep the earlier safety fallback for blank action deadlines (`TBC`) so DOCX generation does not fail.
   - Ensure action tables use safe default values for action, owner, deadline, and priority.

5. Improve error visibility
   - Keep clearer toast errors for failed Word downloads.
   - Add console warnings around malformed table conversion so we can diagnose future bad AI output without exposing this to users.

Technical notes:

- Likely files to update:
  - `src/utils/meetingEmailBuilder.ts`
  - `src/utils/generateProfessionalMeetingDocx.ts`
  - `src/components/SafeModeNotesModal.tsx` or the shared renderer it uses
  - possibly `src/components/MeetingHistoryList.tsx` for the quick Word button path
- I will not change the meeting generation model itself first, because existing stored notes already contain malformed markdown. The immediate fix should clean both existing and future notes at render/export time.
- After implementation, I will verify the same meeting path visually in the modal and check that the email/Word source conversion no longer leaves raw `###`, `---`, or broken pipe-table output.