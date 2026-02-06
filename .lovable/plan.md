

# Post-Merge Deduplication + "Best of All (3)" Canonical Transcript

## Summary

Three deliverables integrated across the full pipeline:

1. **New utility** -- `src/utils/postMergeDedup.ts`: deterministic four-step dedup algorithm (normalise, compare nearby, apply rules, safety guards)
2. **Integration** -- Wire `postMergeDedup()` into both client-side `BestOfBothMerger.ts` and server-side `consolidate-meeting-chunks`, plus upgrade the merger to accept 3 engines (Batch + AssemblyAI + Deepgram)
3. **New UI tab + downstream defaults** -- "Best of All (3)" in SafeMode transcript panel, plus update Ask AI, notes generation, and exports to prefer the canonical transcript

## Critical Clarifications Addressed

| Clarification | Resolution |
|---|---|
| Is merge truly 3-engine? | **No, currently 2-engine only.** The `Engine` type is `'assembly' \| 'whisper'` and `consolidate-meeting-chunks` only queries `meeting_transcription_chunks`. Deepgram data lives in a separate `deepgram_transcriptions` table and is never fed to the merger. This plan upgrades the merger to 3 engines by adding `'deepgram'` to the Engine type and fetching Deepgram chunks into the merge pipeline. |
| DB constraint values | Current constraint is `('whisper','assembly','consolidated')`. Plan adds `'deepgram'` and `'best_of_all'` -- full set: `('whisper','assembly','deepgram','consolidated','best_of_all')` |
| When to set `best_of_all` source | Only when `dedupTranscript` is non-empty AND at least 2 sources contributed chunks. Otherwise keep prior `primary_transcript_source` value but still store `best_of_all_transcript` if generated. |
| Downstream defaults | `meeting-qa-chat`, `auto-generate-meeting-notes`, and the UI's `handleRegenerateFromTranscript` / `saveNotesTranscriptSource` all updated to prefer `best_of_all_transcript` when it exists. |

## Database Changes

Migration SQL:

```sql
-- Add columns for canonical transcript and audit log
ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS best_of_all_transcript text,
  ADD COLUMN IF NOT EXISTS merge_decision_log jsonb;

-- Update CHECK constraint to include deepgram and best_of_all
ALTER TABLE public.meetings
  DROP CONSTRAINT IF EXISTS meetings_primary_transcript_source_check;

ALTER TABLE public.meetings
  ADD CONSTRAINT meetings_primary_transcript_source_check
  CHECK (primary_transcript_source IS NULL OR primary_transcript_source = ANY(
    ARRAY['whisper','assembly','deepgram','consolidated','best_of_all']
  ));
```

## File 1: `src/utils/postMergeDedup.ts` (New, ~280 lines)

Self-contained, no external dependencies. Exports `postMergeDedup()` plus types (`DedupDecision`, `PostMergeDedupResult`).

### Algorithm

**Step 0 -- Normalise** (comparison only; output preserves original):
- Lowercase, collapse whitespace, strip punctuation (keep letters/digits)
- Mask numbers with `<NUM>` for similarity (prevents "same sentence, different number" being treated as different)
- Tokenise on spaces
- Store per segment: `raw`, `normTokens`, `normString`

**Step 1 -- Nearby comparison:**
- Compare `S[i]` to `S[i-1]` (previous kept) and `S[i-2]` (A-B-A detection)

**Step 2 -- Two deterministic tests:**
- Token Jaccard: `J = |intersection| / |union|`
- Substring containment: `C = max(len(a)/len(b) if a in b, len(b)/len(a) if b in a)`

**Step 3 -- Drop rules (checked in order):**

| Rule | Condition | Action | Code |
|---|---|---|---|
| 1 | `(J >= 0.82 AND min(tokenCount) >= 12)` OR `C >= 0.90` | Drop S[i] | `DUP_NEAR_EXACT` |
| 2 | Last N tokens of S[i-1] == first N tokens of S[i], N from 20 down to 8 | Trim N tokens from start of S[i] | `DUP_BOUNDARY_OVERLAP` |
| 3 | `J(S[i], S[i-2]) >= 0.82 AND tokenCount >= 12` | Drop S[i] | `DUP_ABA_REPEAT` |

