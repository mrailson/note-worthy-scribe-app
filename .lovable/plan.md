

## Plan: Server-Side Email Trigger After Note Generation

### Problem

Currently, when a user clicks "Regenerate Notes", the note generation runs server-side (edge function), but the email-with-Word-attachment is triggered client-side afterwards. If the user closes the browser before the 3-second delay and email call complete, the email is never sent.

### Solution

Move the email trigger into the `generate-meeting-notes-claude` edge function itself, so once notes are generated and saved to the database, the edge function calls `send-meeting-email-resend` server-side before returning. This means the user can close the browser immediately after clicking the button and the email will still arrive.

### What Changes

**1. `supabase/functions/generate-meeting-notes-claude/index.ts`**

At the end of the function, after notes are successfully saved to the database:

- Accept an optional `meetingId` parameter from the request body (already passed by the client)
- Look up the user's email from the meeting's `user_id` via `auth.users`
- Call `send-meeting-email-resend` internally using the Supabase service-role client (`supabase.functions.invoke(...)`)
- Wrap in try/catch so email failure does not break the note generation response
- Log success/failure for debugging

**2. `src/components/meeting-recovery/ManualNoteGenerationButton.tsx`**

- Remove the client-side email sending block (the 3-second delay, `getUser()`, `sendMeetingNotesEmail` call, and associated toast)
- Replace with a simple success toast noting that notes have been generated and emailed
- The `sendMeetingNotesEmail` import can be removed

### Technical Details

- The edge function already has a service-role Supabase client, so it can look up the user's email from `auth.users` and invoke `send-meeting-email-resend`
- The `send-meeting-email-resend` edge function is already used by `deliver-mobile-meeting-email` and `graceful-end-meeting` in exactly this server-to-server pattern
- No new edge functions or database changes are needed
- The email will be sent even if the browser is closed, because the entire flow runs server-side

