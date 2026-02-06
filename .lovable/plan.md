# Clean Whisper Transcript Pipeline — IMPLEMENTED

## Status: ✅ Complete

## What Was Done

Eliminated repeated paragraphs from meeting transcripts by:

1. **New `cleanWhisperTranscript` utility** (`src/lib/cleanWhisperTranscript.ts`) — 3-step pipeline:
   - Step A: Block-level overlap trim (~350 chars, ratio >= 0.60)
   - Step B: Paragraph-hash dedup (FNV-1a 32-bit, sliding window of 50)
   - Step C: Sentence dedup (existing `deduplicateFullText`)

2. **Whisper promoted to gold engine** (`src/utils/BestOfBothMerger.ts`):
   - Whisper = Tier 1, Assembly/Deepgram = Tier 2 (gap-fill only)
   - Gap-fill similarity gate: Jaccard >= 0.75 blocks redundant candidates
   - Config aligned: `chunkDurationSec: 90`, `overlapSec: 3`

3. **Real-time clean** (`src/transcribers/ChunkedWhisperTranscriber.ts`):
   - Runs `cleanWhisperTranscript` after `deduplicateChunk` when `chunkIndex >= 2`

4. **Server-side clean** (`supabase/functions/consolidate-meeting-chunks/index.ts`):
   - Inlined `cleanWhisperTranscript` (Deno-compatible)
   - Whisper fed as ONE gold chunk (no re-splitting)
   - Engine tiers flipped + gap-fill gate mirrored
   - Diagnostic fields in response and `merge_decision_log` JSONB

## Pipeline

```text
Raw Whisper chunks (90s / 3s overlap)
      |
      v
Concatenate → whisper_raw
      |
      v
cleanWhisperTranscript()
  A: Block overlap trim
  B: Paragraph-hash dedup (FNV-1a)
  C: Sentence dedup
      |
      v
whisper_clean (ONE gold chunk)
      |
      v
Best-of-All merger (Whisper T1, others T2 gap-fill)
      |
      v
Post-merge dedup (safety net)
      |
      v
best_of_all_transcript + diagnostics
```

## Diagnostic Fields (merge_decision_log)

- `whisperRawWordCount` / `whisperCleanWordCount`
- `whisperCleanStats` (paragraphsDropped, overlapsTrimmed)
- `assemblyRawWordCount` / `deepgramRawWordCount`
- `finalWordCount` / `finalEqualsWhisperClean`
