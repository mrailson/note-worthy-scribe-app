

# Desktop Browser (Chrome/Edge) Recording Protection Improvements

## Problem

The two desktop transcribers (`DesktopWhisperTranscriber` and `ChromiumMicTranscriber`) lack the interruption recovery protections now present in the Android and iOS pipelines. Desktop users can lose recordings when:
- A laptop sleeps or the lid is closed
- A Bluetooth headset disconnects mid-session
- The browser tab is backgrounded and throttled
- The system audio device changes (e.g. plugging in headphones)

## Current Gaps

### DesktopWhisperTranscriber
- Has a visibility handler but it only flushes buffered audio -- it does not check track health or resume the AudioContext
- Has an AudioContext for VAD but no resume logic if it gets suspended
- No `stream.oninactive` listener
- No `track.onended` listener
- No `recoverMicrophone()` method
- No Wake Lock

### ChromiumMicTranscriber
- Has `track.onended` that calls `restartRecording()` -- but no retry counter or delay
- `restartRecording()` makes a single attempt and gives up on failure
- No `stream.oninactive` listener
- No track health polling
- No visibility handler at all
- No Wake Lock

## Planned Changes

### File: `src/utils/DesktopWhisperTranscriber.ts`

1. **Track health monitor** -- Add a 3-second polling interval checking `track.readyState` and `track.enabled`. If unhealthy, trigger `recoverMicrophone()`.

2. **`stream.oninactive` and `track.onended` listeners** -- Set up during `startTranscription()` for immediate detection of Bluetooth disconnects or system audio seizures.

3. **`recoverMicrophone(attempt)` method** -- Re-acquires `getUserMedia` (respecting `selectedDeviceId`), closes and recreates the `AudioContext` + analyser, creates a new `MediaRecorder`, restarts chunked recording (preserving `chunkCount`, `finalTranscript`, and all state), and re-sets up track monitoring. Up to 3 retries with 2-second delays. Surfaces "Recording paused -- audio device lost" and "Recording resumed -- microphone recovered" via `onStatusChange`.

4. **Enhanced visibility handler** -- On tab restore, force-resume `AudioContext` if suspended, check track health and trigger recovery if needed, then flush buffered audio (existing behaviour).

5. **Wake Lock** -- Acquire `navigator.wakeLock.request('screen')` in `startTranscription()`, re-acquire on visibility restore, release in `stopTranscription()`.

6. **`interruptedByDevice` flag** -- Track whether an interruption occurred so the visibility handler can log recovery context.

### File: `src/utils/ChromiumMicTranscriber.ts`

1. **Track health polling** -- Add a 2-second interval checking `track.readyState`. If ended, trigger recovery.

2. **`stream.oninactive` listener** -- Immediate detection alongside the existing `track.onended`.

3. **Retry logic on `restartRecording(attempt)`** -- Add an attempt counter (max 3) with 2-second delays between retries. On final failure, call `onError('Recording could not recover')` and stop.

4. **Visibility handler** -- Add a `visibilitychange` listener that checks track health, flushes queued chunks, and triggers recovery if the stream has ended while backgrounded.

5. **Wake Lock** -- Acquire on `startTranscription()`, re-acquire on visibility restore, release on `stopTranscription()`.

### File: `src/components/MeetingRecorder.tsx`

No changes expected -- the toast handling already covers the status messages used here ("Recording paused", "Recording resumed", "audio device lost"). Will verify during implementation and add any new messages if needed.

## Technical Detail

### recoverMicrophone() for DesktopWhisperTranscriber

```text
recoverMicrophone(attempt = 0):
  if recoveryInProgress: return
  recoveryInProgress = true
  onStatusChange('Recording paused - audio device lost')

  try:
    stop old MediaRecorder if active
    stop old stream tracks
    re-acquire getUserMedia with same constraints (including selectedDeviceId)
    close old AudioContext
    create new AudioContext + analyser + source from new stream
    restart activity monitoring
    create new MediaRecorder with new stream
    restart chunked recording (preserving chunkCount and finalTranscript)
    setup track monitoring on new stream
    re-acquire Wake Lock
    interruptedByDevice = false
    recoveryInProgress = false
    onStatusChange('Recording resumed - microphone recovered')
  catch:
    recoveryInProgress = false
    if attempt < 3:
      schedule recoverMicrophone(attempt + 1) in 2 seconds
    else:
      onError('Microphone lost - please check your audio device')
```

### restartRecording() for ChromiumMicTranscriber (updated)

```text
restartRecording(attempt = 0):
  try:
    stop current recorder and tracks
    wait 500ms
    re-acquire getUserMedia with same constraints
    create new MediaRecorder
    setup event handlers and track monitoring
    start recording
    re-acquire Wake Lock
    onStatusChange('Recording resumed')
  catch:
    if attempt < 3:
      schedule restartRecording(attempt + 1) in 2 seconds
    else:
      onError('Recording could not recover - please restart')
      stopTranscription()
```

### Wake Lock Pattern (both transcribers)

```text
acquireWakeLock():
  if 'wakeLock' in navigator:
    try:
      wakeLockSentinel = await navigator.wakeLock.request('screen')
      wakeLockSentinel.addEventListener('release', () => log 'Wake Lock released')
    catch: log warning (non-fatal)

releaseWakeLock():
  if wakeLockSentinel:
    await wakeLockSentinel.release()
    wakeLockSentinel = null
```

### Enhanced Visibility Handler for DesktopWhisperTranscriber

```text
on visibilitychange to 'visible':
  if isRecording:
    1. Force-resume AudioContext if suspended
    2. Check track health -> recoverMicrophone() if ended
    3. Re-acquire Wake Lock
    4. Flush buffered audio chunks (existing behaviour)
```

## Risk Assessment

All changes are additive:
- Track health polling runs on a separate interval and only triggers recovery when a track has genuinely ended
- Wake Lock is acquired inside a try/catch and is non-fatal if unsupported
- Recovery creates entirely new stream/recorder/context instances rather than mutating existing ones
- Existing state (`chunkCount`, `finalTranscript`, `allTranscriptions`) is preserved across recovery
- The `recoveryInProgress` flag prevents concurrent recovery attempts

