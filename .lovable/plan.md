
# Recording and Transcription Reliability Audit and Improvement Plan

## Current Architecture Overview

The system already has a sophisticated multi-layered recording pipeline. Here is what is in place today:

```text
+----------------------------------+
|        RECORDING SESSION         |
|  (Browser: Desktop / Mobile)     |
+----------------------------------+
          |          |          |
          v          v          v
    +---------+ +---------+ +---------+
    | Whisper | |AssemblyAI| | Deepgram|
    | (Batch) | | (Live)   | | (Live)  |
    +---------+ +---------+ +---------+
          |          |          |
          v          v          v
+----------------------------------+
|    meeting_transcription_chunks  |
|    deepgram_transcriptions       |
+----------------------------------+
          |
          v
+----------------------------------+
|   consolidate-meeting-chunks     |
|   (Best-of-Both Merger)          |
+----------------------------------+
          |
          v
+----------------------------------+
|   meetings table (final text)    |
|   + notes generation queue       |
+----------------------------------+
```

### What Already Works Well
- **Three-engine redundancy**: Whisper (batch accuracy), AssemblyAI (real-time), and Deepgram (real-time backup)
- **iOS-specific transcriber**: SimpleIOSTranscriber uses recorder rotation every 20 seconds to handle iOS fMP4 format issues
- **Transcription Watchdog**: Detects stalls after 2 minutes (warning) and 3 minutes (critical)
- **Recording Health Monitor**: Polls database every 30 seconds for server-side closure detection
- **Connection Health Monitor**: Tracks WebSocket status and heartbeats every 5 seconds
- **Visibility Protection**: Detects tab backgrounding with duration tracking
- **Kill Signal System**: Listens for server-side force-stop via Supabase Realtime broadcast
- **Audio Backup**: Saves raw audio to Supabase Storage every 60 seconds as insurance
- **Continuation Mode**: Detects orphaned meetings on page refresh and offers "Resume Recording"
- **Auto-Close Service**: Server-side cron closes stale recordings after 90 minutes of inactivity
- **Double-click protection**: Prevents accidental stop with confirmation dialogs
- **beforeunload warning**: Prompts user if they try to close the tab while recording
- **Stall Modal**: Shows reconnection options with auto-reconnect countdown on mobile

---

## Identified Gaps and Improvements

### 1. AssemblyAI Has No Auto-Reconnect on Connection Drop (HIGH PRIORITY)

**The Problem**: The Deepgram hook (`useDeepgramRealtimePreview`) has robust auto-reconnection with exponential backoff (up to 5 attempts). However, the AssemblyAI preview hook (`useAssemblyRealtimePreview`) simply sets `status: 'error'` when the WebSocket closes unexpectedly and does NOT attempt to reconnect automatically. The `AssemblyRealtimeClient` class has reconnection callbacks (`onReconnecting`, `onReconnected`) but these rely on the underlying client library -- the hook itself has no retry logic if the connection fails outright.

**Impact**: If the AssemblyAI WebSocket drops mid-meeting (network blip, token expiry, server hiccup), the live AssemblyAI feed silently stops. Users only notice if they spot the health indicator turning yellow/red.

**Fix**: Add auto-reconnection to `useAssemblyRealtimePreview` matching Deepgram's pattern -- exponential backoff, max 5 attempts, preserve accumulated transcript across reconnections.

### 2. Consolidation Drops AssemblyAI Transcript Column (HIGH PRIORITY)

**The Problem**: The `consolidate-meeting-chunks` edge function merges Whisper and AssemblyAI into a "best-of-both" transcript but only writes to `live_transcript_text` and `whisper_transcript_text`. The `assembly_transcript_text` column is never populated, so the AssemblyAI tab in the notes modal always appears empty after regeneration.

**Fix**: Build a dedicated assembly-only transcript from the AssemblyAI chunks and write it to the `assembly_transcript_text` column during consolidation.

### 3. SafeMode Fallback Mixes All Chunk Sources Together (HIGH PRIORITY)

**The Problem**: When transcript text columns are empty and the UI falls back to reading raw chunks from `meeting_transcription_chunks`, it dumps ALL chunks into the Whisper tab regardless of their `transcriber_type`. AssemblyAI and Deepgram tabs stay empty.

**Fix**: Include `transcriber_type` in the fallback query and separate chunks into Whisper vs AssemblyAI buckets. Move the Deepgram fetch so it always runs, not just when the main columns have data.

### 4. No Automatic MediaRecorder Restart on Stall (MEDIUM PRIORITY)

**The Problem**: The `useTranscriptionWatchdog` has an `onAutoRecoveryAttempt` callback slot, but the actual implementation of what happens when this fires is inconsistent. On mobile, it logs "Auto-triggering recovery attempt" but the recovery action varies -- sometimes it shows a modal, sometimes it does nothing concrete. The watchdog should automatically restart the MediaRecorder and re-initialise the transcription WebSocket without requiring user intervention.

**Fix**: Implement a concrete `attemptAutoRecovery` function in MeetingRecorder that: (a) restarts the MediaRecorder from the existing audio stream, (b) re-initialises any dropped WebSocket connections, (c) logs the recovery attempt for analytics.

