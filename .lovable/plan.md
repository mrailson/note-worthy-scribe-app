Revised plan for the Management invoice description tools

I will design this so Management can build invoice wording in two ways: normal narrative text, or a neat table that prints cleanly on the invoice PDF.

What will be added

1. Voice-to-description input
- Add a “Speak description” button in the Management invoice description section.
- The user can dictate the description, then stop recording.
- The transcription will be inserted into the invoice description box without replacing existing wording unless the user clears it first.
- The text will be appended neatly, with sensible spacing/new lines.
- The existing 1500 character limit will still be enforced.

2. Quick date/start/stop line builder
- Add a compact “Quick line” tool beside the description box.
- One click can set:
  - Date
  - Start time
  - Stop time
- When the stop time is clicked, the completed line is inserted and the controls reset ready for the next entry.
- Dates will use British format, for example `29/04/2026`.
- Times will show hours and minutes only, for example `09:15`, never seconds.

3. Optional table mode
- Add a format toggle with two options:
  - “Text” for normal invoice wording.
  - “Table” for structured date/time entries.
- In Table mode, the quick line builder will add entries into a small editable table with columns such as:

```text
Date         Start   Stop    Details
29/04/2026   09:15   10:45   Management meeting support
30/04/2026   13:00   14:30   Invoice review and follow-up
```

- The user will be able to edit the “Details” field for each row.
- Add simple row actions: remove row, add another row, and optionally move rows if needed.
- The table will also be inserted/represented in the invoice description area in a readable plain-text fallback, so the current save field remains compatible.

4. Invoice PDF table rendering
- Update the invoice PDF generator so it recognises structured invoice table data and prints it as a proper table rather than a long paragraph.
- The PDF preview will show the table exactly as it will print before saving and after saving.
- If the user uses normal text mode, the existing “Claim details” box will continue to print as it does now.
- If the user uses table mode, the PDF will print a neat “Claim details” table with date, start, stop and details columns.

5. Save and preview behaviour
- “Preview invoice” will continue to work with unsaved text/table entries.
- “Save description” will save the latest description/table content.
- If a claim already has saved wording, opening it will load the saved content and allow further editing.
- No database schema change is required unless we decide a fully structured table must persist as JSON separately. The default implementation will keep compatibility by storing a formatted representation in the existing `practice_notes` field.

Technical details

- Main UI file: `src/components/nres/hours-tracker/BuyBackVerifierDashboard.tsx`.
- PDF file: `src/utils/invoicePdfGenerator.ts`.
- Reuse the existing speech-to-text function/path already present in the project rather than introducing a new provider.
- Use compact styling suitable for 1366x768 NHS laptop screens.
- Keep British English labels and date formatting throughout.
- Add defensive handling for microphone permissions, empty recordings, failed transcription and character-limit overflow.

Expected user workflow

```text
Open Management claim
↓
Choose Text or Table
↓
Speak description OR click Date → Start → Stop for each row
↓
Add/edit details if needed
↓
Preview invoice PDF
↓
Save description when happy
```

This gives Management a quick way to create 10+ dated time entries either by voice or by repeated one-click date/time capture, while still letting them preview the final invoice layout before saving.