

## Problem

**Part 2 (`generate_part_2`) is allocated only 5,200 max tokens** to produce sections 4, 5, and 6. For clinical policies like Cervical Screening, Section 5 (Policy Statement/Procedure) is extremely content-dense — covering screening pathways, colposcopy referrals, HPV triage, etc. The model exhausts its token budget mid-sentence in section 5.5.2(c) and never reaches Section 6 (Training Requirements).

Part 1 (header + sections 1–3) and Part 3 (sections 7–11) are less content-heavy, so the same 5,200 limit works fine for them.

## Solution

Split Part 2 into two separate steps — `generate_part_2a` (sections 4–5) and `generate_part_2b` (section 6) — and increase the token budget for the heavy clinical content step.

### Changes to `supabase/functions/generate-policy/index.ts`

1. **Add `PART2A_SYSTEM_ADDITION` prompt** — instructs the model to generate sections 4 and 5 only, with explicit instruction to complete all sub-sections including colposcopy referral pathways.

2. **Add `PART2B_SYSTEM_ADDITION` prompt** — instructs the model to generate section 6 (Training Requirements) only, given sections 1–5 as context.

3. **Increase token budget for Part 2a to 8,000** — matches Part 3's budget. Section 5 for clinical policies routinely needs 6,000+ tokens.

4. **Part 2b gets 3,000 tokens** — Training section is structured but not huge.

5. **Update step flow**: `generate_part_1` → `generate_part_2a` → `generate_part_2b` → `generate_part_3` → `enhance` → `finalise`

6. **Update metadata keys**: Store `partial_sections_1_5` after part 2a, then `partial_sections_1_6` after part 2b.

7. **Update progress percentages**: Part 1 = 15%, Part 2a = 35%, Part 2b = 50%, Part 3 = 65%, Enhance = 80%, Finalise = 100%.

### Changes to `src/hooks/usePolicyJobs.ts`

- Add labels for new steps: `generate_part_2a` → "Generating (part 2/4)", `generate_part_2b` → "Generating (part 3/4)", renumber part 3 to "part 4/4".

### Changes to `src/pages/PolicyServiceMyPolicies.tsx`

- Update any step label rendering to handle the new step names.

### Recovery

- Existing jobs on `generate_part_2` will be handled by adding a fallback: if `current_step === 'generate_part_2'`, treat it as `generate_part_2a`.

