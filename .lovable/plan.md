

## Fix: AssemblyAI and Deepgram Not Transcribing in "Mic + System Audio" Mode

### Root Causes Found

**1. Deepgram completely ignores the external stream (primary cause)**

In `src/hooks/useDeepgramRealtimePreview.ts` (line 335), the external stream parameter is named `_externalStream` with an underscore prefix -- meaning it is deliberately unused. When the session starts (line 401), it always calls `createPcmStream()` which internally calls `navigator.mediaDevices.getUserMedia()` to create a **brand new mic-only stream**. This new stream is separate from the mixed stream and only captures the physical microphone, not system audio.

**2. `createPcmStream` has no support for external streams**

In `src/lib/audio/pcm16.ts`, `createPcmStream()` always calls `getUserMedia()`. There is no option to pass in an existing MediaStream.

**3. AssemblyAI receives the mixed stream but timing may be wrong**

`AssemblyRealtimeClient.start()` correctly accepts the external stream (line 59) and uses it (line 453-456). However, when the user switches to "Mic + System Audio" *during* a recording, the `assemblyAudioMixerRef.current` might not be populated yet when AssemblyAI starts, or the stream may have ended/been replaced by the mode switch.

### Solution

**File 1: `src/lib/audio/pcm16.ts`**
- Add an optional `externalStream` parameter to `createPcmStream()`
- When provided, use it directly instead of calling `getUserMedia()`
- When not provided, fall back to the existing `getUserMedia()` behaviour

**File 2: `src/hooks/useDeepgramRealtimePreview.ts`**
- Rename `_externalStream` to `externalStream` and store it in a ref
- Pass the external stream to `createPcmStream()` when available
- Also pass it during reconnection attempts so the correct stream is used after a reconnect

**File 3: `src/components/MeetingRecorder.tsx`**
- No changes needed -- it already passes `assemblyAudioMixerRef.current?.mixedStream` to both `assemblyPreview.startPreview()` and `deepgramPreview.startPreview()`. Once Deepgram stops ignoring the stream, it will work.

### Technical Details

**`createPcmStream` change:**

```
// Before
export async function createPcmStream(onPcmChunk: (buf: ArrayBuffer) => void)

// After  
export async function createPcmStream(
  onPcmChunk: (buf: ArrayBuffer) => void,
  externalStream?: MediaStream
)
```

When `externalStream` is provided, skip `getUserMedia()` and use the external stream directly. The AudioContext and ScriptProcessor logic remains identical.

**`useDeepgramRealtimePreview` change:**

Store the external stream in a ref (`lastExternalStreamRef`), then pass it to `createPcmStream()`:

```
// Before (line 401)
pcmStreamRef.current = await createPcmStream((pcmBuffer) => { ... });

// After
pcmStreamRef.current = await createPcmStream((pcmBuffer) => { ... }, externalStream);
```

Also apply the same change in the reconnection path (~line 264) so that reconnections also use the mixed stream.

### Risk Assessment

- **Low risk**: The change is additive -- when no external stream is passed, behaviour is identical to before
- **No API changes**: The MeetingRecorder already passes the mixed stream; Deepgram just needs to use it
- **Consistent with AssemblyAI**: Both engines will now receive the same mixed stream when system audio is active

