

# iOS Recording Protection Improvements

## Problem

The iOS transcriber (`SimpleIOSTranscriber.ts`) already has basic protections but lacks parity with the recently improved Android pipeline. Specific gaps could cause recording failures when users receive phone calls, lock their screen, or switch apps on iPhone/iPad.

## Current iOS Protections (Already Working)

- Track `ended` event listener triggers `recoverStream()`
- Heartbeat checks `track.readyState` every 5 seconds
- Visibility handler checks track health and re-acquires Wake Lock
- Silent audio keep-alive oscillator
- Wake Lock API integration
- Web Worker-based heartbeat (resistant to background throttling)

## Gaps to Close (Matching Android)

### 1. No `stream.oninactive` Listener
The `MediaStream.oninactive` event fires immediately when all tracks end (e.g. phone call seizes the mic). Currently iOS only relies on individual `track.onended` and the 5-second heartbeat poll -- adding the stream-level listener provides instant detection.

### 2. No Retry Counter on Recovery
The current `recoverStream()` method makes a single attempt. If it fails, it shows an error and stops. The Android version retries up to 3 times with a 2-second delay between attempts.

### 3. No AudioContext Force-Resume on Visibility Restore
When iOS Safari backgrounds the app, the `AudioContext` (including the keep-alive oscillator) can be suspended. The visibility handler does not currently attempt to resume it.

### 4. No User-Facing Interruption/Recovery Toasts
The iOS transcriber calls `onStatusChange('Recovering microphone...')` but does not surface specific messages like "Recording paused -- call detected" or "Recording resumed -- microphone recovered" that the Android version now provides.

### 5. Keep-Alive Not Restarted After Recovery
If the keep-alive `AudioContext` is suspended or closed during an interruption, it is never restarted. The recovery flow should check and restart it.

## Planned Changes

### File: `src/utils/SimpleIOSTranscriber.ts`

1. **Add `stream.oninactive` listener** in `setupTrackMonitoring()` -- flag `interruptedByCall = true` and call `onStatusChange('Recording paused -- call detected')`.

2. **Add retry logic to `recoverStream()`** -- up to 3 attempts with a 2-second delay between each. On final failure, call `onError('Microphone lost -- tap to retry')`.

3. **Resume keep-alive AudioContext on visibility restore** -- in the visibility handler, check `this.keepaliveContext?.state === 'suspended'` and call `.resume()`. If closed, restart the keep-alive.

4. **Surface specific interruption/recovery status messages** -- use `onStatusChange` with distinct messages:
   - "Recording paused -- call detected" (on stream inactive)
   - "Recording resumed -- microphone recovered" (on successful recovery)
   - "Recording interrupted -- tap to retry" (on final recovery failure)

5. **Add `interruptedByCall` flag** -- track whether the interruption was from a call so the visibility handler can show a recovery toast when the user returns.

### File: `src/components/MeetingRecorder.tsx`

No additional changes needed -- the toast handling added for Android already picks up the same `onStatusChange` messages from iOS.

## Technical Detail

### Updated `setupTrackMonitoring()`

```text
setupTrackMonitoring():
  // existing track.onended listeners...
  
  stream.addEventListener('inactive', () => {
    if isRecording and not stopRequested:
      log 'Stream inactive -- likely phone call'
      interruptedByCall = true
      onStatusChange('Recording paused -- call detected')
  })
```

### Updated `recoverStream()` with Retry

```text
recoverStream(attempt = 0):
  if recoveryInProgress: return
  recoveryInProgress = true
  
  try:
    stop current recorder and old tracks
    re-acquire getUserMedia
    setup track monitoring on new stream
    restart recorder
    resume or restart keepalive context
    onStatusChange('Recording resumed -- microphone recovered')
    interruptedByCall = false
    recoveryInProgress = false
  catch:
    recoveryInProgress = false
    if attempt < 3:
      schedule recoverStream(attempt + 1) in 2 seconds
    else:
      onError('Microphone lost -- tap to retry')
```

### Updated Visibility Handler

```text
on visibilitychange to 'visible':
  1. Resume keepalive AudioContext if suspended
  2. Check track health -> recoverStream() if needed
  3. Re-acquire Wake Lock (existing)
  4. Force rotation if segment overdue (existing)
  5. Drain upload queue (existing)
  6. If interruptedByCall was set: recovery toast shown via recoverStream
```

