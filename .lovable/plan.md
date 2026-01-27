

# Investigation: First Whisper Chunks Not Captured

## Problem Summary

From your screenshot, the **Live Transcript (AssemblyAI)** shows 144 words of transcription, but the **Audio Chunking Live Overview** shows **0 chunks, 0 words, Rate: 0%**. This indicates that AssemblyAI's real-time transcription is working, but the Whisper batch transcription system is not producing visible output in the "Audio Chunking Live Overview" panel.

---

## Root Cause Analysis

The issue is caused by the **30-second delay** before the first Whisper chunk is processed and appears in the UI. There are two separate transcription systems running:

1. **AssemblyAI (Live)** — Provides real-time, word-by-word transcription via WebSocket. This appears instantly.

2. **Whisper (Batch)** — Buffers audio for 30 seconds before processing. The first chunk only appears after this initial delay.

### Technical Evidence

| Component | Delay Setting | Location |
|-----------|---------------|----------|
| Desktop chunk interval | 30 seconds | `MeetingRecorder.tsx:1313-1321` — `setTimeout(..., 30000)` |
| New chunk start interval | 27 seconds | `MeetingRecorder.tsx:1365` — `setInterval(..., 27000)` |
| Whisper flush timer | 25 seconds | `WhisperTranscriber.ts:36` — `FLUSH_INTERVAL_MS = 25000` |
| Config target chunk duration | 30 seconds | `whisperChunking.ts:6` — `chunkDurationMs: 30000` |

### What This Means

If you've only been recording for ~30 seconds or less, the first Whisper chunk has not yet been:
1. Stopped (after 30 seconds of recording)
2. Processed (transcoded, sent to API)
3. Displayed in the UI

Meanwhile, AssemblyAI has already delivered 144 words of live transcription because it streams results immediately.

---

## Proposed Fix: Add Early First Chunk Processing

To provide quicker visual feedback in the "Audio Chunking Live Overview", we should send the first chunk earlier (e.g., after 10-12 seconds) and then switch to the normal 30-second interval for subsequent chunks.

### Changes Required

#### 1. Add First Chunk Fast-Track in `MeetingRecorder.tsx`

**Concept**: Send the very first chunk after **10 seconds** for quick user feedback, then continue with 30-second chunks for better accuracy.

**Location**: `src/components/MeetingRecorder.tsx` (lines 1262-1330)

**Logic Change**:
```text
Current flow:
- Chunk 1 starts → waits 30s → stops → processes
- Chunk 2 starts at 27s → waits 30s → stops → processes

Proposed flow:
- Chunk 1 starts → waits 10s → stops → processes (FAST FIRST CHUNK)
- Chunk 2 starts at 10s → waits 30s → stops → processes
- Chunk 3 starts at 37s → waits 30s → stops → processes
- (normal 27s interval continues)
```

#### 2. Modifications to `startNewChunk()` Function

Add a flag `isFirstChunk` and use a shorter timeout (10 seconds) for the initial chunk:

```typescript
// Track if this is the first chunk
let isFirstChunk = true;

const startNewChunk = () => {
  const currentChunkId = chunkId++;
  const chunks: Blob[] = [];
  chunkData.current.set(currentChunkId, chunks);
  
  // ... existing timing code ...

  recorder.start();

  // FAST FIRST CHUNK: Process after 10s for quick feedback
  const chunkDuration = isFirstChunk ? 10000 : 30000;
  
  if (isFirstChunk) {
    console.log('⚡ First chunk: Processing after 10s for quick feedback');
    isFirstChunk = false;
  }

  const stopTimeout = setTimeout(() => {
    if (chunkRecorders.current.has(currentChunkId)) {
      const recorder = chunkRecorders.current.get(currentChunkId);
      if (recorder && recorder.state === 'recording') {
        recorder.stop();
        chunkRecorders.current.delete(currentChunkId);
      }
    }
  }, chunkDuration);

  chunkIntervals.current.set(currentChunkId, stopTimeout);
};
```

#### 3. Also Update the Interval Start

Change the first interval to fire after 10 seconds (matching the first chunk duration):

```typescript
// Start first chunk immediately
startNewChunk();

// FAST FIRST INTERVAL: Start second chunk after 10s, then use 27s intervals
setTimeout(() => {
  if (isRecording && isRecordingRef.current && chunksStream?.active) {
    startNewChunk(); // Start second chunk at 10s
    
    // Now set up the regular 27s interval for subsequent chunks
    const chunkInterval = setInterval(() => {
      if (isRecording && isRecordingRef.current && chunksStream?.active) {
        startNewChunk();
      } else {
        clearInterval(chunkInterval);
      }
    }, 27000);
    
    segmentIntervalRef.current = chunkInterval;
  }
}, 10000);
```

---

## Summary of Files to Modify

| File | Change |
|------|--------|
| `src/components/MeetingRecorder.tsx` | Add fast first chunk (10s) logic in `startOverlappingChunkRecording()` |

---

## Expected Outcome

After this fix:
- **First chunk appears after ~10-12 seconds** instead of ~30+ seconds
- User sees immediate confirmation that Whisper chunking is working
- Subsequent chunks continue with optimal 30-second windows for accuracy
- "Audio Chunking Live Overview" will show "1 chunk" much sooner

---

## Alternative Quick Fix

If you don't want to modify the code, be aware that:
- The first Whisper chunk will always take ~30 seconds to appear
- This is by design for better transcription quality
- AssemblyAI provides the live feedback in the meantime

The current behaviour is **not a bug** — it's a timing issue where the first batch chunk takes longer to process than the live stream. However, adding a "fast first chunk" would improve the user experience significantly.

