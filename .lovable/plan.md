
# Browser Recording Auto-Stopped After 20 Minutes of "Inactivity"

## Root Cause

The `DesktopWhisperTranscriber` has a **20-minute silence auto-stop** (`SILENCE_AUTO_STOP_MS = 20 * 60 * 1000` on line 73). The `lastTranscriptActivityTime` is only updated when a chunk returns non-empty, non-hallucinated text (line 1137).

Most likely, you had the browser tab in the background while using the iPhone. Chrome aggressively throttles background tabs, which can cause:
1. The `AudioContext` to suspend (no audio data flows)
2. `MediaRecorder` chunks to stop being delivered
3. Even if chunks are sent, they may contain silence/empty audio, returning 0-char transcriptions

When successful transcriptions stop arriving for 20 minutes, the auto-stop fires and ends the recording. Your meeting ran fine for ~30 minutes, then the browser went background, and 20 minutes later at the 50-minute mark it auto-stopped.

**Note:** The project memory says this was increased to 90 minutes, but the code still shows 20 minutes -- it appears the update was lost or reverted.

## Fix

### 1. Increase `SILENCE_AUTO_STOP_MS` to 90 minutes
In `src/utils/DesktopWhisperTranscriber.ts`, change line 73 from 20 minutes to 90 minutes to match the intended design.

### 2. Update the toast and log messages
In `src/components/MeetingRecorder.tsx` (line 2887-2890), update the "20 minutes" text references to "90 minutes".

### 3. Also update `lastTranscriptActivityTime` when chunks are sent (not just received)
Add an update to `lastTranscriptActivityTime` when a chunk is dispatched for processing (around line 850-860 in `processAudioChunks`), so that even if the transcription result is empty/filtered, the timer doesn't falsely trigger while the recording is still actively sending audio.

### Technical Details

| File | Change |
|------|--------|
| `src/utils/DesktopWhisperTranscriber.ts` line 73 | `SILENCE_AUTO_STOP_MS` from `20 * 60 * 1000` to `90 * 60 * 1000` |
| `src/utils/DesktopWhisperTranscriber.ts` line 167 | Update log message to say "90 minutes" |
| `src/utils/DesktopWhisperTranscriber.ts` ~line 850 | Add `this.lastTranscriptActivityTime = Date.now()` when audio chunks are non-empty and being sent for processing |
| `src/components/MeetingRecorder.tsx` line 2887-2890 | Update toast/log from "20 minutes" to "90 minutes" |
| `src/hooks/useScribeRecording.ts` lines 328-329, 646-647 | Update comment from "20 min" to "90 min" |
