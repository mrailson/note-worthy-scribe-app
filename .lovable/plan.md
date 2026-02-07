
# Unify Recording Pipeline: Mic+System Audio to Match Mic-Only Settings

## Problem

When recording with **Mic + System Audio**, three issues arise:

1. **Whisper runs TWO separate pipelines simultaneously:**
   - The microphone gets the standard `DesktopWhisperTranscriber` path (90-second WebM chunks, full hallucination filtering, deduplication, confidence gating)
   - The system audio gets a completely different custom path (`startCustomAudioProcessing`) that uses 15-second WAV chunks at 24 kHz, with manual `ScriptProcessorNode` encoding and none of the quality guards

2. **AssemblyAI and Deepgram use a third, separate mixed stream** via `buildAssemblyAudioStream`, which correctly mixes mic + system audio. But Whisper does not use this mixed stream.

3. **When the user clicks "Stop sharing"** in Chrome, the screen-share `MediaStreamTrack` fires an `ended` event that nobody listens for. The recording silently stops producing data. The health monitor then detects the meeting as "completed" and shows the misleading message: **"Recording was ended by the server."**

## Current Architecture (Mic + System Audio on Chrome/Edge)

```text
startRecording()
  |
  +-- startComputerAudioTranscription()
  |     |-- getDisplayMedia() --> screenStreamRef
  |     +-- startCustomAudioProcessing(screenStream)
  |           |-- ScriptProcessorNode at 24kHz
  |           |-- 15-second WAV chunks
  |           +-- Sends base64 WAV to speech-to-text (no quality gates)
  |
  +-- startMicrophoneTranscription()
  |     +-- DesktopWhisperTranscriber (mic-only stream)
  |           |-- getUserMedia() at 48kHz
  |           |-- 90-second WebM/Opus chunks
  |           +-- Full hallucination/dedup/confidence pipeline
  |
  +-- buildAssemblyAudioStream(screenStream, micStream)
  |     +-- Web Audio mixer --> AssemblyAI (mixed)
  |
  +-- deepgramPreview.startPreview(mixedStream)
        +-- Deepgram (mixed)
```

**Result:** Whisper processes mic and system audio separately with different formats, chunk sizes, and quality controls. AssemblyAI/Deepgram get a proper mixed stream, but Whisper does not.

## Target Architecture (All Engines Use Same Mixed Stream)

```text
startRecording()
  |
  +-- getDisplayMedia() --> screenStream (if mic-and-system)
  |
  +-- buildAssemblyAudioStream(screenStream, micStream)
  |     +-- Web Audio mixer --> mixedStream
  |
  +-- DesktopWhisperTranscriber(externalStream: mixedStream)
  |     |-- 90-second WebM/Opus chunks (same as mic-only)
  |     +-- Full hallucination/dedup/confidence pipeline
  |
  +-- assemblyPreview.startPreview(mixedStream)
  |
  +-- deepgramPreview.startPreview(mixedStream)
  |
  +-- track.onended listener on screen-share tracks
        +-- Toast: "System audio stopped. Mic continues."
        +-- Graceful fallback to mic-only (no session termination)
```

## Implementation Plan

### Change 1: Reorder audio setup in `startRecording()`

**File:** `src/components/MeetingRecorder.tsx` (lines 4185-4320)

Currently, the mic+system path calls:
1. `startComputerAudioTranscription()` -- sets up the 15s WAV sidecar
2. `startMicrophoneTranscription()` -- starts a mic-only Whisper instance
3. `buildAssemblyAudioStream()` -- creates the mixed stream for Assembly/Deepgram

New flow for `mic-and-system` mode on Chrome/Edge:
1. Call `getDisplayMedia()` to get the screen-share stream (extract audio setup from `startComputerAudioTranscription`, but do NOT start the `ScriptProcessorNode` sidecar)
2. Call `buildAssemblyAudioStream(screenStream, micStream)` to produce a single mixed stream
3. Start `DesktopWhisperTranscriber` with `externalStream: mixedStream` -- this gives Whisper the exact same 90s WebM chunking and quality gates as mic-only mode
4. Start AssemblyAI with the same `mixedStream`
5. Start Deepgram with the same `mixedStream`
6. Attach `track.onended` listeners to the screen-share audio tracks

### Change 2: Extract screen-share acquisition from `startComputerAudioTranscription()`

**File:** `src/components/MeetingRecorder.tsx`

