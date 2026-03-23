

# Fix: MeetingRecorder Should Use `auto-generate-meeting-notes` Instead of Direct `generate-meeting-notes-claude`

## Problem

When a recording stops, `MeetingRecorder.tsx` (line 5897) calls `generate-meeting-notes-claude` directly. This function only generates notes — it does NOT:
- Generate a descriptive AI title (via `generate-meeting-title`)
- Fetch attendees, agenda, documents, or meeting format context
- Clean the transcript via chunked GPT cleaning
- Auto-detect meeting format (Teams/hybrid/face-to-face)

The "Regenerate Notes" action menu in `MeetingHistoryList.tsx` (line 1588) calls `auto-generate-meeting-notes`, which does ALL of the above — that's why regeneration produces correct titles and better-formatted notes.

## Fix

Replace the direct `generate-meeting-notes-claude` call in `MeetingRecorder.tsx` with a call to `auto-generate-meeting-notes`, matching what the action menu uses.

### In `src/components/MeetingRecorder.tsx` (around lines 5897-5909)

Change from:
```typescript
const functionResult = await supabase.functions
  .invoke('generate-meeting-notes-claude', {
    body: { 
      transcript: meetingData.transcript,
      meetingTitle: savedMeeting.title || 'Meeting Notes',
      meetingDate: ...,
      meetingTime: ...,
      detailLevel: ...,
      modelOverride,
      meetingId: savedMeeting.id,
      skipQc,
    }
  });
```

To:
```typescript
const functionResult = await supabase.functions
  .invoke('auto-generate-meeting-notes', {
    body: { 
      meetingId: savedMeeting.id,
      forceRegenerate: false,
      modelOverride,
      skipQc,
    }
  });
```

This single change ensures first-run generation goes through the same pipeline as manual regeneration: title generation, transcript cleaning, attendee merging, format detection, and governance-grade notes.

### Also remove the separate `generate-meeting-overview` call (lines 5921-5928)

The `auto-generate-meeting-notes` function already generates the overview internally, so the separate call on lines 5921-5928 becomes redundant and should be removed.

## Files to Change

- `src/components/MeetingRecorder.tsx` — replace `generate-meeting-notes-claude` with `auto-generate-meeting-notes`, remove redundant overview call

