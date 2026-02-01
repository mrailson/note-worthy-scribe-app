

# Best-of-Both Transcript Merge Algorithm Implementation

## Overview

This plan implements the new chunk-level "best-of-both" transcript merging algorithm as specified in your pseudo-code. The algorithm replaces the current AI-based merging approach in `consolidate-dual-transcripts` with a deterministic, fast, and auditable local merge that runs **before** notes are generated.

## Architecture Decision

The merge will happen at **two points**:

1. **Real-time (during recording)** - For live transcript display
2. **Post-recording (chunk consolidation)** - For final transcript before notes generation

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                     RECORDING PHASE                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   Whisper Chunks ──┐                                                    │
│   (idx, text,      │                                                    │
│    confidence)     ├──► BestOfBothMerger ──► Live Merged Transcript     │
│                    │                                                    │
│   AssemblyAI       │                                                    │
│   Chunks ──────────┘                                                    │
│   (idx, text,                                                           │
│    start/endSec)                                                        │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                    POST-RECORDING PHASE                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   meeting_transcription_chunks ──► BestOfBothMerger ──► Final Merged    │
│   (both Whisper & Assembly                             Transcript       │
│    chunks from DB)                                                      │
│                                                                         │
│   Final Merged Transcript ──► generate-scribe-notes ──► Clinical Notes  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Create New Merge Utility

**File:** `src/utils/BestOfBothMerger.ts`

Create the deterministic merge algorithm as specified:

- **Types:** `Engine`, `RawChunk`, `NormChunk`, `MergeConfig`
- **Utilities:** 
  - `normaliseConfidence()` - Handle 0-1 vs 0-100 inputs, default AssemblyAI to 0.80
  - `normaliseText()` - Whitespace collapse, quote normalisation
  - `tokenise()` - Simple word tokeniser for similarity
  - `jaccardSim()` - Set-based similarity for overlap detection
  - `endsCleanly()` / `startsCleanly()` - Sentence boundary heuristics
  - `scoreChunk()` - Weighted score: 75% confidence + 15% length + 8% end bonus + 4% start bonus
- **Core Functions:**
  - `normaliseChunks()` - Build synthetic timeline (Whisper) or use real timing (AssemblyAI)
  - `mergeBestOfBoth()` - Main merge with winner-takes-all overlap resolution
  - `postProcessTranscript()` - Regex-only cleanup (capitalisation, dedupe, punctuation)

**Default Configuration:**
```text
chunkDurationSec: 15
overlapSec: 1.5
whisperConfFloor: 0.30
overlapSimilarity: 0.60
strongConfMargin: 0.12
maxLookback: 3
```

**Key Algorithm Details:**

1. **Synthetic Timeline for Whisper** - Ignore unreliable timestamps, use `idx * chunkDurationSec`
2. **AssemblyAI-First Policy** - On overlaps, keep AssemblyAI unless Whisper score exceeds by `strongConfMargin`
3. **Confidence Floor** - Whisper chunks below 30% only used when no overlapping AssemblyAI exists
4. **Winner-Takes-All** - No blending; either keep candidate A or B entirely
5. **Audit Trail** - Return `kept[]` and `dropped[]` for debugging

---

### Step 2: Update Whisper Chunking Config

**File:** `src/config/whisperChunking.ts`

Update to align with merge algorithm expectations:

```text
chunkDurationMs: 15000  (15 seconds to match merge config)
overlapMs: 1500         (1.5 seconds overlap)
```

This ensures the synthetic timeline in the merger matches actual chunk timing.

---

### Step 3: Integrate into Live Recording

**File:** `src/hooks/useDualTranscription.ts`

Modify to accumulate `RawChunk` arrays for both engines and call `mergeBestOfBoth()` for combined display:

- Track `assemblyRawChunks: RawChunk[]` and `whisperRawChunks: RawChunk[]`
- On each new chunk, append to the appropriate array with proper `idx`
- Call `mergeBestOfBoth()` to produce the unified `mergedTranscript` for display
- Store merge audit (`kept`, `dropped`) for debugging panel

