

## Fix Julia's Meeting word_count + Patch Edge Function Robustness

### What happened
Julia's meeting `ef7711ae-...` has `notes_generation_status: completed` but `word_count: 0`. The edge function code does set `word_count`, so either the stitching initially produced empty text (before re-run), or a separate process reset it. The transcript text exists in `whisper_transcript_text` (confirmed earlier at 84,715 chars / ~16,258 words).

### Plan

**1. Fix Julia's meeting word_count now**

Run a data update (via the insert/update tool) to set `word_count` to the actual count derived from `whisper_transcript_text`:
```sql
UPDATE meetings 
SET word_count = array_length(
  regexp_split_to_array(trim(whisper_transcript_text), '\s+'), 1
)
WHERE id = 'ef7711ae-2bc8-4c1b-a28c-5b7e075e16ea'
  AND whisper_transcript_text IS NOT NULL;
```

**2. Check for any other meetings with the same issue**

Query for meetings where `whisper_transcript_text` has content but `word_count` is 0, and fix those too.

**3. Patch edge function for robustness**

In `supabase/functions/transcribe-offline-meeting/index.ts`, add a safety check after stitching: if the stitched transcript is empty but chunks exist, log an error and don't overwrite `word_count` with 0. Also add a verification read-back after the update to confirm `word_count` was persisted.

### Files to modify
- `supabase/functions/transcribe-offline-meeting/index.ts` — add empty-transcript guard
- Database update for Julia's meeting (and any others affected)

