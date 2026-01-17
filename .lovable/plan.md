# Fix Word Count to Show Net Transcript Words

## Problem
The "Meeting Word Count" on the recorder screen is calculated from ALL transcription chunks, including those that were rejected during the merge process (due to duplication, low confidence, or overlap). This makes the word count higher than the actual words in the transcript.

**Example from your session:**
- Total chunks: 10, but only 7 merged into transcript
- Word count showing: 776 (from all chunks)
- Actual transcript words: ~536 (only merged chunks)

## Solution
Change the word count calculation to count words from the actual `transcript` string (the merged result) instead of summing all chunks.

### Step 1: Modify the word count useEffect in MeetingRecorder.tsx

**Location:** `src/components/MeetingRecorder.tsx` lines 177-186

**Current code:**
```typescript
// Calculate word count from all chunks
useEffect(() => {
  const totalWords = chunkSaveStatuses.reduce((total, chunk) => {
    const chunkWordCount = chunk.text.trim().split(/\s+/).filter(word => word.length > 0).length;
    return total + chunkWordCount;
  }, 0);
  
  setWordCount(totalWords);
  onWordCountUpdate(totalWords);
}, [chunkSaveStatuses, onWordCountUpdate]);
```

**New code:**
```typescript
// Calculate word count from the actual merged transcript (net words)
useEffect(() => {
  const netWords = transcript.trim().split(/\s+/).filter(word => word.length > 0).length;
  
  setWordCount(netWords);
  onWordCountUpdate(netWords);
}, [transcript, onWordCountUpdate]);
```

### Why This Works
1. The `transcript` state is only updated by `IncrementalTranscriptHandler` when chunks are successfully merged
2. Rejected chunks (duplicates, low confidence, overlapping) never make it into `transcript`
3. This gives the exact "net" word count that matches what appears in the transcript panel

### Expected Result
- Recorder screen "Meeting Word Count" will match the transcript tab's word count
- Both will show only the words that actually appear in the merged transcript
- The "Audio Chunking Live Overview" section can still show total words from all chunks if desired (for debugging/transparency)

## Optional Enhancement
If you want the ChunkSaveStatus component to also show "net" vs "gross" words:
- Keep showing "Words: X" as total from all chunks (current behaviour)
- Add a separate "Net: X" badge showing only successfully merged chunk words

This would provide visibility into how many words were captured vs how many made it into the transcript.
