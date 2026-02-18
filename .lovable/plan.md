

# Android Recording Protection Improvements

## Problem

Android users are reporting recording failures, likely caused by:
- Incoming phone calls seizing the microphone from the browser
- Text/notification interruptions causing the OS to throttle the browser
- Screen lock suspending the `AudioContext` and `MediaRecorder`
- No detection or recovery when the mic track is killed by the OS

## Current State

The existing Android protections include:
- **Audio keep-alive oscillator** (silent tone to prevent `AudioContext` suspension)
- **Web Worker timer** (avoids throttled `setInterval` in background)
- **Visibility change handler** (processes pending audio when app returns to foreground)
- **Health monitoring** (detects transcription stalls after 75 seconds)
- **Wake Lock** (prevents screen dimming, managed in `MeetingRecorder.tsx`)

**Critical gaps:**
1. No monitoring of `MediaStream` track health (`track.readyState === 'ended'`)
2. No detection of `MediaRecorder` being stopped by the OS
3. No automatic mic re-acquisition after a phone call ends
4. No user-facing notification when recording was interrupted and recovered
5. Wake Lock is not re-acquired inside the Android transcriber itself after visibility restore

## Planned Improvements

### 1. Media Stream Track Health Monitor
Add a polling check (every 2 seconds) inside `AndroidWhisperTranscriber` that inspects `track.readyState` and `track.enabled`. If a track has ended (e.g. killed by a phone call), the system will:
- Log the interruption
- Attempt to re-acquire the microphone via `getUserMedia`
- Reconnect the new stream to the `MediaRecorder` and `AudioContext`
- Notify the user via a status callback

### 2. MediaRecorder State Recovery
Monitor `mediaRecorder.state` alongside the track check. If the recorder has been paused or stopped by the OS:
- Restart it with a fresh `MediaRecorder` instance using the (possibly new) stream
- Preserve the existing chunk manager state so no buffered audio is lost
- Log the recovery attempt

### 3. Phone Call / Audio Interruption Detection
Add an `oninactive` listener on the `MediaStream` itself, which fires when all tracks end (typical when a phone call takes priority). This provides immediate detection rather than waiting for the 2-second poll. On trigger:
- Flag the session as "interrupted"
- When visibility restores, attempt full mic + recorder recovery

### 4. Foreground Recovery Sequence
Enhance the existing `visibilitychange` handler to run a full recovery checklist when the app returns to foreground:
1. Force-resume `AudioContext`
2. Check `MediaStream` track health; re-acquire mic if needed
3. Re-create `MediaRecorder` if stopped
4. Re-acquire Wake Lock
5. Process any buffered audio chunks
6. Show a toast notification: "Recording recovered after interruption"

### 5. User Notification on Interruption and Recovery
Surface interruption events to the UI layer via the existing `onStatusChange` and `onError` callbacks:
- "Recording paused - phone call detected" (when track ends)
- "Recording resumed - microphone recovered" (on successful recovery)
- "Recording interrupted - tap to retry" (if recovery fails after 3 attempts)

### 6. Wake Lock Integration in Transcriber
Move Wake Lock acquisition into `AndroidWhisperTranscriber.startTranscription()` and re-acquisition into the visibility handler, so it is self-contained and does not rely on the parent component.

## Files to Change

| File | Change |
|------|--------|
| `src/utils/AndroidWhisperTranscriber.ts` | Add track health monitor, `MediaRecorder` state recovery, `stream.oninactive` listener, enhanced visibility handler with full recovery checklist, Wake Lock self-management |
| `src/utils/androidAudioKeepAlive.ts` | Add `isHealthy()` method for quick status check during recovery |
| `src/components/MeetingRecorder.tsx` | Surface new interruption/recovery status messages as toast notifications to the user |

## Technical Detail

### Track Health Monitor (new private method in AndroidWhisperTranscriber)

```text
startTrackHealthMonitor():
  every 2 seconds:
    for each track in stream.getAudioTracks():
      if track.readyState === 'ended' or !track.enabled:
        log warning
        attempt recoverMicrophone()

recoverMicrophone():
  try getUserMedia with same constraints
  replace stream reference
  reconnect AudioContext source and analyser
  create new MediaRecorder with new stream
  restart chunked recording (preserving chunk manager state)
  call onStatusChange('Recording resumed')
  return true
  catch:
    increment recovery counter
    if < 3 attempts: schedule retry in 2s
    else: call onError('Microphone lost - tap to retry')
```

### Stream Inactive Listener

```text
stream.addEventListener('inactive', () => {
  log 'Stream inactive - likely phone call'
  flag interruptedByCall = true
  onStatusChange('Recording paused - call detected')
})
```

### Enhanced Visibility Handler

```text
on visibilitychange to 'visible':
  1. audioKeepAlive.forceResume()
  2. check track health -> recoverMicrophone() if needed
  3. check mediaRecorder.state -> restart if stopped
  4. re-acquire Wake Lock
  5. process buffered chunks
  6. if was interrupted: show recovery toast
```

