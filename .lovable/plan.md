

# Investigation: iOS Meeting with Zero Words Saved

## What Happened

The meeting `93c71ad3...` exists in the database as `status: completed`, `duration_minutes: 0`, but has **zero rows** in `meeting_transcription_chunks`, `audio_chunks`, and `meeting_audio_segments`.

The words you saw on screen came from **AssemblyAI real-time streaming** (displayed in the LiveTranscriptGlassPanel). This data lives only in browser memory and is never persisted to the database independently. It is purely a preview.

## The Design Flaw

There is a **critical gap** in the data pipeline: the system has **no safety net** that saves the in-memory transcript to the database. Here is the chain of failures:

1. **Whisper iOS chunks are the only DB write path.** The `persistIOSChunk()` function (line 2773) is the sole mechanism that inserts rows into `meeting_transcription_chunks` for iOS recordings. If `SimpleIOSTranscriber` fails to produce chunks (mic permission silently dropped, audio track ended, or all chunks were filtered as hallucinations/noise), nothing is saved.

2. **Silent failure masquerading as success.** When `sessionStorage.getItem('currentMeetingId')` returns null (a race condition), the code at line 2783 skips the DB write but **marks the chunk as "saved" in the UI** — a false positive that hides the data loss.

3. **AssemblyAI transcript is display-only.** The `assemblyPreview.fullTranscript` feeds the LiveTranscriptGlassPanel for visual feedback but is never written to any database table. It evaporates on page close.

4. **The `handleTranscript()` function only updates in-memory React state.** It populates `transcript` (the variable used as fallback at line 5329) but this is lost if the stop sequence encounters any error or the tab is closed.

5. **Consolidation reads from DB, not memory.** At stop time (line 5285), the system queries `meeting_transcription_chunks` from the database. If zero rows exist, it falls back to the in-memory `transcript` variable — but if that's also empty (e.g. SimpleIOSTranscriber produced nothing usable), the meeting saves with 0 words.

6. **`duration_minutes: 0`** confirms the recording lifecycle never completed its finalization properly — the duration update happens during the stop sequence, suggesting the stop flow may have errored out early.

```text
┌──────────────────────────────────────────────────────────┐
│                    CURRENT DATA FLOW                      │
│                                                           │
│  AssemblyAI Stream ──► Browser Memory (display only) ─╳─► DB  │
│                                                           │
│  SimpleIOSTranscriber ──► persistIOSChunk() ──► DB        │
│       ↑                        ↑                          │
│  Can silently fail       Can skip & fake "saved"          │
│                                                           │
│  On Stop: query DB chunks → if 0, fallback to memory     │
│           memory may also be empty → 0 words saved        │
└──────────────────────────────────────────────────────────┘
```

## Proposed Fix: Dual Safety Net

### Change 1: Persist AssemblyAI transcript as a backup source

In `useDualTranscription.ts`, the `saveTranscriptChunk` function already writes AssemblyAI deltas to `meeting_transcription_chunks` with `transcriber_type: 'assembly'`. However, this only runs when `dualTranscription` is explicitly enabled. On iOS, the AssemblyAI real-time preview runs independently via `useAssemblyAIRealtime` but its output is **never saved**.

**Fix:** Add a periodic flush (every 30s) of `assemblyPreview.fullTranscript` to a new or existing DB column on the `meetings` table (e.g. `live_transcript_backup`), so there is always a recoverable copy.

### Change 2: Stop the "fake saved" lie

Remove the false `saveStatus: 'saved'` when `currentMeetingId` is missing. Instead, queue the chunk and retry when the meeting ID becomes available, or mark it as `'failed'` so the UI honestly reflects the problem.

### Change 3: Mandatory transcript flush on stop

Before the consolidation query at line 5285, if the in-memory `transcript` variable has content but the DB has zero chunks, force-insert the entire in-memory transcript as a single emergency chunk. This ensures that if all other paths failed, the words the user saw are still captured.

### Change 4: Audio health gate on iOS

Within `SimpleIOSTranscriber.start()`, add a 10-second post-start check: if `capturedBlobCount` is still 0, surface a visible warning toast ("No audio detected — check microphone permissions") and attempt stream recovery.

## Files to Modify

| File | Change |
|------|--------|
| `src/components/MeetingRecorder.tsx` | (1) Remove fake "saved" status when meetingId missing — queue for retry instead. (2) Add emergency transcript flush before consolidation query. (3) Add 10s audio health check after iOS transcriber start. |
| `src/hooks/useAssemblyAIRealtime.ts` (or equivalent) | Add periodic DB flush of streaming transcript as backup. |
| `src/utils/SimpleIOSTranscriber.ts` | Add post-start health check callback. |

## Summary

The core design flaw is that the system treats AssemblyAI streaming as disposable display data with no persistence, while relying entirely on Whisper iOS chunks for DB storage. When the Whisper path fails silently, there is no backup and no honest error reporting. The fix adds three layers of defense: backup persistence for the streaming transcript, honest failure reporting, and an emergency flush on stop.

