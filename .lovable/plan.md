

## Plan: Fix Compact Length & Add Generation Metadata to Cards

### Problem 1: Compact policies are ~40 pages instead of ~8

**Root cause**: `max_tokens` is a ceiling, not a target. The model generates content up to the limit. With compact getting 4000+ tokens per step (total ~21,000 tokens across 5 steps), the model has room for ~16,000 words — roughly 32-40 pages. The length instruction in the prompt is being ignored because the model has ample token budget to fill.

**Fix**: Replace the universal `scaleTokens()` approach with a **compact-specific per-step token map** that hard-caps each step to a much lower budget:

```text
Step         Base    Current Compact    New Compact
Part 1       5200    4000               1800
Part 2a     10000    5000               2500
Part 2b      4000    4000               1500
Part 3a      4000    4000               1200
Part 3b      5000    4000               1500
─────────────────────────────────────────────────
TOTAL                21000              8500 (~6400 words ≈ 8-10 pages)
```

The concise/standard/full tiers continue using `scaleTokens()` as before.

### Problem 2: No generation time or type shown on completed policy cards

**Fix**:
- In the `finalise` step, calculate duration from `job.created_at` to now and save `generation_duration_seconds` and `policy_length` into the completion's metadata object
- In the completed policy card UI, display two new badges: the length type (e.g. "Compact") and the generation duration (e.g. "Generated in 2m 15s")

### Files to change

1. **`supabase/functions/generate-policy/index.ts`**:
   - Add `COMPACT_TOKEN_MAP` object with per-step limits
   - Update each generation step to use the map when `policyLength === 'compact'`
   - In the `finalise` step, calculate and store `generation_duration_seconds` and `policy_length` in the completion metadata
   - Deploy

2. **`src/pages/PolicyServiceMyPolicies.tsx`**:
   - In the completed policy card (around line 573), add badges showing the policy length type and generation duration from completion metadata

