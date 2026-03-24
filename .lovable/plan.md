

## Fix Julia's Offline Transcription — Column Name Mismatch

### Root Cause
The `transcribe-offline-meeting` edge function uses column names `chunk_index` and `transcript_text`, but the existing `meeting_transcription_chunks` table has `chunk_number` and `transcription_text`. The logs confirm all 7 chunks were transcribed by Whisper, but the final stitching step crashed with:
```
column meeting_transcription_chunks.chunk_index does not exist
```

### Plan

**1. Fix the edge function column references**

Update `supabase/functions/transcribe-offline-meeting/index.ts`:
- `chunk_index` → `chunk_number`
- `transcript_text` → `transcription_text`
- Update the upsert conflict target to `meeting_id,chunk_number`

**2. Re-trigger transcription for Julia's meeting**

Invoke the fixed function for meeting `ef7711ae-2bc8-4c1b-a28c-5b7e075e16ea` starting at chunk 0. Since the first step clears previous chunks, it will do a clean re-run.

### Files to modify
- `supabase/functions/transcribe-offline-meeting/index.ts` — fix 6 column name references

