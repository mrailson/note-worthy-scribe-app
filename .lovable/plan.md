

# Fix Audio Reprocessing: Add Retries and Timeout Handling

## Problem
Segment 2 failed with "Failed to send a request to the Edge Function" — the Whisper API call for 5.6 MB segments can take 60-120+ seconds, causing edge function timeouts. Once one call times out, the error propagates. There's no retry logic, so a transient timeout kills the segment permanently.

## Changes

### 1. Edge function: `reprocess-audio-segment/index.ts`
- Add an `AbortSignal.timeout(120_000)` to the Whisper fetch call so we get a clear timeout error rather than a generic failure
- If the segment is >20 MB, return an error suggesting it's too large (guard rail)

### 2. Client: `AudioBackupManager.tsx` — add retry with backoff
- Wrap each segment's `supabase.functions.invoke` call in a retry loop (up to 2 retries with 3s delay)
- On retry, update segment status to show "retrying (attempt 2/3)…"
- Add a "Retry Failed" button after completion that re-runs only the failed segments
- Add a small delay (1s) between sequential segment calls to avoid hammering the function

### 3. UI improvements in `AudioBackupManager.tsx`
- Show a "Retry Failed Segments" button after the loop completes if any segments have `status: 'error'`
- When clicking retry, only re-invoke the failed segment indices, updating results in place
- Show elapsed time per segment so user can see progress isn't stuck

## Technical detail

```text
Per-segment flow:
  attempt 1 → timeout/fail → wait 3s → attempt 2 → timeout/fail → wait 3s → attempt 3 → mark error
  
Between segments:
  wait 1s before starting next (prevents concurrent function boot storms)
```

### Files
1. **Edit**: `supabase/functions/reprocess-audio-segment/index.ts` — add fetch timeout signal
2. **Edit**: `src/components/AudioBackupManager.tsx` — retry logic + retry-failed button + inter-segment delay

