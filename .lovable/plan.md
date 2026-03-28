

# Skip Meeting Creation for Short Offline Recordings (< 100 Words)

## Problem
When offline recordings are synced and the transcript is under 100 words, a meeting is still created and notes are generated. The AI hallucinates content from the detailed system prompt, producing emails full of fabricated information.

## Solution
Add a word count guard at all three meeting creation points in `NoteWellRecorderMobile.jsx`. When the transcript is under 100 words, skip meeting creation entirely — show a clear toast explaining the recording was too short, mark the recording as complete, and don't generate notes or send emails.

## Changes

### `src/components/recorder/NoteWellRecorderMobile.jsx`

Add a `MIN_WORDS_FOR_MEETING = 100` constant and guard at these three locations:

1. **Resumed transcribed recording sync** (~line 1178): After computing `wordCount`, check if < 100. If so, show toast "Recording too short (X words) — meeting not created. At least 100 words needed.", set sync progress to complete, and return early.

2. **Main chunked sync** (~line 1410-1450): After stitching `fullTranscript` and computing `wordCount`, same guard before the `meetingInsert` block.

3. **Legacy single-file sync** (~line 1642): After computing `wordCount`, same guard before the legacy meeting insert.

In all three cases:
- Show an informative toast: "Recording too short (X words) — at least 100 words needed for meeting notes"
- Update the IndexedDB record status to `"too_short"` so it's visually distinct from errors
- Set sync progress to complete so the UI doesn't hang
- Do **not** create a meeting, generate notes, or trigger email

### UI indicator
In the recordings list rendering, handle `status === "too_short"` with an amber badge saying "Too short" so the user understands why no meeting was created.

