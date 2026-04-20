

## Why your 639-word meeting failed — definitive answer

**Meeting**: `9f7b61b4-7281-4a1d-8a27-7cb065116833` — "Meeting 20 Apr 12:52" (created 11:52:05, failed 11:52:20 UTC).

### Root cause (NOT the Notewell publish, NOT the 100-word guard)

The transcript **does exist** in the database (`meeting_transcription_chunks` — 2 Whisper chunks, 639 words, fully readable via `get_meeting_full_transcript`). But the **consolidation step never ran**, so on the `meetings` row:

- `status: pending_transcription` (never advanced to `completed`)
- `best_of_all_transcript`, `assembly_ai_transcript`, `whisper_transcript_text`, `live_transcript_text` — **all NULL**
- `transcript_updated_at: NULL`, `primary_transcript_source: whisper`

The whole thing failed in 15 seconds — that's the recording-stop handler tripping the auto-trigger before consolidation finished writing the merged transcript onto the `meetings` row.

### Did publishing from Notewell break it?

**No.** Publishing only swaps the frontend bundle. It doesn't touch edge functions, the database, or in-flight server jobs. The two are unrelated. The timing was coincidence.

### What actually broke (the real bug)

`auto-generate-meeting-notes` is racing the consolidation pipeline. When the recorder stops:
1. Whisper writes chunks to `meeting_transcription_chunks` ✅ (worked)
2. Consolidator should merge them onto `meetings.best_of_all_transcript` ❌ (didn't run / didn't finish)
3. Auto-generator fires immediately ❌ (sees NULL transcript columns, marks `failed`)

Ironically, `get_meeting_full_transcript` (the RPC) **does** read from `meeting_transcription_chunks` as a fallback — so the data was always recoverable. The auto-generator either didn't use that RPC, or marked failure before retrying.

---

## Plan

### Step 1 — Recover this meeting now (30 seconds)
Re-trigger generation via `manualTriggerAutoNotes('9f7b61b4-7281-4a1d-8a27-7cb065116833')`. The RPC will pull the 639 words from `meeting_transcription_chunks` and Claude will produce notes + a real title.

### Step 2 — Harden auto-generator against this race (the actual fix)
In `supabase/functions/auto-generate-meeting-notes/index.ts`:

- **Always** fetch transcript via `get_meeting_full_transcript` RPC first (it already handles the chunks fallback) before checking the `meetings.*_transcript` columns.
- If transcript length ≥ 100 words but `meetings.status = 'pending_transcription'`, **wait + retry** up to 3× (5s, 15s, 30s) instead of failing immediately.
- On final failure, write a human-readable reason to `meetings.notes_generation_status` (e.g. `failed_no_transcript` vs `failed_llm_timeout`) so the UI can show why.

### Step 3 — Surface a one-click "Retry" on failed meetings
In the meeting card, when `notes_generation_status = 'failed'`, show a small "Retry generation" button that calls `manualTriggerAutoNotes(meetingId)` — so users (and you) never have to dig into a console again.

### Files to change
- `supabase/functions/auto-generate-meeting-notes/index.ts` — RPC-first fetch + retry-on-pending logic
- `src/components/meetings/MeetingCard.tsx` (or equivalent) — failure pill + Retry button wired to `manualTriggerAutoNotes`

### What I will NOT touch
- The 100-word guard (correctly didn't trigger here — 639 ≫ 100)
- Notewell publish flow (unrelated)
- Consolidation pipeline (it works; the race is on the consumer side)

