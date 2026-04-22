

## Plan: Auto-Send Email with Word Doc After Manual Note Generation

### Summary

When a user manually clicks "Generate Notes" (or "Regenerate Notes") via the `ManualNoteGenerationButton`, the system currently generates notes but does not send the automated email. This change will trigger the same email-with-Word-attachment flow that the automatic pipeline uses, immediately after notes are successfully generated.

### What Changes

**File: `src/components/meeting-recovery/ManualNoteGenerationButton.tsx`**

1. After the successful `generate-meeting-notes-claude` edge function call (line 89), add a call to the existing `sendMeetingNotesEmail` helper from `src/utils/sendMeetingNotesEmail.ts`.
2. Look up the current user's email from `supabase.auth.getUser()`.
3. Call `sendMeetingNotesEmail({ meetingId, recipientEmail: userEmail })` — this helper already handles fetching the meeting summary, building the HTML email, generating the Word attachment, and sending via the `send-meeting-email-resend` edge function.
4. Add a brief delay (~3 seconds) before calling the email helper, to allow the edge function to commit the generated notes/summary to the database.
5. Show a toast on email success ("Meeting notes emailed to you") or a warning toast if the email fails (non-blocking — notes were still generated successfully).

### Technical Details

- The `sendMeetingNotesEmail` utility already exists and is battle-tested across desktop and mobile flows.
- No new edge functions or database changes are needed.
- The email send is wrapped in a try/catch so a failure does not affect the "notes generated successfully" outcome.
- The button's loading state will remain active until both note generation and email sending complete.

