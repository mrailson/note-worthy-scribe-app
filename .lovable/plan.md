

## Disable Tabs During Active Recording

### Problem
Switching between the "Meeting Transcript" and "My Meeting History" tabs whilst a recording is in progress can cause issues — potentially disrupting the active recording session or causing unexpected behaviour.

### Solution
Disable the "Meeting Transcript" and "My Meeting History" tab triggers when `isRecording` is true. The user will remain locked to the "Meeting Recorder" tab until the recording is stopped. A subtle visual indicator (reduced opacity) will make it clear the tabs are unavailable.

### Changes

**File:** `src/components/MeetingRecorder.tsx`

1. Add `disabled={isRecording}` to the "Meeting Transcript" TabsTrigger (line ~6290)
2. Add `disabled={isRecording}` to the "My Meeting History" TabsTrigger (line ~6301)
3. Add a tooltip or title attribute so hovering explains why they're disabled (e.g. "Stop recording to access this tab")
4. Auto-switch back to the "recorder" tab if recording starts whilst on another tab

### What stays the same
- The "Meeting Recorder" tab remains fully active
- The existing toast notification logic is kept as a fallback
- No changes to recording logic itself

