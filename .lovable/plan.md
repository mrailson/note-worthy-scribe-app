# Best-of-Both Transcript Merge Algorithm Implementation

## Status: ✅ COMPLETE

All 7 implementation steps have been completed:

- [x] Step 1: Created `src/utils/BestOfBothMerger.ts` with deterministic merge algorithm
- [x] Step 2: Updated `src/config/whisperChunking.ts` (15s chunks, 1.5s overlap)
- [x] Step 3: Integrated into `src/hooks/useDualTranscription.ts` for live merging
- [x] Step 4: MeetingRecorder integration (via useDualTranscription hook)
- [x] Step 5: Updated `consolidate-meeting-chunks` edge function with server-side merger
- [x] Step 6: Updated `generate-scribe-notes` to accept pre-merged transcript
- [x] Step 7: Created `src/components/MergeAuditPanel.tsx` debug panel

---

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

## Key Algorithm Details

1. **Synthetic Timeline for Whisper** - Ignore unreliable timestamps, use `idx * chunkDurationSec`
2. **AssemblyAI-First Policy** - On overlaps, keep AssemblyAI unless Whisper score exceeds by `strongConfMargin`
3. **Confidence Floor** - Whisper chunks below 30% only used when no overlapping AssemblyAI exists
4. **Winner-Takes-All** - No blending; either keep candidate A or B entirely
5. **Audit Trail** - Return `kept[]` and `dropped[]` for debugging

**Default Configuration:**
```text
chunkDurationSec: 15
overlapSec: 1.5
whisperConfFloor: 0.30
overlapSimilarity: 0.60
strongConfMargin: 0.12
maxLookback: 3
```

---

## Benefits

1. **Deterministic** - Same inputs always produce same output (no AI variance)
2. **Fast** - Runs in milliseconds, no API calls
3. **Auditable** - Clear log of what was kept/dropped and why
4. **Testable** - Pure functions with predictable behaviour
5. **Cost-effective** - Eliminates AI merge tokens for consolidation
6. **Clinically safe** - Whisper confidence floor prevents hallucinations entering the record
