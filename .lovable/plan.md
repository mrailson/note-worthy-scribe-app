

# Chunk-by-Chunk Audio Reprocessing with Live Progress

## Problem
The `reprocess-audio-backup` edge function tries to process all 7-8 audio segments in one call and times out (~150s limit). Downloading + transcribing 40+ MB of audio in a single function invocation is unreliable.

## Solution: One Segment Per Call, Client Drives the Loop

The client calls a lightweight edge function once per segment, displays each result live, and saves the combined transcript at the end.

```text
Client (AudioBackupManager)          Edge Function (reprocess-audio-segment)
─────────────────────────────        ─────────────────────────────────────
1. Call: action='list'               → Lists folder, returns file names + sizes
2. For each segment:
   Call: action='transcribe', idx=N  → Downloads 1 file, calls Whisper, returns text
   Show segment N result in UI
   Append to running transcript
3. Call: action='save'               → Saves combined transcript to meetings table
```

## Changes

### 1. New edge function: `reprocess-audio-segment/index.ts`
Three actions:
- **`list`** — Takes `backupId`, lists storage folder, returns array of `{ name, size }` for audio files
- **`transcribe`** — Takes `backupId` + `segmentIndex`, downloads that one file, sends to Whisper via FormData, returns `{ text, wordCount }`
- **`save`** — Takes `meetingId` + `fullTranscript`, updates `meetings.whisper_transcript_text` and `word_count`

Each transcribe call handles only one ~5 MB segment — well within timeout.

### 2. Update `AudioBackupManager.tsx` — `reprocessAudio()`
Replace the single function call with a client-side loop:
- Call `list` to get segment count
- Loop through segments sequentially, calling `transcribe` for each
- Show a live progress card with:
  - Progress bar ("Segment 3 of 8")
  - Per-segment status: ✅ green tick + word count + first 60 chars, or ❌ red cross
  - Running total word count
  - ⏳ spinner on current segment
- After all segments complete, call `save` with combined transcript
- Individual segment failures don't block others — user sees which failed and can retry

### Progress UI (compact, inline in existing card)

```text
┌─ Reprocessing Audio ───────────────────────────────────┐
│ ████████████░░░░░░░░░  3 of 8 segments                 │
│                                                         │
│ ✅ Segment 1 — 1,842 words  "Good morning everyone..."  │
│ ✅ Segment 2 — 2,105 words  "The next item on the..."   │
│ ✅ Segment 3 — 1,923 words  "Moving to the budget..."   │
│ ⏳ Segment 4 — processing...                            │
│ ⬜ Segment 5                                            │
│ ⬜ Segment 6                                            │
│ ⬜ Segment 7                                            │
│ ⬜ Segment 8                                            │
│                                                         │
│ Running total: 5,870 words                              │
└─────────────────────────────────────────────────────────┘
```

### Files
1. **New**: `supabase/functions/reprocess-audio-segment/index.ts`
2. **Edit**: `src/components/AudioBackupManager.tsx` — new reprocessing loop + progress UI
3. Old `reprocess-audio-backup` function remains as-is (no changes needed)

