

## Plan: Add Recording Track Health Monitoring

### Problem
Recordings can stop silently when:
- iOS suspends Safari (switching to Mail app, etc.) — kills MediaRecorder tracks
- Any browser terminates mic access unexpectedly
- No `track.onended` handler exists to detect or recover

### Changes

**File: `src/components/MeetingRecorder.tsx`**

1. **Add track health monitoring after mic stream is obtained** (in `startRecording` and `startMicrophoneTranscription`):
   - Attach `onended` handlers to all audio tracks in the mic stream
   - When a track ends unexpectedly during recording, show a warning toast: "Microphone was disconnected — recording may have stopped"
   - Log the event for debugging: `⚠️ TRACK_ENDED: mic track ended unexpectedly during recording`

2. **Add periodic track health check** (every 5 seconds while recording):
   - Check `track.readyState` for all active audio tracks
   - If all tracks are `"ended"` while `isRecording` is true, show an error toast and attempt mic recovery via the existing `recoverMicrophone` flow
   - Log: `🔴 TRACK_HEALTH: all mic tracks ended, attempting recovery`

3. **Add visibility change handler for iOS recovery**:
   - When tab becomes visible again on iOS, check track health immediately
   - If tracks are dead, attempt to re-acquire the mic and restart the transcription pipeline
   - Show toast: "Recording paused while app was in background — resuming..."

**File: `src/hooks/useRecordingHealthMonitor.ts`** (extend existing hook)

4. **Add track state monitoring** to the existing health monitor:
   - Accept mic stream ref as parameter
   - Include track readyState in the health check cycle
   - Integrate with the existing stall detection logic

### What this does NOT change
- No transcription logic changes
- No recording start/stop flow changes
- Purely additive monitoring and recovery

### Expected outcome
- Users get warned immediately if their mic track dies (especially on iOS)
- Automatic recovery attempt when returning from background on iOS
- Console logs for debugging future incidents: `TRACK_ENDED`, `TRACK_HEALTH`

