

# Fix: Meeting Overview UI Not Updating After Note Generation

## Problem
The "Generate Meeting Notes" button successfully generates notes on the server (confirmed in logs and database — status is `completed`, overview exists), but the UI stays stuck showing "Transcript available but notes haven't been generated yet." There is no mechanism to detect when generation finishes and refresh the displayed data.

## Root Cause
`MeetingDetailsTabs.tsx` fires the edge function and sets status to `queued`, but has no realtime subscription or polling to detect when `notes_generation_status` changes to `completed`. The parent `MeetingHistoryList` passes `notesGenerationStatus` and `currentOverview` as props but never re-fetches after generation.

## Solution
Add a Supabase realtime subscription inside `MeetingDetailsTabs` that listens for changes to the meeting row. When `notes_generation_status` transitions to `completed`, trigger `onOverviewChange` with the new overview and update the local generation status — causing the "generate" prompt to disappear and the overview to render.

### Changes

**`src/components/meeting-details/MeetingDetailsTabs.tsx`**
1. After `handleGenerateNotes` sets status to `queued`, subscribe to realtime changes on the specific meeting row
2. When a `completed` status is received, re-fetch the meeting's `overview` and `notes_generation_status` from the database
3. Call `onOverviewChange(newOverview)` to update the parent state
4. Show a success toast: "Meeting notes generated successfully"
5. Clean up the subscription on unmount or when generation completes
6. Handle `failed`/`error` status with an error toast

This is a targeted fix — no other files need changing. The parent already handles `onOverviewChange` to update local state (line 2831-2835 of MeetingHistoryList).

