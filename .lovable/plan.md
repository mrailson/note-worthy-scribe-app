

# Fix Supabase Rate Limiting - Query Optimisation Plan

## Problem Summary

Your Supabase project is hitting rate limits because every meeting update (from edge functions, real-time events, etc.) triggers a full reload of **all 261 meetings** plus 4 parallel heavy sub-queries. The worst offender fetches the full `whisper_transcript_text` blob for every meeting just to count words — even though 243 of 261 meetings already have the answer stored in a `word_count` column.

During a typical notes-generation run (Standard + Overview + Audio), the edge functions update the meeting row 3-5 times, each triggering cascading reloads across multiple components — producing 12-20 heavy query bursts within seconds.

## Fixes (5 tasks)

---

### Task 1: Use the existing `word_count` column instead of fetching transcript blobs

**What changes:** In `MeetingRecorder.tsx`, the `loadMeetingHistory` function currently fetches the full `whisper_transcript_text` for all meetings to count words client-side. This is the single most expensive query.

**Fix:** Replace the transcript-blob query with a simple `SELECT SUM(word_count)` using the already-populated `word_count` column (243/261 meetings have it). Add `word_count` to the main meeting select so it's available per-meeting too.

**Impact:** Eliminates fetching ~1 million words of text on every reload.

---

### Task 2: Replace chunk-counting query with server-side aggregation

**What changes:** The `meeting_transcription_chunks` query currently fetches every `meeting_id` row (43,161 rows) and counts them in JavaScript. Similarly, `meeting_documents` rows are fetched individually.

**Fix:** Use Supabase's `select('meeting_id', { count: 'exact', head: true })` grouped approach, or better: add `transcript_count` to the main meetings query using the already-available `transcript_count` field pattern. For chunks, use a lightweight RPC or simply stop fetching chunk counts on the list page (they're rarely displayed).

**Impact:** Reduces 43,000+ row fetches to a single aggregated query.

---

### Task 3: Remove duplicate word-count fetching in MeetingHistoryList

**What changes:** `MeetingHistoryList.tsx` independently fetches `content` from `meeting_transcripts` for all visible meetings to compute word counts (lines 362-391). This duplicates the work already done by `MeetingRecorder.tsx` and fetches large text blobs unnecessarily.

**Fix:** Remove this `useEffect` entirely. Instead, use the `word_count` field from the meeting object (which will be included from Task 1) or the `wordCounts` already passed down.

**Impact:** Eliminates another full-transcript-blob fetch on every page render.

---

### Task 4: Debounce and deduplicate real-time subscriptions

**What changes:** Three separate components maintain overlapping real-time subscriptions:
- `MeetingRecorder.tsx` — no debounce, calls `loadMeetingHistory()` on every INSERT/UPDATE
- `MeetingHistoryList.tsx` — 2s debounce but listens to `meetings`, `meeting_notes_multi`, AND `meeting_overviews` (wildcard `*`)
- `MeetingHistory.tsx` — its own subscription with partial debounce

Each edge function update triggers all three, causing cascading reloads.

**Fix:**
1. **MeetingRecorder.tsx**: Add a 3-second debounce to the real-time handler. For `UPDATE` events, update the specific meeting in local state (like `MeetingHistory.tsx` already does) instead of calling `loadMeetingHistory()`.
2. **MeetingHistoryList.tsx**: Remove the `meetings` table listener (parent already handles it). Keep `meeting_notes_multi` and `meeting_overviews` listeners but increase debounce to 5 seconds.
3. Both components: use a shared `lastRefreshTime` ref pattern to prevent overlapping refreshes.

**Impact:** Reduces 12-20 query bursts per processing run down to 2-3.

---

### Task 5: Paginate the main meetings query in MeetingRecorder

**What changes:** `loadMeetingHistory()` currently fetches all 261 meetings with no limit. As the dataset grows, this will only get worse.

**Fix:** Add `.limit(50)` to the main meetings query (matching what the UI actually paginates). The total word count can use the lightweight `SUM(word_count)` query from Task 1 which doesn't need all rows.

**Impact:** Reduces the base query from 261 rows (growing) to 50, and proportionally reduces all sub-queries.

---

## Technical Details

### Task 1 — Detailed changes in `MeetingRecorder.tsx`

```text
In loadMeetingHistory():

1. Add 'word_count' to the main .select() call (line ~5451)
2. Replace the whisper_transcript_text query (lines 5526-5538) with:
   supabase
     .from('meetings')
     .select('word_count')
     .eq('user_id', user.id)
     .not('word_count', 'is', null)
     .then(({ data }) => {
       return (data || []).reduce((sum, r) => sum + (r.word_count || 0), 0);
     })
3. In the meetingsWithCounts mapping, use meeting.word_count directly
```

### Task 2 — Chunk count simplification

```text
Replace the meeting_transcription_chunks query (lines 5487-5497) with:
- Simply remove it. The transcript_count is used for a minor UI badge.
- If needed, use a database function (RPC) that returns 
  SELECT meeting_id, count(*) FROM meeting_transcription_chunks 
  WHERE meeting_id = ANY($1) GROUP BY meeting_id
  — returning only the counts, not 43k rows.
```

### Task 3 — Remove duplicate in `MeetingHistoryList.tsx`

```text
Delete the useEffect at lines 362-391 entirely.
Remove the wordCounts state variable.
Use meeting.word_count (from props) wherever word counts are displayed.
```

### Task 4 — Debounce pattern for `MeetingRecorder.tsx`

```text
Replace the real-time useEffect (lines 5582-5621):

1. Add debounce tracking:
   const lastRefreshRef = useRef(0);
   const DEBOUNCE_MS = 3000;

2. For UPDATE events: update local state directly from payload
   setMeetings(prev => prev.map(m => 
     m.id === payload.new.id ? { ...m, ...payload.new } : m
   ));

3. For INSERT events only: debounced loadMeetingHistory()
   const now = Date.now();
   if (now - lastRefreshRef.current < DEBOUNCE_MS) return;
   lastRefreshRef.current = now;
   loadMeetingHistory();
```

### Task 5 — Pagination

```text
Add .limit(50) to the main meetings query (line 5478):
  .order('created_at', { ascending: false })
  .limit(50)

The total word count query (Task 1) remains unbounded since it's 
a lightweight numeric-only query.
```

## Expected Outcome

| Metric | Before | After |
|--------|--------|-------|
| Rows fetched per reload | ~43,500+ | ~300 |
| Data transferred per reload | ~5-10 MB (transcript blobs) | ~50 KB (metadata only) |
| Reloads per processing run | 12-20 | 2-3 |
| Peak queries per second | 40-80 | 5-10 |

## Implementation Order

1. Task 1 (word_count column) — biggest single impact
2. Task 3 (remove duplicate fetch) — quick win
3. Task 4 (debounce subscriptions) — stops cascading reloads
4. Task 2 (chunk count aggregation) — reduces row scanning
5. Task 5 (pagination) — future-proofs growth

