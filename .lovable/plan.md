

## Fix: Add timing instrumentation to notes generation pipeline

### Problem
The "Render Times" row shows consolidation badges (Merge, Repair, Speakers) correctly because the `consolidate-meeting-chunks` edge function saves timing to `merge_decision_log.timing`. However, the **Notes Generation** and **QC Audit** badges never appear because the `auto-generate-meeting-notes` edge function does not measure or save any timing data to `generation_metadata.timing`.

The screenshot confirms: only consolidation badges render (Merge 0.0s, Repair 1.0s, Speakers 0.0s, Total 1.1s). Notes and QC badges are absent.

### Plan

**1. Add timing instrumentation to `auto-generate-meeting-notes/index.ts`**

Wrap the two key stages with `Date.now()` calls:

- **Notes generation**: Time the LLM call block (lines ~1519–1622) — from before the fetch to after `generatedNotes` is populated
- **QC audit**: Time the QC block (lines ~1693–1835) — from before the Haiku call to after `qcResult` is set
- **Total pipeline**: From just before notes generation starts to after QC completes

Then add a `timing` object to the `generationMetadata` at line ~1847:

```typescript
const generationMetadata = {
  // ...existing fields...
  timing: {
    notes_generation_seconds: notesGenDuration / 1000,
    qc_audit_seconds: qcDuration / 1000,
    total_pipeline_seconds: totalDuration / 1000,
  },
};
```

**2. Redeploy the edge function**

The `ProcessingTimeBadges` component already handles these fields — once the data exists in `generation_metadata.timing`, the Notes and QC badges will render automatically.

### Technical detail

Three `Date.now()` markers needed:
- `notesGenStart` before the model selection block (~line 1519)
- `notesGenEnd` / `qcStart` after post-processing completes (~line 1692)  
- `qcEnd` after the QC try/catch block (~line 1835)

Computed durations stored as seconds with 2 decimal places, matching the consolidation timing format.

### Files to modify
- `supabase/functions/auto-generate-meeting-notes/index.ts` — add 3 timestamps and a timing object

