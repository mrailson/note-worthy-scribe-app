
Goal: Remove the duplicate non-table “Action Items” text from the meeting notes modal while keeping the Action Items table visible and unchanged.

What I found
1) In `SafeModeNotesModal`, Action Items stripping is currently inconsistent across render paths:
   - `plain` view shows raw `notesContent` directly.
   - `formatted` has two sub-paths:
     - section cards (`sections.length > 0`)
     - fallback interactive renderer (`sections.length === 0`) using `contentWithoutActionItems`.
2) The current stripping relies on fragile regex and doesn’t cover all heading variants reliably, so Action Items can still leak through in some meetings.
3) Save/rebuild logic currently matches Action Items with narrow patterns, which can reintroduce sections after edits.

Implementation plan
1) Create one shared display-cleaning helper for modal rendering
   - Add a robust helper (line-based parser, not a single regex) to remove:
     - “Action Items” section
     - “Completed/Completed Items” section
   - Support heading variants (`#`, `##`, bold headings like `**ACTION ITEMS**`, optional `:`).
   - Stop removal at the next true section boundary.

2) Use that helper in every notes-modal display path
   - `plain` mode: render cleaned content (not raw `notesContent`).
   - section parsing (`parseNotesIntoSections` input): use cleaned content.
   - fallback interactive content: use cleaned content before rendering/editing.
   - Keep `InlineActionItemsTable` behavior unchanged.

3) Harden edit/save preservation logic
   - Replace narrow `actionItemsMatch` extraction with a robust extractor that only preserves actual action/completed blocks (not everything to end of document).
   - Ensure edits to notes body do not reinsert duplicate Action Items text.

4) Verification checklist (must pass before closing)
   - Open the exact affected meeting (the one showing “# Action Items” under notes): confirm no non-table Action Items text appears.
   - Confirm Action Items table still appears and functions.
   - Switch between plain/formatted modes: no Action Items text in either.
   - Edit and save notes: Action Items text must not come back.
   - Spot-check one legacy meeting with bold headings (`**ACTION ITEMS**`) to confirm removal works there too.

Technical implementation details
- Primary file: `src/components/SafeModeNotesModal.tsx`
- Optional helper location: `src/utils/meeting/cleanMeetingContent.ts` (extend with robust section-stripper to avoid future duplicate regex logic)
- Keep storage/export logic intact; this change is focused on modal display consistency and save-flow stability.
