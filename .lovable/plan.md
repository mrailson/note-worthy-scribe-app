
What I found

- The normal desktop auto-email flow lives in `src/components/PostMeetingActionsModal.tsx`.
- Offline iPhone sync does not use that flow at all. It uses a separate mobile-only path in `src/components/recorder/NoteWellRecorderMobile.jsx`:
  - `generateNotesForMeeting()`
  - `pollAndEmailIfReady()`
  - `triggerPostNoteActions()`
- That means earlier fixes in the desktop/modal path would not have fixed this issue.

Most likely reasons it is failing

1. `pollAndEmailIfReady()` only waits about 2 minutes. If note generation finishes later, the email is never attempted.
2. `triggerPostNoteActions()` fetches the current user again after a long sync. On iPhone, that session can be stale by then, so it can exit before sending.
3. The mobile path does not properly validate the result from `send-meeting-email-resend`, so a failed send can be silently treated like success.

Plan to fix it safely

1. Extract a shared “send meeting notes email” helper from the existing working logic so mobile, desktop, and manual email use the same send code.
2. Update the offline iPhone/mobile sync path to use that helper instead of its own separate send sequence.
3. In the mobile flow, capture the recipient email earlier, refresh auth again before post-note actions, and only mark success if the email function really returns success.
4. Replace the short fixed poll with a longer, bounded retry that checks both `meetings.notes_generation_status` and `meeting_summaries`.
5. Add a meeting-level dedupe/retry guard so failed mobile auto-sends can retry safely without creating duplicate emails.
6. Keep the desktop modal flow and manual “Email notes to me” action functionally unchanged, apart from reusing the same helper.

Technical details

- Main file to change: `src/components/recorder/NoteWellRecorderMobile.jsx`
- Likely shared/reused files:
  - `src/components/PostMeetingActionsModal.tsx`
  - `src/components/mobile-meetings/MobileExportSheet.tsx`
  - existing builders such as `src/utils/meetingEmailBuilder.ts`
- I would avoid changing the email edge function first, because the same send function is already used elsewhere; the weaker point is the mobile caller.

Risk control

- Scope the behavioural change to the mobile/offline path first.
- Reuse the current HTML and Word attachment builders so the email output stays the same.
- Add explicit success/error handling and dedupe guards so we fix the silent failure without breaking the existing desktop behaviour.

Checks after implementation

- Desktop recording still auto-emails exactly as before.
- Mobile live recording still behaves as before.
- Offline iPhone sync sends automatically after both short and long note-generation runs.
- If sending genuinely fails, the app shows a real failure and can retry, instead of quietly doing nothing.

Confidence note

- I could not verify the exact failing runtime from logs in this session, but the code makes the root issue area clear: the offline iPhone sync uses a separate, more brittle auto-email path than the desktop flow. That is the safest place to fix first without breaking existing functionality.
