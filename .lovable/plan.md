

# Fix False "No Audio Detected" on iOS + Hide Present Pill on Mobile

## Problem 1: False "No Audio Detected" Toast on iOS

The health check at line 3030 of `MeetingRecorder.tsx` fires after 10 seconds and checks `capturedBlobs === 0`. However, `SimpleIOSTranscriber` uses a **rotation strategy** (stop/restart every 90 seconds) with **no timeslice**. The `ondataavailable` event only fires when the recorder is stopped at rotation time. So at 10 seconds, `capturedBlobs` will always be 0 — this is a guaranteed false positive.

**Fix:** Instead of checking `capturedBlobs`, check whether the audio track is alive and the recorder is in `recording` state. Replace the blob count check with a track health check: verify `stream.getAudioTracks()[0].readyState === 'live'` and `mediaRecorder.state === 'recording'`. Add a new method `getHealthStatus()` to `SimpleIOSTranscriber` that returns track state and recorder state, or simply extend `getStats()` to include `trackState` and `recorderState`.

### File: `src/utils/SimpleIOSTranscriber.ts`
- Extend `getStats()` to include `trackState` (from `stream.getAudioTracks()[0].readyState`) and `recorderState` (from `mediaRecorder.state`)

### File: `src/components/MeetingRecorder.tsx`
- Change the 10s health check (line 3033) from `stats.capturedBlobs === 0` to `stats.trackState !== 'live' || stats.recorderState !== 'recording'`

## Problem 2: Hide Present Pill on Mobile

The "Present" `ContextStatusPill` (line 55) is currently always shown, even on mobile.

### File: `src/components/recording-flow/LiveContextStatusBar.tsx`
- Wrap the Present pill (lines 55-59) and its preceding divider (line 52) in `!isMobile &&` so on mobile only the REC badge, word count glass panel, and spacer remain

