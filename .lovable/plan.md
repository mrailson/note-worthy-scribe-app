Yes — that is the right direction. The safest fix is not to make the modal/email/document parsers more tolerant, but to make imported transcript meetings arrive at the same stored notes contract that recorded meetings already produce.

## Plan

1. Align imported transcript note generation with recorded meetings
   - Trace the recorded-meeting post-notes path and reuse the same final formatting contract for imports.
   - Keep the imported transcript entry point, but ensure the final saved `meeting_summaries.summary` looks like the recorded output: section headings on their own lines, markdown preserved, no collapsed headings/body text.
   - Do not change `SafeModeNotesModal` parsing.
   - Do not change the email formatter to mask bad markdown.

2. Fix the chunked merge clean-up bug
   - Update the `merge-meeting-minutes` tone-audit clean-up so it no longer collapses newlines with `\s{2,}`.
   - Replace that with line-safe whitespace normalisation: collapse repeated spaces/tabs inside lines, preserve paragraph and heading breaks.
   - Add a small final guard in the merge output to keep required headings on separate lines if Claude returns them too tightly.

3. Make long imported transcripts follow the same final markdown contract as short/recorded meetings
   - Keep the chunked summarisation path for long imports, because very long transcripts still need chunking.
   - Change only the final reduce/merge stage so it emits the same section order and line structure used by recorded notes:
     - `# MEETING DETAILS`
     - `Date:`
     - `Time:`
     - `# EXECUTIVE SUMMARY`
     - `# ATTENDEES` where available
     - `# DISCUSSION SUMMARY`
     - `# DECISIONS REGISTER`
     - `# ACTION ITEMS`
     - `# OPEN ITEMS & RISKS`
     - `# NEXT MEETING`
   - Ensure `# OPEN ITEMS & RISKS` remains bullets, not a markdown table.

4. Confirm imported meetings use the same completion-email trigger route as recorded meetings
   - Check all transcript import creation paths, not just `useMeetingImporter.ts`, because the recent Northamptonshire rows still showed `import_source = null`.
   - Set `import_source` consistently for transcript imports before notes are generated.
   - Keep the existing mobile/recorded DB trigger mechanism and its allow-list; only ensure imported rows enter it correctly.
   - Do not change `deliver-mobile-meeting-email` behaviour unless inspection shows a direct mismatch with recorded meetings.

5. Keep resend and auto-email on the same source of truth
   - Manual resend should continue to use the stored `meeting_summaries.summary`.
   - Auto-email should continue to use the same stored summary.
   - The fix should therefore improve both the email body and Word attachment by fixing the stored imported-summary markdown upstream.

6. Deployment and verification boundaries
   - Any changed edge function under `supabase/functions/` will need redeployment after editing.
   - I will not invoke the live email function or send test emails myself.
   - I will not run live-preview automated checks.
   - I will list every modified file and every new file after implementation.

## Manual test plan after implementation

1. Short transcript import
   - Import a short transcript under the chunking threshold.
   - Confirm the notes modal renders Date, Executive Summary, Discussion Summary, and Open Items & Risks correctly.
   - Confirm the completion email arrives automatically.
   - Confirm the email body is not unexpectedly capitalised.
   - Confirm the Word attachment has clean section formatting.

2. Long transcript import
   - Import a long transcript over 50k characters.
   - Confirm the stored/generated notes have headings on separate lines.
   - Confirm the notes modal renders the same sections as a recorded meeting.
   - Confirm the completion email arrives automatically.
   - Confirm the email body and Word attachment match the recorded-meeting quality.

## Technical notes

The key root cause is the chunked merge function collapsing markdown structure after Claude has generated the notes. Recorded meetings already produce the correct structure, so the target is to make imports preserve that same markdown contract before the notes are saved and emailed.