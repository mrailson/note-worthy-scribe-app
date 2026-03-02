

# Prevent Transcript Crossover Between Consecutive Meetings

## Problem
When a user ends one meeting and quickly starts another, late-arriving transcription chunks from the first meeting can bleed into the second meeting's transcript. This happened to Jessica where Angela's performance feedback appeared at the start of Dr. Abbey's meeting transcript.

## Root Cause
1. `DesktopWhisperTranscriber.processAudioChunks()` runs asynchronously after `stopTranscription()` begins -- it can still write to the database using `this.meetingId` even after the stop flow has started
2. `persistIOSChunk()` in `MeetingRecorder.tsx` reads `sessionStorage.getItem('currentMeetingId')` at persist time, not at capture time -- if a new meeting has started, it writes to the wrong meeting
3. Real-time transcript buffers (`assemblyPreview`, `deepgramPreview`) are only cleared in `resetMeeting()`, which runs after the async stop flow completes

## Solution: Three Guard Rails

### 1. Add `stopped` flag to `DesktopWhisperTranscriber`

**File**: `src/utils/DesktopWhisperTranscriber.ts`

- Add a `private stopped = false` property
- Set `this.stopped = true` at the very start of `stopTranscription()` (before any async work)
- In `processAudioChunks()`, check `if (this.stopped)` before the database insert (lines ~1039-1115) and skip the write if true
- Also capture `this.meetingId` into a local variable at the start of `processAudioChunks()` so even if the instance is reused, the chunk is tagged with the correct meeting

### 2. Add generation counter to `MeetingRecorder.tsx`

**File**: `src/components/MeetingRecorder.tsx`

- Add `const recordingGenerationRef = useRef(0)` near other refs
- Increment `recordingGenerationRef.current++` at the very start of `stopRecording()` (before any async work)
- In `persistIOSChunk()`: capture the generation at the point `handleBrowserTranscript` is called, and compare it before persisting. If stale, log and skip
- In `handleBrowserTranscript`: capture the generation when the callback fires and skip the entire function body if the generation has moved on

### 3. Clear real-time buffers and sessionStorage immediately on stop

**File**: `src/components/MeetingRecorder.tsx`

- At the start of `stopRecording()` (right after incrementing the generation counter):
  - Call `assemblyPreview.clearTranscript()` and `deepgramPreview.clearTranscript()` immediately
  - Capture `sessionStorage.getItem('currentMeetingId')` into a local variable for use throughout the stop flow
  - Then call `sessionStorage.removeItem('currentMeetingId')` synchronously so no stale callbacks can read it

## Technical Details

### DesktopWhisperTranscriber changes

```text
// New property
private stopped = false;

// At start of stopTranscription():
this.stopped = true;

// In processAudioChunks(), before DB insert block (~line 1039):
if (this.stopped) {
  console.log('Skipping DB write -- transcriber stopped');
  // Still send to UI callback so final text isn't lost from display
  // but don't persist to database
}
```

### MeetingRecorder generation counter

```text
// New ref
const recordingGenerationRef = useRef(0);

// At start of stopRecording():
recordingGenerationRef.current++;
const stopGeneration = recordingGenerationRef.current;

// In handleBrowserTranscript:
const capturedGeneration = recordingGenerationRef.current;
// ... later in persistIOSChunk:
if (capturedGeneration !== recordingGenerationRef.current) {
  console.log('Stale iOS chunk -- generation mismatch, skipping');
  return;
}
```

### Buffer clearing in stopRecording

```text
// At start of stopRecording(), before async work:
assemblyPreview.clearTranscript();
deepgramPreview.clearTranscript();
const capturedMeetingId = sessionStorage.getItem('currentMeetingId');
sessionStorage.removeItem('currentMeetingId');
// Use capturedMeetingId (local var) for the rest of the stop flow
```

## Impact Assessment
- **No effect on existing meetings or data** -- these are purely runtime guards
- **No database schema changes** -- only application code
- **Backward compatible** -- the `stopped` flag defaults to `false`, so existing single-meeting flows are unaffected
- **Files modified**: 2 (`DesktopWhisperTranscriber.ts`, `MeetingRecorder.tsx`)