**Step 4 -- Safety guards:**
Before any DROP, check if newer segment contains critical tokens absent from previous kept:
- Digits (`999`, `15`, `58`, `3.5`)
- Medication patterns (`mg`, `mcg`, `ml`, `od`, `bd`, `tds`, `prn`, `qds`)
- Pathway keywords (`2ww`, `urgent`, `cardiology`, `ecg`, `troponin`, `chest pain pathway`)
- Safeguarding phrases (`harm`, `suicide`, `999`, `a&e`, `emergency`, `ambulance`, `safeguarding`)

If new critical tokens exist: block DROP, prefer Rule 2 trim instead. Log `DEDUP_BLOCKED_CRITICAL_NEW_INFO`.

**Returns:** `{ segments: string[], decisions: DedupDecision[], stats: { inputCount, outputCount, dropped, trimmed, blockedByGuard } }`

## File 2: `src/utils/BestOfBothMerger.ts` (Modify)

### Changes

1. **Extend `Engine` type** from `'assembly' | 'whisper'` to `'assembly' | 'whisper' | 'deepgram'`

2. **Update `normaliseConfidence`** -- add `if (engine === 'deepgram')` branch: use provided confidence (Deepgram reports real confidence values), default to 0.75 if missing

3. **Update `chooseWinner`** -- generalise the engine-preference logic:
   - Currently hardcoded as assembly-first vs whisper
   - Change to: rank engines by tier (assembly = tier 1, deepgram = tier 1, whisper = tier 2)
   - Within same tier: use score
   - Cross-tier: lower-tier engine needs `strongConfMargin` to override higher-tier
   - This ensures Deepgram is treated as a peer to AssemblyAI (both are live engines), and batch (whisper) can still override when meaningfully better

4. **Extend `MergeResult.stats`** with dedup fields:
   ```
   deepgramChunks: number
   dedupInputCount: number
   dedupOutputCount: number
   dedupDropped: number
   dedupTrimmed: number
   dedupBlockedByGuard: number
   ```

5. **Add `dedupDecisions` field** to `MergeResult`

6. **Rename `mergeBestOfBoth` to `mergeBestOfAll`** (keep `mergeBestOfBoth` as a wrapper that calls `mergeBestOfAll` with empty deepgram array, for backwards compatibility)

7. **New function signature:**
   ```
   mergeBestOfAll(
     whisperRaw: RawChunk[],
     assemblyRaw: RawChunk[],
     deepgramRaw: RawChunk[],
     cfg: MergeConfig
   ): MergeResult
   ```

8. **Integrate dedup** after line 359 (sort kept) and **before** `postProcessTranscript`:
   ```
   const dedupResult = postMergeDedup(kept.map(k => k.text));
   const transcript = postProcessTranscript(dedupResult.segments.join(' '));
   ```
   Key: dedup runs on raw segment text **before** sentence reflow.

9. **Update `dbChunksToRawChunks`** to recognise `source === 'deepgram'` and route to a `deepgram` array in the return value.

## File 3: `supabase/functions/consolidate-meeting-chunks/index.ts` (Modify)

### Changes

1. **Update `Engine` type** to include `'deepgram'`

2. **Update `normaliseConfidence`** for deepgram engine

3. **Update `chooseWinner`** with same tier-based logic as client-side

4. **Rename `mergeBestOfBoth` to `mergeBestOfAll`** internally (accept 3 arrays)

5. **Fetch Deepgram chunks** from `deepgram_transcriptions` table:
   ```
   const { data: deepgramChunks } = await supabase
     .from('deepgram_transcriptions')
     .select('chunk_number, transcription_text, confidence, is_final')
     .eq('meeting_id', meetingId)
     .eq('is_final', true)
     .order('chunk_number');
   ```
   Map to `RawChunk[]` with `engine: 'deepgram'`.

6. **Inline `postMergeDedup` algorithm** (Deno cannot import from `src/`). ~200 lines of pure logic placed before the merge function.

7. **Call dedup** after merge, before best-transcript comparison:
   ```
   const dedupResult = postMergeDedup(mergeResult.kept.map(k => k.text));
   const dedupTranscript = postProcessTranscript(dedupResult.segments.join(' '));
   mergeResult.transcript = dedupTranscript;
   ```

