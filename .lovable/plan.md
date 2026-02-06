

# Supabase Rate Limiting -- Root Cause Analysis and Fix Plan

## What's Going Wrong

Despite the previous optimisation round, the application is still generating excessive database queries due to three main problems:

### Problem 1: Triple Subscription on the `meetings` Table

Three separate components each maintain their own real-time listener on the same table:

| Component | Channel | Events | Action on Trigger |
|-----------|---------|--------|-------------------|
| `MeetingRecorder.tsx` | `meeting-changes` | INSERT, UPDATE | INSERT: full `loadMeetingHistory()` (debounce 3s); UPDATE: local patch |
| `MeetingHistory.tsx` | `meeting-history-changes-{id}` | INSERT, UPDATE, DELETE | INSERT/DELETE: full `fetchMeetings()` (debounce 2s); UPDATE: local patch |
| `MeetingHistoryList.tsx` | `meeting-updates-{id}` | ALL on `meeting_notes_multi` and `meeting_overviews` | Calls `onRefresh()` (which calls `fetchMeetings` again, debounce 5s) |

During an AI processing run, a single meeting row is updated 3-5 times. Each update fires events that hit all three listeners. Even with debouncing, the net result is 6-15 full reload calls within a 10-second window.

### Problem 2: `meeting_transcription_chunks` Still Being Scanned

The previous plan (Task 2) was supposed to remove the chunk-counting query, but `MeetingHistory.tsx` (line 1355) still runs:

```
supabase.from('meeting_transcription_chunks')
  .select('meeting_id', { count: 'exact' })
  .in('meeting_id', meetingIds)
```

This scans the 43,000+ row `meeting_transcription_chunks` table on every page load and every real-time refresh.

### Problem 3: Tab-Focus Refresh with Low Throttle

`MeetingHistory.tsx` (line 1236) calls `fetchMeetings()` every time the browser tab regains focus, throttled to only 2 seconds. Users switching between tabs during a meeting triggers repeated full reloads.

### Problem 4: Unbounded Word Count Query

`MeetingRecorder.tsx` (line 5519) queries `word_count` for ALL meetings (not just the paginated 50). With 261+ meetings, this is an unnecessary scan on every reload.

---

## Fix Plan (4 Tasks)

### Task 1: Remove the chunk-counting query from `MeetingHistory.tsx`

The `meeting_transcription_chunks` count is displayed as a minor badge and is not worth scanning 43,000+ rows for. Remove this query and default to 0.

**File:** `src/pages/MeetingHistory.tsx`

Changes:
- Replace the `meeting_transcription_chunks` query in the `Promise.all` block (lines 1353-1365) with `Promise.resolve({})`, matching what `MeetingRecorder.tsx` already does
- The `transcript_count` field will default to 0 (it's rarely displayed)

### Task 2: Remove the duplicate `meetings` subscription from `MeetingHistory.tsx`

The `MeetingHistory.tsx` page and `MeetingRecorder.tsx` both listen to the same `meetings` table. Since `MeetingRecorder` is the parent component and already handles INSERT (debounced reload) and UPDATE (local patch), the child page does not need its own subscription.

**File:** `src/pages/MeetingHistory.tsx`

Changes:
- Remove the entire real-time subscription `useEffect` block (lines 1066-1144) that creates the `meeting-history-changes-{user.id}` channel
- The page will rely on:
  - Its parent (`MeetingRecorder`) for real-time updates via prop changes
  - The `onRefresh` callback from `MeetingHistoryList` for notes/overview updates
  - The existing tab-focus refresh (with increased throttle -- see Task 3)

### Task 3: Increase tab-focus refresh throttle

Reduce the frequency of refreshes triggered by tab switching and localStorage signals.

**File:** `src/pages/MeetingHistory.tsx`

Changes:
- Increase `MIN_REFRESH_INTERVAL` from 2000ms to 10000ms (10 seconds) at line 1208
- Increase the setTimeout delay from 300ms to 1000ms at line 1219
- This prevents rapid-fire reloads when users switch tabs frequently during AI processing

### Task 4: Cap the word count query to paginated results only

Instead of scanning all 261+ meetings for word counts, use only the 50 already-fetched meetings.

**File:** `src/components/MeetingRecorder.tsx`

Changes:
- Replace the separate `word_count` query (lines 5519-5526) that scans all meetings with a simple client-side sum of the `word_count` field already present on the 50 fetched meetings
- Update `setTotalTranscriptWords` to use the local sum: `meetingsData.reduce((sum, m) => sum + (m.word_count || 0), 0)`
- Remove the fourth item from the `Promise.all` array entirely

---

## Technical Details

### Task 1 -- Chunk count removal

In `src/pages/MeetingHistory.tsx`, replace lines 1353-1365:

```typescript
const [transcriptCounts, summaryExists, documentCounts] = await Promise.all([
  // Chunk counts skipped — not worth scanning 43k+ rows
  Promise.resolve({} as Record<string, number>),

  // Check summary existence (unchanged)
  supabase
    .from('meeting_summaries')
    ...

  // Document counts (unchanged)
  supabase
    .from('meeting_documents')
    ...
]);
```

### Task 2 -- Subscription removal

Remove the entire `useEffect` block at lines 1066-1144 in `src/pages/MeetingHistory.tsx`. This eliminates one of the three competing real-time channels on the `meetings` table.

### Task 3 -- Throttle increase

In `src/pages/MeetingHistory.tsx`:
- Line 1208: Change `const MIN_REFRESH_INTERVAL = 2000;` to `const MIN_REFRESH_INTERVAL = 10000;`
- Line 1219: Change `}, 300);` to `}, 1000);`

### Task 4 -- Word count simplification

In `src/components/MeetingRecorder.tsx`, replace the `Promise.all` block (lines 5487-5527) to remove the fourth query:

```typescript
const [transcriptCounts, summaryExists, documentCounts] = await Promise.all([
  Promise.resolve({} as Record<string, number>),
  // summary existence check (unchanged)
  // document counts (unchanged)
]);

// Use word_count from already-fetched meetings instead of a separate query
const totalWords = (meetingsData || []).reduce(
  (sum: number, m: any) => sum + (m.word_count || 0), 0
);
setTotalTranscriptWords(totalWords);
```

---

## Expected Impact

| Metric | Current | After Fix |
|--------|---------|-----------|
| Real-time channels on `meetings` table | 3 | 1 (MeetingRecorder only) |
| Queries per AI processing run | 12-20 bursts | 3-5 bursts |
| Rows scanned per reload (chunks) | 43,000+ | 0 |
| Parallel queries per reload | 4 | 2 |
| Tab-focus refresh interval | 2 seconds | 10 seconds |
| Word count query scope | All 261+ meetings | 50 (paginated) |

## Implementation Order

1. Task 1 (remove chunk query) -- quick win, biggest row-scan reduction
2. Task 4 (word count simplification) -- removes a query from every reload
3. Task 2 (remove duplicate subscription) -- stops cascading reloads
4. Task 3 (increase throttle) -- reduces ambient query volume

