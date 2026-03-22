

# Fix: Include Deepgram in stop-recording word count check

## Problem
When recording stops, the word count check at line 4880 only considers AssemblyAI and Whisper:
```
let effectiveWords = Math.max(assemblyWords, whisperWords);
```
The Deepgram transcript is ignored, so if Assembly is slow to start and Whisper hasn't processed yet, the meeting is rejected as "too short" even though Deepgram has 100+ words.

The periodic live word count (line 791) correctly uses all three engines — this is just the stop-recording gate that's missing Deepgram.

## Fix

**File: `src/components/MeetingRecorder.tsx`** — line 4878-4880

Add `deepgramWords` to the effective word count calculation:

```typescript
const assemblyWords = countWords(assemblyPreview.fullTranscript);
const whisperWords = countWords(transcript);
const deepgramWords = countWords(deepgramPreview.fullTranscript);
let effectiveWords = Math.max(assemblyWords, whisperWords, deepgramWords);
```

Update the log line (4881) to include deepgram count for diagnostics.

One-line fix in a single file.

