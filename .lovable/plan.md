

## Problem Analysis

The token floor increase to 3000 helped but didn't fully resolve truncation because **Part 3 must generate 5 complete sections** (7-11) including a KPI table and references list within just 3000 output tokens. That's roughly 2,200 words — tight for 5 sections with markdown tables. The other truncations (6.3, section 9) suggest some steps are also borderline.

### Root causes by issue:

| Issue | Cause |
|-------|-------|
| Section 10 (Appendices) missing | Part 3 runs out of tokens generating sections 7-9, never reaches 10 |
| Section 6.3 truncated | Part 2b has 3000 tokens for one section but the compact prompt doesn't strongly enough instruct brevity for subsections |
| Section 9 references cut off | Part 3 token ceiling hit mid-reference list |
| Version History blank | `enforceSection11ExactTable` runs in `finalise` and correctly appends — but the uploaded doc was likely exported before the fix was deployed, OR the regex isn't matching. Need to verify. |

## Plan

### 1. Split Part 3 into two steps to prevent token exhaustion

Currently Part 3 generates sections 7-11 in one call with 3000 tokens (compact). Split into:
- **Part 3a**: Sections 7-8 (Related Policies + Monitoring/KPIs) — `scaleTokens(4000)` → compact gets 3000
- **Part 3b**: Sections 9-11 (References, Appendices, Version History) — `scaleTokens(3500)` → compact gets 3000

This doubles the available token budget for the final sections. Update the step chain: `generate_part_3` becomes `generate_part_3a`, a new `generate_part_3b` step is added, and the finalise/enhance routing adjusts accordingly.

### 2. Raise Part 2b base tokens

Change Part 2b base from `3000` to `4000` so compact gets `max(3000, 1400)` = 3000 — actually this is already 3000 so the issue is prompt quality. Add explicit anti-truncation instruction to Part 2b prompt: "You MUST complete ALL subsections of section 6 including 6.3 and any further subsections. Finish every sentence."

### 3. Add anti-truncation instructions to all step prompts

Append to every part's user prompt (not just the length instruction): "IMPORTANT: Complete every subsection. Never end mid-sentence. If space is limited, shorten content rather than omitting subsections."

### 4. Update step labels and progress tracking

Add `generate_part_3a` and `generate_part_3b` to:
- The edge function step routing
- `STEP_LABELS` in `usePolicyJobs.ts` (update labels to show "part 4/5" and "part 5/5")
- Progress percentages adjusted for 5 generation steps

### 5. Verify Version History enforcement

The `enforceSection11ExactTable` function already handles this correctly — it either replaces the Section 11 heading content or appends a new Section 11 block. Since `finalise` always runs `sanitisePolicyOutput`, this should work. However, adding a log line to confirm it fires will help debugging.

### Files to change

1. **`supabase/functions/generate-policy/index.ts`**:
   - Split `PART3_SYSTEM_ADDITION` into `PART3A_SYSTEM_ADDITION` (sections 7-8) and `PART3B_SYSTEM_ADDITION` (sections 9-11)
   - Add new `generate_part_3a` step (replaces current `generate_part_3`)
   - Add new `generate_part_3b` step with its own prompt and token budget
   - Update step routing: `part_2b → part_3a → part_3b → enhance/finalise`
   - Add anti-truncation instruction to Part 2b user prompt
   - Deploy the updated function

2. **`src/hooks/usePolicyJobs.ts`**:
   - Add `generate_part_3a` and `generate_part_3b` to `STEP_LABELS`
   - Update label text to reflect 5 generation steps

