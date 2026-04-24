## What's actually happening (confirmed)

You are right — it is duplicating the work. I checked your meeting `Meeting 24 Apr 14:59` directly:

| Stage | Where | Words |
|---|---|---|
| During recording (mobile, live AssemblyAI) | On your phone | ~7,000+ (you saw it climbing) |
| After "Stop" — chunk upload finishes | Server queues `transcribe-offline-meeting` | 0 (whisper hasn't run yet) |
| Whisper finishes chunk 0 | DB row updated | 1,727 |
| Chunk 0 + 1 done | DB row updated | 3,825 |
| All 4 chunks done | DB row updated | 7,722 |

So the screens you saw (`1.7K → 3.8K → …`) are Whisper redoing every minute of audio chunk-by-chunk, even though your phone already produced a perfectly good live transcript.

## Why it happens (root cause in code)

In `src/components/recorder/NoteWellRecorderMobile.jsx`:

1. On `stopRecording` (line 1640), the live transcript IS captured into the IndexedDB record as `capturedLiveTranscript`. ✅
2. But in `syncRecording` (line 2293), when the meeting row is inserted, **only the audio chunks are uploaded** — `capturedLiveTranscript` is never sent. ❌
3. The meeting is inserted with `status: 'pending_transcription'` and `notes_generation_status: 'queued'`, then `transcribe-offline-meeting` is invoked, which downloads every chunk and re-runs Whisper from scratch.

So: ~£X of Whisper compute, several minutes of waiting, and a worse result (Whisper alone vs. AssemblyAI live + word-count drift) — all to recreate something the phone already has.

The legacy single-file path (line 2378) does the same thing — it ignores `capturedLiveTranscript` and runs `standalone-whisper`.

## Proposed fix (minimal, safe, reuses existing pipeline)

Treat the mobile sync the same way the existing **"already-transcribed"** branch already does (line 2018) — that branch creates the meeting with `status: 'completed'` and `whisper_transcript_text` populated, then jumps straight to note generation. I just need to make the chunked upload path use it when a live transcript exists.

### Behaviour after fix

**Case A — Live mode with a usable live transcript (≥100 words):**
1. Upload chunks to storage (so audio is preserved for re-runs / playback / Best-of-All later).
2. Insert the meeting with `status: 'completed'`, `whisper_transcript_text = capturedLiveTranscript`, `primary_transcript_source: 'assemblyai_live'`, `word_count = <live count>`.
3. Insert one `meeting_transcription_chunks` row carrying the live transcript so existing tooling (re-generate notes, transcript view) sees it.
4. Skip `transcribe-offline-meeting` entirely.
5. Call `auto-generate-meeting-notes` immediately — same as today. Toast: "Meeting created — generating notes…" then "Meeting notes generated ✨" + auto-email (unchanged).

**Case B — Offline / live transcript empty or <100 words (no live data captured):**
- Behave exactly as today: upload chunks → `pending_transcription` → `transcribe-offline-meeting` → notes. Nothing changes for offline recordings.

**Case C — Live mode but live transcript looks materially shorter than expected:**
- Heuristic: if live word count is **< 30%** of expected (rough estimate: `duration_minutes × 100` words/min) AND there are uploaded chunks, fall back to Case B (server-side Whisper) for safety. This protects against the rare case where AssemblyAI dropped out mid-meeting and the live transcript is unreliable. We log a console warning so we can monitor.

### Files to change

1. **`src/components/recorder/NoteWellRecorderMobile.jsx`** — single function `syncRecording` (around lines 2092–2351):
   - After the chunk uploads succeed, branch on `rec.capturedLiveTranscript`.
   - If usable → insert completed meeting + chunk row + call `generateNotesForMeeting` directly (mirrors the existing "resume" branch at line 2018).
   - If not → existing `pending_transcription` + `transcribe-offline-meeting` path.
   - Same `triggerPostNoteActions` (auto-email) wiring as today, no UI changes.

2. **`src/components/recorder/NoteWellRecorderMobile.jsx`** — `syncLegacySingleFile` (line 2378):
   - Also check `rec.capturedLiveTranscript` first; if present, skip the `standalone-whisper` call and use the live transcript directly. (Low-impact: legacy path is rare, but consistent behaviour helps.)

No edge functions need modifying. No database migrations. No changes to desktop, no changes to offline mode.

### What the user will see after the fix

- Stop the meeting → Upload chunks (progress bar, same as now) → "Notes are being generated…" appears with the **correct word count immediately** (e.g. 7.7K straight away, not 1.7K → 3.8K → 7.7K).
- Notes generation runs once, on the live transcript, and email arrives.
- For your test meeting today: you'd have skipped ~3 minutes of redundant Whisper processing and seen 7,722 words on the first screen.

### Why this is safe

- Audio is still uploaded to storage in every case → re-process / playback / "Reprocess Existing Audio" button still works.
- The `transcribe-offline-meeting` fallback remains intact for offline recordings and short/missing live transcripts.
- The "already-transcribed resume" branch I'm mirroring is the same pattern already in production for recovered recordings — proven path.
- Word-count guard (< 100 words) is preserved.

### Out of scope (flag for follow-up if you want)

- "Best-of-All" merging of live AssemblyAI + post-hoc Whisper for highest fidelity. We could optionally still run Whisper in the background and upgrade the transcript later, but that's a separate enhancement and would re-introduce the cost you're trying to avoid. Recommend **not** doing this unless you specifically want it.

Approve and I'll implement.