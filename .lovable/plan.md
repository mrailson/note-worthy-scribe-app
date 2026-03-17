

## Problem

AssemblyAI's speaker diarization (`speaker_labels: true`) assigns `[Speaker A]`, `[Speaker B]` tags to utterances based on voice fingerprinting. However, this is unreliable — it misidentifies speakers, attributes statements to people not present, and confuses voices. The note generation AI then tries to map these wrong labels to real attendee names, producing notes that incorrectly credit decisions and actions to the wrong people.

## Solution: Disable Speaker Diarization Safely

Remove speaker diarization from AssemblyAI transcription and strip speaker attribution instructions from the note generation prompts. The notes will still reference attendees from the metadata but will not falsely attribute specific statements to individuals.

### Changes

**1. `supabase/functions/assemblyai-transcription/index.ts`**
- Set `speaker_labels: false` (currently `true`)
- Remove `speakers_expected: 3`
- Stop formatting output as `[Speaker A]: text` — just return `result.text` directly

**2. `supabase/functions/assemblyai-transcription-url/index.ts`**
- Set `speaker_labels: false` (currently `true`)
- Remove `speakers_expected: 4`
- Return `result.text` instead of utterance-formatted speaker text

**3. `supabase/functions/auto-generate-meeting-notes/index.ts`**
- Remove the "SPEAKER ATTRIBUTION CONTEXT" block (lines ~1407-1434) that fetches `assembly_transcript_text` and extracts speaker labels
- Remove the `speakerSection` variable and its injection into the user prompt (lines ~1513-1527)
- Remove the "SPEAKER ATTRIBUTION RULES" section from the system prompt (lines ~1231-1241)
- Keep the attendee list in context — the AI can still mention attendees generally, it just won't falsely attribute specific quotes

**4. `supabase/functions/generate-consolidated-meeting-notes/index.ts`**
- Remove the `hasSpeakerLabels` conditional block (lines ~188-196) that instructs the AI to use `[Speaker A]` format for attribution

### What is preserved
- All transcription engines continue to run (Whisper, AssemblyAI, Deepgram)
- AssemblyAI still provides its high-quality transcript text — just without speaker tags
- The "Best of All" merger still cross-references all three sources
- Meeting attendee names still appear in notes from metadata
- The Discussion audio feature (Alice/George) is unaffected — it uses scripted speakers, not diarization

### Edge functions to redeploy
- `assemblyai-transcription`
- `assemblyai-transcription-url`
- `auto-generate-meeting-notes`
- `generate-consolidated-meeting-notes`