8. **Update `updatePayload`:**
   ```
   best_of_all_transcript: dedupTranscript,
   merge_decision_log: {
     decisions: dedupResult.decisions,
     stats: dedupResult.stats,
     mergeStats: mergeResult.stats,
     generatedAt: new Date().toISOString()
   }
   ```
   Only set `primary_transcript_source: 'best_of_all'` when `dedupTranscript` is non-empty AND at least 2 distinct engine types contributed kept segments. Otherwise keep prior value.

9. **Build Deepgram-only transcript** for the Deepgram tab (same pattern as existing assembly-only and whisper-only transcript builders at lines 560-584).

10. **Include dedup stats** in the JSON response.

## File 4: `supabase/functions/meeting-qa-chat/index.ts` (Modify)

### Changes

1. **Add `best_of_all_transcript`** to the select query (line 87):
   ```
   .select('id, title, assembly_transcript_text, whisper_transcript_text, best_of_all_transcript, primary_transcript_source, ...')
   ```

2. **Update transcript selection** (lines 101-104):
   ```
   const transcript = meeting.best_of_all_transcript
     || (meeting.primary_transcript_source === 'assembly'
       ? meeting.assembly_transcript_text
       : meeting.whisper_transcript_text || meeting.assembly_transcript_text);
   ```
   Best of All is always preferred when it exists.

## File 5: `supabase/functions/auto-generate-meeting-notes/index.ts` (Modify)

### Changes

1. **Add `'best_of_all'` as a recognised `transcriptSource` value**

2. **Add new branch** before the existing `consolidated` check (line 254):
   ```
   if (transcriptSource === 'best_of_all') {
     const { data: meetingTranscript } = await supabase
       .from('meetings')
       .select('best_of_all_transcript')
       .eq('id', meetingId)
       .single();

     fullTranscript = meetingTranscript?.best_of_all_transcript || '';
     actualTranscriptSource = 'best_of_all';

     // Fallback to consolidated if best_of_all is empty
     if (!fullTranscript.trim()) {
       // fall through to consolidated logic
     }
   }
   ```

3. **Update auto mode** (the `else` block at ~line 393) to check `best_of_all_transcript` first before calling the RPC.

## File 6: `src/components/SafeModeNotesModal.tsx` (Modify)

### State changes

1. Add `bestOfAllTranscript` state:
   ```
   const [bestOfAllTranscript, setBestOfAllTranscript] = useState('');
   ```

2. Update `transcriptSubTab` type:
   ```
   const [transcriptSubTab, setTranscriptSubTab] = useState<'batch' | 'live' | 'deepgram' | 'best_of_all'>('batch');
   ```

3. Update `notesTranscriptSource` type:
   ```
   const [notesTranscriptSource, setNotesTranscriptSource] = useState<'batch' | 'live' | 'consolidated' | 'best_of_all'>('batch');
   ```

### Data loading (`loadTranscript`, ~line 990)

Add `best_of_all_transcript` to the select query:
```
.select('live_transcript_text, whisper_transcript_text, assembly_transcript_text, best_of_all_transcript')
```
Set `setBestOfAllTranscript(meetingData?.best_of_all_transcript || '')`.

### Auto-source selection (~line 1136)

Update priority order:
```
Best of All (if available) --> Consolidated --> Batch --> Live
```
If `bestOfAllTranscript` is non-empty, auto-select `'best_of_all'` as the notes source and set the transcript sub-tab to `'best_of_all'`.

### `saveNotesTranscriptSource` (~line 280)

Add mapping for `'best_of_all'`:
```
const dbSource = source === 'best_of_all' ? 'best_of_all'
  : source === 'batch' ? 'whisper'
  : source === 'live' ? 'assembly'
  : 'consolidated';
```

### `handleRegenerateFromTranscript` (~line 301)

Add `best_of_all` mapping:
```
transcriptSource: notesTranscriptSource === 'best_of_all'
  ? 'best_of_all'
  : notesTranscriptSource === 'consolidated'
    ? 'consolidated'
    : ...
```

Update the regeneration overlay label (~line 3987) to include `'Best of All (3)'`.

### Transcript sub-tabs UI (~line 3717)

