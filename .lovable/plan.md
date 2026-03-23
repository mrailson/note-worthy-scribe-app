

# Fix: AssemblyAI Reconnection Crash (`createMediaStreamSource` TypeError)

## Problem
The console shows a clear failure chain:
1. Proxy closes with **1011** (server-side timeout/error)
2. Reconnection fires, but crashes with: `TypeError: Failed to execute 'createMediaStreamSource' on 'AudioContext': parameter 1 is not of type 'MediaStream'`
3. Subsequent attempts fail with "AudioContext destroyed — cannot start fallback"

The root cause: when `dispose()` is called on the old client during reconnection, it runs `cleanupAudio()` which may stop/invalidate the mic stream. The new client then either receives a dead stream reference or `this.stream` ends up as `undefined` before hitting `createMediaStreamSource`.

## Changes

### File 1: `src/lib/assembly-realtime.ts` — Guard `startAudioCapture`
Add a validation check before calling `createMediaStreamSource` to ensure `this.stream` is a valid `MediaStream` instance:

- **Line ~544**: Before `this.audioCtx.createMediaStreamSource(this.stream)`, add:
  ```typescript
  if (!this.stream || !(this.stream instanceof MediaStream)) {
    throw new Error("Audio capture failed: stream is not a valid MediaStream");
  }
  ```

- **Lines ~514-535**: Add `instanceof MediaStream` check alongside the track-liveness check on the external stream, so an invalid/detached object doesn't pass through:
  ```typescript
  if (this.externalStream && this.externalStream instanceof MediaStream) {
    // existing track validation...
  }
  ```

### File 2: `src/hooks/useAssemblyRealtimePreview.ts` — Better stream validation on reconnect
- **Line ~129-137**: Add `instanceof MediaStream` check so a stale reference doesn't get passed:
  ```typescript
  if (stream && !(stream instanceof MediaStream)) {
    lastExternalStreamRef.current = null;
    stream = null;
  }
  ```

### File 3: `src/lib/assembly-realtime.ts` — `dispose()` should NOT destroy streams it doesn't own
- **Lines ~418-434**: The `dispose()` method currently calls `cleanupAudio()` which stops mic tracks even for streams the client doesn't own. For reconnection, `dispose()` should only close the WebSocket and worklet/processor nodes, but leave the mic stream alive if `ownsStream` is false.

## Technical Details

```text
CURRENT RECONNECT FLOW (broken):
  1. Proxy 1011 → onclose fires
  2. attemptReconnect() → dispose() old client
     → cleanupAudio() stops ALL tracks (even shared ones)
  3. New client.start(lastExternalStream)
     → stream tracks are dead OR stream is invalid object
     → createMediaStreamSource(invalidThing) → TypeError

FIXED FLOW:
  1. Proxy 1011 → onclose fires
  2. attemptReconnect() → dispose() old client
     → only closes WS + audio nodes, preserves shared streams
  3. New client.start(validatedStream || undefined)
     → instanceof check ensures valid MediaStream
     → if invalid, falls through to fresh getUserMedia
```

## What stays unchanged
- **Whisper / Deepgram**: Separate pipelines, untouched
- **Mobile**: Uses direct client, unaffected
- **Normal start/stop**: `stop()` method still does full cleanup as before

