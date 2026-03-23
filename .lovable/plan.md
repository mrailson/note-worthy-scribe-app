

# Fix: AssemblyAI Desktop Recording (Match Dictate Pattern)

## Problem
In mic-only mode on desktop, `buildAssemblyAudioStream` requests a **second** microphone stream and creates an **unused** `AudioContext`, causing AudioContext exhaustion and silent failures. The working Dictate feature avoids this by letting `AssemblyRealtimeClient` capture its own mic internally.

## Changes

### File 1: `src/components/MeetingRecorder.tsx` (~lines 4696-4756)
**Skip `buildAssemblyAudioStream` entirely in mic-only mode.** When `assemblyAudioMixerRef.current` is null (no pre-built mixer from unified pipeline), check if we actually have system audio. If not (mic-only), call `startPreview(undefined, ...)` — letting AssemblyAI capture its own mic, exactly like Dictate.

- Lines 4702-4742: Replace the block that always calls `buildAssemblyAudioStream` with:
  - If `screenStreamRef.current` has live audio tracks → still build mixer (mic+system works fine)
  - If no system audio (mic-only) → skip mixer, set `assemblyInputMode('mic-only')`, and pass `undefined` to `startPreview`
- Line 4749: Change to `assemblyAudioMixerRef.current?.mixedStream` (may be undefined now)

### File 2: `src/utils/buildAssemblyAudioStream.ts` (lines 125-143)
**Remove orphaned `AudioContext` in mic-only fast path.** Line 131 creates `new AudioContext()` that serves no purpose. Return `null` for `audioContext` instead, preventing resource waste.

## What stays unchanged
- **Whisper**: Own transcriber, own mic stream, own AudioContext — untouched
- **Deepgram**: Already handles `undefined` stream — untouched
- **Mic+System mode**: Still uses the mixer pipeline — untouched
- **Mobile**: Uses its own direct client — untouched

## Result
Desktop mic-only goes from 3 AudioContexts + 2 mic streams → 2 AudioContexts + 1 mic stream, matching the working Dictate pattern.