Add a "Best of All (3)" tab button after the Deepgram button, styled with a gradient when active. Includes:
- Word count badge
- Copy button
- Tooltip: "Merged from AssemblyAI, Deepgram and batch transcription with deterministic de-duplication"

### Notes source selector (~line 3859)

Add a "Best of All" option after the existing "Best of Both" button. Disabled when `bestOfAllTranscript` is empty. Tooltip explains it is the canonical transcript.

### Transcript content rendering (~line 4099)

Add a `best_of_all` view block (after the Deepgram view, before the closing `</>` at line 4100):
- Read-only (no inline editing)
- Info banner: "Merged from AssemblyAI, Deepgram and batch transcription with deterministic de-duplication. This is the canonical transcript used for notes, Ask AI, and exports."
- Supports both plain and formatted view modes
- Empty state with explanation when not available

### Find & Replace panel (~line 3934)

Update `getCurrentText` to handle `best_of_all` sub-tab (read-only, so no `onApply` needed -- or disable Find & Replace when this tab is active since it is read-only).

### Export content (~line 1232)

When `activeTab === 'notes'`, the export uses `notesContent` (unchanged). When `activeTab === 'transcript'`, update to prefer `bestOfAllTranscript` when the Best of All tab is selected.

## Files Summary

### Create

| File | Purpose |
|---|---|
| `src/utils/postMergeDedup.ts` | Deterministic post-merge dedup with normalisation, 3 rules, safety guards, decision logging |

### Modify

| File | Change |
|---|---|
| `src/utils/BestOfBothMerger.ts` | Add `deepgram` engine, rename to `mergeBestOfAll` (keep `mergeBestOfBoth` wrapper), integrate dedup, persist stats |
| `supabase/functions/consolidate-meeting-chunks/index.ts` | Fetch Deepgram chunks, 3-engine merge, inline dedup, persist `best_of_all_transcript` + `merge_decision_log`, conditional `primary_transcript_source` |
| `supabase/functions/meeting-qa-chat/index.ts` | Prefer `best_of_all_transcript` for Ask AI context |
| `supabase/functions/auto-generate-meeting-notes/index.ts` | Add `best_of_all` transcript source branch, update auto mode to check it first |
| `src/components/SafeModeNotesModal.tsx` | New state, load `best_of_all_transcript`, new tab, updated auto-selection, updated notes source selector, downstream defaults |

### Database Migration

Add `best_of_all_transcript` (text), `merge_decision_log` (jsonb), update `primary_transcript_source` CHECK constraint to include `'deepgram'` and `'best_of_all'`.

## Pipeline After Implementation

```text
Raw engines:
  Batch (OpenAI gpt-4o-transcribe)
  Live (AssemblyAI)
  Live (Deepgram Nova-3)
      |
      v
  3-engine winner selection (mergeBestOfAll)
      |
      v
  Post-merge deterministic dedup (postMergeDedup)
  -- Rule 1: near-exact (Jaccard >= 0.82 or containment >= 0.90)
  -- Rule 2: boundary overlap trim (8-20 tokens)
  -- Rule 3: A-B-A repeat
  -- Safety guard: critical token protection
      |
      v
  Persist:
  -- best_of_all_transcript (canonical)
  -- merge_decision_log (audit: decisions + stats)
  -- primary_transcript_source = 'best_of_all' (when multi-source)
      |
      v
  "Best of All (3)" tab (read-only, canonical)
      |
      v
  Notes generation / Ask AI / PDF & Word exports
  (all default to best_of_all_transcript when available)
```

## Implementation Order

1. Database migration (add columns, update constraint)
2. Create `src/utils/postMergeDedup.ts`
3. Update `src/utils/BestOfBothMerger.ts` (3-engine support + dedup integration)
4. Update `supabase/functions/consolidate-meeting-chunks/index.ts` (Deepgram fetch, 3-engine merge, inlined dedup, persist canonical)
5. Update `supabase/functions/meeting-qa-chat/index.ts` (prefer best_of_all)
6. Update `supabase/functions/auto-generate-meeting-notes/index.ts` (best_of_all source branch)
7. Update `src/components/SafeModeNotesModal.tsx` (new tab, state, auto-selection, downstream defaults)
8. Deploy edge functions and test

