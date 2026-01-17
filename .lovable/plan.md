# Fix Duplicate Chunk Counting

## Problem
The SimpleIOSTranscriber callback in MeetingRecorder.tsx is duplicating chunk data:
1. It calls `handleBrowserTranscript()` which adds a chunk and reports to watchdog
2. Then it ALSO calls `watchdog.reportChunkProcessed()` and `setChunkSaveStatuses()` again

This causes the transcript tab to show double the actual chunks.

## Solution

### Step 1: Modify SimpleIOSTranscriber onTranscription callback
In `src/components/MeetingRecorder.tsx`, around lines 2260-2295, simplify the callback to ONLY call `handleBrowserTranscript()`:

```typescript
onTranscription: (text: string, isFinal: boolean, confidence: number) => {
  if (!text || !text.trim()) return;
  
  const transcriptData = {
    text: text.trim(),
    timestamp: new Date().toISOString(),
    is_final: isFinal,
    confidence: confidence,
    source: 'ios-simple' as const
  };
  
  handleBrowserTranscript(transcriptData);
  // REMOVE: The duplicate watchdog.reportChunkProcessed() call
  // REMOVE: The duplicate setChunkSaveStatuses() call
},
```

### Step 2: Verify handleBrowserTranscript
Confirm that `handleBrowserTranscript` already handles:
- Adding to chunkSaveStatuses
- Calling watchdog.reportChunkProcessed()
- Updating audio activity

## Expected Result
- Recorder badge and transcript tab show identical chunk counts
- Word counts are accurate (no duplicates)
- Single source of truth for chunk data
