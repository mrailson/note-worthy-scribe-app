

# Add Re-transcribe / Reprocess Button to Mobile Recorder

## Problem
When a mobile recording produces a truncated transcript (e.g., 900 words for a 55-minute meeting), there is no way to retry transcription from the phone. The desktop MeetingHistoryList has a "Re-transcribe" badge, but the mobile `RecordingItem` component in `NoteWellRecorderMobile.jsx` does not.

## What Changes

### 1. Add "Re-transcribe" button to `RecordingItem` component
**File:** `src/components/recorder/NoteWellRecorderMobile.jsx`

In the `RecordingItem` component (line ~399), add a new button that appears when:
- The recording status is `"transcribed"` AND has a `meetingId` (already synced to server)
- The word count looks suspiciously low relative to duration (< 50 words/min)
- OR always show it for transcribed meetings as a general "⟳ Re-transcribe" option

The button will call `supabase.functions.invoke('transcribe-offline-meeting', { body: { meetingId, chunkIndex: 0 } })` — the same edge function the desktop version uses.

### 2. Add `onRetranscribe` callback to `RecordingItem`
Pass a new `onRetranscribe` prop into `RecordingItem`. The parent component will define the handler that:
- Gets the current user session
- Calls the `transcribe-offline-meeting` edge function with `meetingId` and `chunkIndex: 0`
- Shows a toast confirming re-transcription has started
- Displays a spinner on the button while in progress

### 3. Visual design
- Amber-colored pill button (matching the desktop Re-transcribe badge style)
- Shows `"⟳ Re-transcribe"` text, switches to a spinner + `"Transcribing…"` while active
- Positioned in the action buttons area (line ~464), next to the existing Sync/Delete buttons
- Only visible for recordings with status `"transcribed"` that have a `meetingId`

### Technical Details

**Files to modify:**
- `src/components/recorder/NoteWellRecorderMobile.jsx`
  - Add `retranscribingIds` state (Set or object) to the main component
  - Create `retranscribeRecording(rec)` handler that invokes `transcribe-offline-meeting`
  - Pass `onRetranscribe` and `isRetranscribing` props to `RecordingItem`
  - In `RecordingItem`, render the amber re-transcribe button when `rec.status === "transcribed" && rec.meetingId`

**Edge function used:** `transcribe-offline-meeting` (already exists, same as desktop)

**No database or edge function changes required** — this reuses the existing re-transcription pipeline.