Create a new lightweight function `acquireScreenShareStream()` that:
- Calls `getDisplayMedia({ video: true, audio: true })`
- Strips video tracks
- Validates audio tracks exist
- Stores reference in `screenStreamRef`
- Returns the `MediaStream`

This replaces the current `startComputerAudioTranscription()` which both acquires the stream AND starts the custom 15s WAV processing pipeline.

### Change 3: Remove the custom sidecar pipeline

**File:** `src/components/MeetingRecorder.tsx`

Remove or disable these functions (they will no longer be called):
- `startCustomAudioProcessing()` (lines ~3080-3224) -- the 15s WAV ScriptProcessorNode loop
- `processAudioBuffer()` (lines ~3227-3330) -- the WAV encoding and direct `speech-to-text` call
- `encodeWAV()` (lines ~3333-3366) -- manual WAV header encoding

These are replaced by the standard `DesktopWhisperTranscriber` consuming the mixed stream.

### Change 4: Add `track.onended` listeners for graceful stream recovery

**File:** `src/components/MeetingRecorder.tsx`

After acquiring the screen-share stream, attach `onended` handlers to each audio track:

- When triggered:
  - Show toast: "System audio sharing stopped. Microphone recording continues."
  - Set `systemAudioCaptured` to `false`
  - Set `assemblyInputMode` to `'mic-only'`
  - Log the event for diagnostics
  - Do NOT stop the recording -- the `DesktopWhisperTranscriber` will continue with the mic portion of the mixed stream (the mixer's mic input remains active)

### Change 5: Improve termination messages in health monitor

**File:** `src/hooks/useRecordingHealthMonitor.ts`

When the health monitor detects `status === 'completed'` while the client is still recording:
- Query the `system_audit_log` table for the meeting ID to find the actual operation (e.g., `AUTO_CLOSE_INACTIVE`)
- Map to specific user messages:
  - `AUTO_CLOSE_INACTIVE`: "Recording was auto-closed due to 90 minutes of inactivity."
  - Unknown/other: "Recording stopped unexpectedly. Your transcript has been saved."
- Replace the current generic: "Recording was ended by the server."

### Change 6: Map kill signal reasons to clear messages

**File:** `src/hooks/useMeetingKillSignal.ts`

When a `force_stop` broadcast is received:
- Read the `reason` field from the payload (already sent by `auto-close-inactive-meetings` as `server_inactivity_timeout`)
- Map to specific messages:
  - `server_inactivity_timeout`: "Recording auto-closed after 90 minutes of inactivity"
  - `admin_graceful_end`: "Recording was ended by a system administrator"
  - Missing/unknown: "Recording was ended remotely"

### Change 7: Fix race condition on short-meeting deletion

**File:** `src/components/MeetingRecorder.tsx` (lines ~4578-4616)

When deleting a short meeting (under 100 words):
- Set `isRecordingRef.current = false` BEFORE the database delete operation
- This prevents the health monitor's next 30-second poll from seeing a missing/completed meeting and triggering a false "ended by server" toast

## Files Modified

| File | Change Summary |
|------|---------------|
| `src/components/MeetingRecorder.tsx` | Reorder `startRecording()` to build mixed stream first; pass it to Whisper as `externalStream`; extract screen-share acquisition; remove sidecar pipeline; add `track.onended` listeners; fix short-meeting race condition |
| `src/hooks/useRecordingHealthMonitor.ts` | Query `system_audit_log` for termination reason; show specific messages |
| `src/hooks/useMeetingKillSignal.ts` | Map broadcast `reason` codes to user-friendly messages |

## What Does NOT Change

- `DesktopWhisperTranscriber` class itself (already supports `externalStream` parameter)
- `buildAssemblyAudioStream` utility (already handles mixing correctly)
- Database schema
- Edge functions
- iOS recording path (uses `SimpleIOSTranscriber`, unaffected)
- The non-Chromium stereo recording fallback path (Safari/Firefox)
- `startOverlappingChunks()` -- still used for the non-Chromium stereo path only

## Expected Outcome

- **Consistent chunks:** All Whisper transcripts use 90-second WebM/Opus chunks with full quality filtering, regardless of whether system audio is active
- **Single pipeline:** One `DesktopWhisperTranscriber` instance per meeting, processing a single mixed stream
- **All engines aligned:** Whisper, AssemblyAI, and Deepgram all consume the same mixed audio
- **Graceful recovery:** Clicking "Stop sharing" shows a clear warning but does not terminate the meeting
- **Accurate messages:** "Ended by server" only appears when the server genuinely closed the meeting