---

### Step 4: Update Meeting Recorder Integration

**File:** `src/components/MeetingRecorder.tsx`

- Import and use the new `BestOfBothMerger`
- Add a third transcript view mode: `'merged'` alongside `'batch'` and `'live'`
- Display the merged transcript as the default view during recording
- Pass both transcript sources to chunk storage with `source` field

---

### Step 5: Update Chunk Consolidation Edge Function

**File:** `supabase/functions/consolidate-meeting-chunks/index.ts`

Modify to use the best-of-both algorithm for final transcript:

1. Fetch all chunks grouped by `source` (`'whisper'` vs `'assembly'`)
2. Build `RawChunk[]` for each engine from database records
3. Run `mergeBestOfBoth()` server-side (port TypeScript to Deno-compatible code)
4. Store the merged transcript in `meetings.whisper_transcript_text` (or new `merged_transcript_text` field)
5. Log `kept` and `dropped` counts for audit

---

### Step 6: Update Notes Generation

**File:** `supabase/functions/generate-scribe-notes/index.ts`

When calling notes generation:

- If a pre-merged transcript exists, use it as `singleTranscript`
- This simplifies the AI's task - it no longer needs to cross-reference two sources
- The `best-of-both` reasoning in the prompt becomes a fallback for legacy data

---

### Step 7: Add Debug Panel Component

**File:** `src/components/MergeAuditPanel.tsx`

Create a debug panel for developers/admins showing:

- Total chunks per engine
- Kept vs dropped counts
- List of dropped chunks with rejection reasons
- Overlap detection visualisation
- Confidence score distribution

---

## Technical Specifications

### Chunk Interface (Database to Merger)

```text
meeting_transcription_chunks table:
  - meeting_id: UUID
  - chunk_number: number (monotonic per engine)
  - transcription_text: string
  - confidence_score: number (0-1)
  - source: 'whisper' | 'assembly'
  - start_time: timestamp (optional, mainly for AssemblyAI)
  - end_time: timestamp (optional)
```

### Merge Output

```text
{
  transcript: string,        // Final merged text
  kept: NormChunk[],         // Chunks included
  dropped: NormChunk[],      // Chunks rejected
  stats: {
    whisperChunks: number,
    assemblyChunks: number,
    keptCount: number,
    droppedCount: number,
    overlapConflicts: number
  }
}
```

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/utils/BestOfBothMerger.ts` | **Create** | Core merge algorithm |
| `src/config/whisperChunking.ts` | Modify | Align chunk timing |
| `src/hooks/useDualTranscription.ts` | Modify | Live merge integration |
| `src/components/MeetingRecorder.tsx` | Modify | Add merged view mode |
| `supabase/functions/consolidate-meeting-chunks/index.ts` | Modify | Server-side merge |
| `supabase/functions/generate-scribe-notes/index.ts` | Modify | Use pre-merged transcript |
| `src/components/MergeAuditPanel.tsx` | **Create** | Debug visualisation |

---

## Benefits of This Approach

1. **Deterministic** - Same inputs always produce same output (no AI variance)
2. **Fast** - Runs in milliseconds, no API calls
3. **Auditable** - Clear log of what was kept/dropped and why
4. **Testable** - Pure functions with predictable behaviour
5. **Cost-effective** - Eliminates AI merge tokens for consolidation
6. **Clinically safe** - Whisper confidence floor prevents hallucinations entering the record

---

## Risk Mitigations

- **Fallback to AI merge** - If local merge fails, fall back to existing `consolidate-dual-transcripts` function
- **Audit logging** - All merge decisions logged for review
- **Safety keywords protection** - Integrate with existing `SAFETY_KEYWORDS` from `liveMerge.ts`
- **Gradual rollout** - Start with new recordings, don't retroactively re-merge historical data

