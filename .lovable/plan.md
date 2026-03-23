

## Plan: Add Gladia as a Transcript Source in the Pipeline

### Overview
Wire Gladia into the full transcript pipeline — from real-time DB persistence, through the Best-of-All merger, to display in the Transcript tab. This replaces AssemblyAI (currently offline) as the third engine alongside Deepgram and Whisper.

### Architecture

```text
Recording (live)
  └─ useGladiaRealtimePreview → saves chunks to gladia_transcriptions table (new)

Stop Recording
  └─ consolidate-meeting-chunks edge function
       └─ Fetches gladia_transcriptions chunks
       └─ Feeds into mergeBestOfAll() as third engine (replacing/alongside Assembly)

Viewing (SafeModeNotesModal)
  └─ Transcript tab shows: Batch(Whisper) | Live(AssemblyAI) | Deepgram | Gladia | Best of All
  └─ Loads Gladia from gladia_transcriptions table
```

### Implementation Steps

**1. Create `gladia_transcriptions` database table**
- New migration mirroring `deepgram_transcriptions` schema: `meeting_id`, `user_id`, `session_id`, `chunk_number`, `transcription_text`, `confidence`, `is_final`, `word_count`
- Enable RLS with user-based policies

**2. Update `useGladiaRealtimePreview.ts` — persist chunks to DB**
- On each final transcript event, insert into `gladia_transcriptions` table
- Follow the exact pattern used by `useDeepgramRealtimePreview.ts` (chunk counter, meeting ID tracking)

**3. Update `consolidate-meeting-chunks` edge function — add Gladia as an engine**
- Expand `Engine` type: `'assembly' | 'whisper' | 'deepgram' | 'gladia'`
- Fetch from `gladia_transcriptions` table alongside Deepgram
- Add `gladia` to `normaliseConfidence()` (default ~0.78)
- Add `gladia` to `getEngineTier()` as tier 2 (gap-fill, same as Deepgram/Assembly)
- Feed Gladia chunks into `mergeBestOfAll()` as a fourth parameter (or merged into the combined array)
- Update the function signature and merge logic

**4. Add Gladia tab in `SafeModeNotesModal.tsx`**
- Add `gladiaTranscript` state variable
- Add `'gladia'` to the `transcriptSubTab` union type
- Load Gladia transcript from `gladia_transcriptions` table in `loadTranscript()`
- Add Gladia sub-tab button (orange-themed, matching live preview)
- Add Gladia transcript view section
- Update Best of All description text to mention Gladia

**5. Update `MeetingRecorder.tsx` — save Gladia transcript reference**
- Ensure `capturedGladiaTranscript` is included in the emergency recovery candidates

**6. Update Best of All label**
- Change "Best of All (3)" references to reflect the active engines (Whisper + Deepgram + Gladia when Assembly is absent)

### Technical Details

- The `mergeBestOfAll` function currently takes three separate arrays (whisper, assembly, deepgram). It will be extended to accept a fourth `gladiaRaw` array, combined into the same sorted pipeline.
- Gladia's confidence normalisation: ~0.78 default (between Deepgram 0.75 and Assembly 0.80), tier 2 for gap-fill.
- No changes needed to the Gladia streaming edge function — it already works for live preview.

