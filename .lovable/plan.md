

## Fix: "Mic + System Audio" Crash After a Few Seconds

### Problem Identified

When selecting "Mic + System Audio", Chrome's `getDisplayMedia` returns both video and audio tracks. The code immediately **stops and removes all video tracks** (lines 3020-3023 in MeetingRecorder.tsx). In many Chrome versions, this causes Chrome to terminate the **entire screen capture session** after a few seconds, killing the audio tracks too.

This cascading failure results in:
- System audio tracks ending silently
- MediaRecorder receiving a dead/inactive stream
- No transcript activity being generated
- Eventually triggering the "auto-closed due to inactivity" message

### Root Cause

There are **two locations** where video tracks are aggressively stopped:

1. **`acquireScreenShareStream()`** (line 3020-3023) - used for the initial recording start in unified pipeline mode
2. **`startComputerAudioTranscription()`** (line 3087-3093) - used for the legacy computer audio path

### Solution

Instead of stopping video tracks (which signals Chrome to end the capture), we should **keep them alive but muted/minimised**:

1. **Disable video tracks** rather than stopping them - set `track.enabled = false` to prevent CPU usage but keep Chrome's capture session alive
2. **Stop video tracks only during cleanup** when the recording session ends (in `stopRecording`)
3. Apply this fix to both `acquireScreenShareStream()` and `startComputerAudioTranscription()`
4. Ensure `stopRecording` cleanup also stops any lingering video tracks from `screenStreamRef`

### Technical Details

**File: `src/components/MeetingRecorder.tsx`**

1. In `acquireScreenShareStream()` (~line 3020): Replace `track.stop()` + `stream.removeTrack(track)` with `track.enabled = false` to keep the capture session alive while preventing video processing overhead.

2. In `startComputerAudioTranscription()` (~line 3089): Same change - disable video tracks instead of stopping them.

3. In the `stopRecording` cleanup path: Add explicit cleanup to stop any remaining video tracks from `screenStreamRef.current` so they don't linger after the session ends.

4. In `buildAssemblyAudioStream` cleanup (`cleanupAssemblyAudioStream`): No changes needed - it already handles mic stream cleanup correctly. The screen stream cleanup happens via `screenStreamRef` in MeetingRecorder.

### Risk Assessment

- **Low risk**: Disabling video tracks is a well-documented Chrome-compatible approach
- **Minor CPU cost**: Disabled video tracks use minimal resources (no encoding/decoding)
- **No API changes**: All existing callbacks (`onSystemAudioLost`, etc.) remain unchanged

