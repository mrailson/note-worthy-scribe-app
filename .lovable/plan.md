
Problem confirmed: the first-generation path is not using the same persistence/output contract as the regenerate path, so the UI, email, and Word export are reading the wrong fields after the initial run.

What I found:
- Initial desktop/mobile creation now calls `generate-meeting-notes-claude`.
- That function writes the full notes to `meeting_summaries.summary` and QC metadata, but does not populate `meetings.notes_style_3` or reliably drive the downstream “standard minutes” display contract.
- The meeting history cards and overview tabs still primarily surface `meeting.overview` / `meeting.notes_style_3`, which is why the first result looks like the lightweight overview/plain version.
- The regenerate action still uses `auto-generate-meeting-notes`, and that path writes `meetings.notes_style_3`, action items, and the richer structure your screenshots show. That is why “regenerate on the same meeting” looks correct.
- The current email/Word flows also have regressions:
  - `PostMeetingActionsModal` has been changed to a weaker local docx builder with plain fallback.
  - `export-docx` is currently returning a `.txt` payload, which is a hard regression if anything still hits that route.
  - `EmailMeetingMinutesModal` still uses the better professional generator, so the app now has inconsistent Word-generation paths.

Implementation plan

1. Restore one authoritative “standard meeting notes” contract
- Make initial meeting generation persist the same outputs that regenerate relies on:
  - save full standard notes into `meeting_summaries.summary`
  - mirror the same content into `meetings.notes_style_3`
  - set `meetings.notes_generation_status = 'completed'`
- Ensure this happens from the initial `generate-meeting-notes-claude` flow so first-run and regenerate produce identical downstream data.

2. Align first-generation UI with the same source as regenerate
- Update first-load meeting history / modal flows to prefer `meeting_summaries.summary` as the authoritative standard notes source, not `overview`.
- Keep `overview` only for the meeting overview card/tab, not as a fallback replacement for full minutes.
- Review these entry points specifically:
  - `MeetingHistoryList`
  - `MeetingRecorder` modal/open-summary path
  - `PostMeetingActionsModal`
  - any mobile notes sheet paths that still prefer overview before standard notes

3. Keep regenerate on the unified pipeline, not the legacy output mismatch
- Replace standard-note regeneration calls that still use `auto-generate-meeting-notes` with the same unified `generate-meeting-notes-claude` pipeline plus the same persistence step as initial generation.
- If `auto-generate-meeting-notes` must remain for compatibility, limit it to fallback/manual recovery only, not the main “standard minutes” path.
- This removes the current split-brain behavior where first generation and regenerate save different shapes of data.

4. Restore the professional Word document path everywhere
- Remove the new plain/minimal Word generation as the primary meeting-minutes path.
- Reuse the existing professional generator consistently for:
  - post-meeting auto-email
  - manual “Email meeting minutes”
  - meeting Word export buttons
- Keep fallback only as a last resort, but it must still use branded/professional structure rather than raw plain paragraphs.
- Audit `PostMeetingActionsModal`, `useAutoEmail`, and any export helpers for regressions introduced by the recent attachment changes.

5. Fix the broken DOCX edge export regression
- `supabase/functions/export-docx/index.ts` currently returns `text/plain` with a `.txt` attachment name.
- Replace or retire this fallback so no meeting-email/export path can produce a disguised text file instead of a real `.docx`.
- Confirm all meeting email/export flows send a genuine DOCX MIME type and professional filename.

6. Preserve meeting details in first-run outputs
- Ensure the initial path passes and persists all authoritative metadata needed for the “correct” output:
  - title
  - date/time
  - location / meeting format
  - attendees where available
  - notes config / section settings
- The DB check on your failing example shows the meeting had null `meeting_format`, null `meeting_location`, and null `participants`, so the first-run prompt had less metadata than the corrected display. I’ll harden the initial save/generation handoff so metadata is populated before notes generation runs, and where unavailable, the UI/export layer will source from the meeting record + attendees tables instead of trusting the note body alone.

Technical details
- Root mismatch:
  - `generate-meeting-notes-claude` writes `meeting_summaries.summary`
  - regenerate / legacy path writes `meetings.notes_style_3`
  - history cards use `meeting.overview`
  - full notes modal often prefers `notes_style_3`
- This means the first-run generation can be “correct” in the summaries table but still appear wrong everywhere the user actually sees/exports/emails it.
- The real fix is not prompt tuning first; it is making every path read/write the same canonical standard-notes fields.

Files likely involved
- `supabase/functions/generate-meeting-notes-claude/index.ts`
- `src/components/MeetingRecorder.tsx`
- `src/components/MeetingHistoryList.tsx`
- `src/components/PostMeetingActionsModal.tsx`
- `src/components/EmailMeetingMinutesModal.tsx`
- `src/hooks/useAutoEmail.ts`
- `supabase/functions/export-docx/index.ts`
- possibly `src/components/mobile-meetings/MobileExportSheet.tsx`

Expected result after implementation
- The very first meeting generation will produce the same rich standard minutes as “Action → Regenerate Meeting”.
- The meeting history card/modal will show the correct standard notes with the meeting details section.
- Auto-email and manual email will attach the proper professional Word document again.
- No plain-text DOCX regressions.