### 5. Audio Backup Not Always Started (MEDIUM PRIORITY)

**The Problem**: The `useAudioBackup` hook exists and saves raw audio every 60 seconds, but its activation depends on `isActive` being set. If the recording path skips the backup initialisation (e.g., on certain device paths or during continuation mode), the insurance layer is missing.

**Fix**: Ensure `startBackup(stream)` is called unconditionally whenever a recording starts, regardless of device type or continuation mode.

### 6. No Periodic Server-Side Transcript Integrity Check (MEDIUM PRIORITY)

**The Problem**: The system trusts that chunks arriving at the database are complete and sequential. If a chunk fails to save (network error, DB contention) the gap is never detected until consolidation, where it manifests as missing content.

**Fix**: Add a lightweight client-side "chunk sequence validator" that periodically (every 2 minutes) queries the database to compare expected chunk count vs actual saved count. If a gap is detected, alert the user and attempt to re-send any buffered but un-acknowledged chunks.

### 7. Deepgram Saves to Separate Table, Consolidation Ignores It (LOW-MEDIUM)

**The Problem**: Deepgram transcriptions are saved to `deepgram_transcriptions` table, but the `consolidate-meeting-chunks` function only reads from `meeting_transcription_chunks`. The third engine's data is effectively discarded during the final merge.

**Fix**: Update consolidation to also read from `deepgram_transcriptions` and include it as a third source in the best-of-both comparison, or at minimum save it to `deepgram_transcript_text` on the meetings table for UI display.

### 8. iOS Background Audio Heartbeat Should Be More Aggressive (LOW PRIORITY)

**The Problem**: The iOS transcriber uses a Web Worker heartbeat to prevent timer throttling, but iOS Safari can still suspend audio contexts when the screen locks. The current approach relies on the user keeping the screen on.

**Fix**: Add a "Keep Screen Alive" toggle that uses the Wake Lock API (`navigator.wakeLock.request('screen')`) on supported devices. This prevents screen dimming during active recording on both iOS and Android.

### 9. No Client-Side Transcript Snapshot on Visibility Change (LOW PRIORITY)

**The Problem**: When a tab is backgrounded, the `useVisibilityProtection` hook logs the event but doesn't take any protective action with the transcript data. If the browser process is killed while backgrounded, any in-memory partial transcript that hasn't been committed to the database is lost.

**Fix**: On `visibilityState === 'hidden'`, immediately flush any buffered transcript data to the database and trigger an audio backup save. This acts as a "snapshot" before the OS potentially kills the process.

---

## Implementation Priority

| Priority | Improvement | Risk if Not Fixed | Effort |
|----------|------------|-------------------|--------|
| HIGH | AssemblyAI auto-reconnect | Silent data loss on network blips | Medium |
| HIGH | Fix consolidation assembly column | Missing transcript source after regeneration | Small |
| HIGH | Fix SafeMode chunk source separation | Wrong/empty tabs in fallback mode | Small |
| MEDIUM | Auto MediaRecorder restart on stall | Manual intervention needed for recovery | Medium |
| MEDIUM | Ensure audio backup always starts | No insurance layer on some code paths | Small |
| MEDIUM | Periodic chunk sequence validation | Undetected gaps in transcript | Medium |
| LOW-MED | Include Deepgram in consolidation | Third engine data wasted | Medium |
| LOW | Wake Lock API for mobile | Screen lock kills recording | Small |
| LOW | Flush transcript on visibility change | Data loss if OS kills process | Small |

---

## Technical Details

### Files to Modify

1. **`src/hooks/useAssemblyRealtimePreview.ts`** -- Add auto-reconnection with exponential backoff, matching Deepgram's pattern (max 5 attempts, 1s-30s delay range, `intentionalStopRef` to prevent reconnect on manual stop)

2. **`supabase/functions/consolidate-meeting-chunks/index.ts`** -- Build and persist `assembly_transcript_text` from AssemblyAI-source chunks during the final database update

3. **`src/components/SafeModeNotesModal.tsx`** -- Update `loadTranscript` fallback to include `transcriber_type` in chunk query, separate into Whisper/AssemblyAI buckets, and always run Deepgram fetch

4. **`src/hooks/useTranscriptionWatchdog.ts`** -- Strengthen `onAutoRecoveryAttempt` with concrete MediaRecorder restart logic

5. **`src/hooks/useVisibilityProtection.ts`** -- Add transcript flush and audio backup save on `hidden` event

6. **`src/hooks/useAudioBackup.ts`** -- Verify and enforce that `startBackup` is called in all recording paths (desktop, iOS, continuation)

7. **New utility: `src/hooks/useChunkSequenceValidator.ts`** -- Periodic database query to verify chunk integrity during recording

8. **`src/hooks/useRecordingProtection.ts`** -- Add Wake Lock API support for mobile devices to prevent screen dimming

These changes are all additive safety improvements. None modify the core recording flow, so they carry minimal risk to existing functionality.
