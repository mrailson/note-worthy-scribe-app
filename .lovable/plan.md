

## Fix Julia's Missing Transcript + Add Re-transcribe Button

### Problem Analysis
Julia's 91-minute offline recording uploaded 7 audio chunks successfully to Supabase Storage, but the `transcribe-offline-meeting` edge function **timed out** after processing only 3 of 7 chunks. Supabase edge functions have a ~150s execution limit, and transcribing 7 x ~6MB chunks sequentially exceeds that. The meeting record exists (ID: `ef7711ae-...`) with no transcript and no word count.

### Plan

**1. Fix the edge function to handle large recordings**

Rewrite `supabase/functions/transcribe-offline-meeting/index.ts` to process chunks **one at a time with self-invocation**. After transcribing each chunk, save progress to a `meeting_transcription_chunks` row, then call itself again for the next chunk. On final chunk, stitch all chunk texts together, update the meeting, and trigger note generation. This keeps each invocation well under the timeout.

**2. Fix Julia's meeting immediately**

Re-invoke the updated function for meeting `ef7711ae-2bc8-4c1b-a28c-5b7e075e16ea`. Since chunks 0-2 were transcribed but never saved to the DB (the function died before reaching the update step), it will re-process all 7 chunks.

**3. Add "Re-transcribe" button on meeting cards with missing transcripts**

In `src/components/MeetingHistoryList.tsx`, detect meetings where:
- `import_source` is `mobile_offline` or `mobile_live`
- `word_count` is null/0 or transcript is missing
- Audio chunks exist in storage

Show an amber badge with a "Re-transcribe" button that invokes the `transcribe-offline-meeting` function. Include a spinner state while processing.

### Technical Details

**Edge function self-chaining pattern:**
```
POST { meetingId, chunkIndex: 0 }
  → transcribe chunk 0 → save to meeting_transcription_chunks
  → POST self with { meetingId, chunkIndex: 1 }
  → ...
  → final chunk: stitch all, update meeting, trigger notes
```

**Meeting card detection logic:**
```typescript
const needsTranscription = meeting.import_source?.startsWith('mobile_') 
  && (!meeting.word_count || meeting.word_count === 0);
```

**Files to modify:**
- `supabase/functions/transcribe-offline-meeting/index.ts` — rewrite with chunk-by-chunk self-invocation
- `src/components/MeetingHistoryList.tsx` — add re-transcribe button for meetings missing transcripts

