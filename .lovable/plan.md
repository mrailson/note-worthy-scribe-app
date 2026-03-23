

# Fix: Mobile (Live) Recordings Missing Auto-Generation and Email

## Problem

When recording via Mobile (Live), the meeting is created with a transcript but:
- No auto-generated descriptive title (stays as "Meeting 23 Mar 09:12")
- No meeting notes generated
- No email sent
- No overview generated

Desktop recordings now work correctly because they use the `auto-generate-meeting-notes` orchestrator. But the mobile recorder still calls `generate-meeting-notes-claude` directly and manually handles title/overview/email in separate functions.

## Root Cause

`NoteWellRecorderMobile.jsx` has its own `generateNotesForMeeting` function (line 866) that:
1. Calls `generate-meeting-title` manually
2. Calls `generate-meeting-notes-claude` directly (not the orchestrator)
3. Manually saves to `meeting_summaries` and `meetings.notes_style_3`
4. Then calls `triggerPostNoteActions` which manually handles overview and email

This bypasses the unified `auto-generate-meeting-notes` orchestrator that handles everything: title, transcript cleaning, attendee merging, notes generation, overview, and more.

## Plan

### 1. Replace `generateNotesForMeeting` with a call to `auto-generate-meeting-notes`

Replace the entire `generateNotesForMeeting` function (lines 866-908) with a simple orchestrator call, matching what `MeetingRecorder.tsx` now does:

```javascript
const generateNotesForMeeting = async (meetingId) => {
  const storedModel = localStorage.getItem('meeting-regenerate-llm');
  const modelOverride = !storedModel || storedModel === 'gemini-3-flash' 
    ? 'claude-sonnet-4-6' : storedModel;

  const { data, error } = await supabase.functions.invoke('auto-generate-meeting-notes', {
    body: { meetingId, forceRegenerate: false, modelOverride, skipQc: true }
  });

  if (error) throw new Error(error.message || 'Note generation failed');
  return data;
};
```

### 2. Add auto-email after orchestrator completes

The orchestrator handles title, notes, and overview — but NOT the email. After the orchestrator returns, trigger the email send using the existing `triggerPostNoteActions` logic but stripped down to just the email portion (since overview is now handled by the orchestrator).

Simplify `triggerPostNoteActions` (lines 911-1043) to only handle the auto-email step, removing the overview generation call (line 922-924) since the orchestrator now does that.

### 3. Update all call sites

There are 4 places that call `generateNotesForMeeting` with `(meetingId, transcript, title)` — update them all to just pass `(meetingId)` since the orchestrator fetches transcript from the database:
- Line 1098 (resume sync for transcribed recordings)
- Line 1331 (retry meeting creation)
- Line 1379 (main chunked sync)
- Line 1510 (legacy single-file sync)

## Files to Change

- `src/components/recorder/NoteWellRecorderMobile.jsx` — replace `generateNotesForMeeting` with orchestrator call, simplify `triggerPostNoteActions` to email-only, update all call sites

