

## Investigate and Fix Premature Recording Stop on Desktop Browser

### Root Cause Analysis

After thorough investigation of the database, edge function logs, session replay, and client-side code, here is what happened:

**Timeline of the meeting (12e5ca30):**
- 14:30:00 - `start_time` recorded
- 14:31:25 - Meeting created in database
- 14:32:01 - `end_time` set (meeting stopped)
- 14:32:03 - Cleanup triggered (notes generation started)
- 14:32:06 - Transcription chunks saved (34 words)
- 14:32:33 - More chunks saved (77 words)

**What was ruled out:**
- Server-side auto-close: The `auto-close-inactive-meetings` function explicitly kept the meeting active at 14:31:34
- Kill signal: No kill signal was found in logs
- Health monitor: The meeting was still in "recording" status when checked
- MediaRecorder error: No error logs found
- Silence auto-stop: Only triggers after 20 minutes
- Tab switching: No navigation or unmount detected in session replay

**Most likely cause: Accidental double-click on the microphone button**

The current stop flow on desktop works like this:
1. First click on mic button calls `handleDoubleClickProtection()` -- shows a toast "Double-click to stop" and waits up to 3 seconds
2. Second click within 3 seconds calls `handleStopWithConfirmation()`
3. `handleStopWithConfirmation` checks if `recordingDuration >= 300` (5 min) OR `wordCount >= 100` -- for short recordings, BOTH are false
4. Recording stops immediately with **no confirmation dialog**

This means for any recording under 5 minutes with fewer than 100 words, a double-click (two clicks within 3 seconds) will silently end the recording. On a desktop browser with a mouse, this is very easy to do accidentally.

---

### Plan

#### Step 1: Always show the stop confirmation dialog (regardless of duration)

Lower the threshold dramatically so the confirmation dialog appears after just **15 seconds** of recording, rather than the current 5 minutes / 100 words gate. This means:

- Recordings under 15 seconds: immediate stop (likely accidental start)
- Recordings over 15 seconds: confirmation dialog always shown

**File:** `src/hooks/useRecordingProtection.ts`

Change the confirmation logic from:
```
const shouldShowConfirmation = recordingDuration >= 300 || wordCount >= 100;
```
To:
```
const shouldShowConfirmation = recordingDuration >= 15;
```

#### Step 2: Add a clear log when recording is stopped

Add a distinctive console log at the very top of `stopRecording` in `MeetingRecorder.tsx` that captures the call stack, so if this happens again we can identify exactly what triggered the stop.

**File:** `src/components/MeetingRecorder.tsx`

Add at the start of `stopRecording`:
```typescript
console.log('STOP_RECORDING_CALLED', {
  source: new Error().stack?.split('\n')[2]?.trim(),
  duration: capturedDuration,
  isServerTriggered
});
```

#### Step 3: Improve the stop confirmation dialog copy for short recordings

Update `StopRecordingConfirmDialog.tsx` to always display the recording stats (duration and words) regardless of recording length, helping the user understand what they're about to lose.

---

### Technical Details

| File | Change |
|------|--------|
| `src/hooks/useRecordingProtection.ts` | Lower confirmation threshold from 5 min/100 words to 15 seconds |
| `src/components/MeetingRecorder.tsx` | Add stack trace logging to `stopRecording` |
| `src/components/StopRecordingConfirmDialog.tsx` | No changes needed (already shows duration and words) |

### Expected Outcome
- Any recording over 15 seconds will require explicit confirmation before stopping
- If an accidental stop happens again, the stack trace log will pinpoint exactly what triggered it
- Users are protected from losing recordings due to accidental double-clicks on desktop

