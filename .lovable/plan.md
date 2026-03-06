

## Analysis

I've parsed the uploaded document (27 pages for "compact" mode — far exceeding the ~8 page target) and read the full edge function code. Here are the root causes:

### Issue-by-Issue Diagnosis

| Issue | Root Cause |
|-------|-----------|
| Section 5.2.1 truncated | Part 2a generates sections 4-5 with `scaleTokens(8000)` → compact gets 3000 tokens. Section 5 for clinical policies is enormous — 3000 tokens is exhausted before 5.2.1 completes |
| Section 6.3.3 truncated | Part 2b generates section 6 with `scaleTokens(4000)` → compact gets 3000 tokens. Training section for cervical screening is very detailed — runs out mid-6.3 |
| Section 9 references cut off | Part 3b generates sections 9-11 with `scaleTokens(3500)` → compact gets 3000. References list exhausts budget before reaching section 10 |
| Section 10 absent | Same as above — Part 3b runs out of tokens during section 9, never reaches 10 |
| Version History blank | **Bug in regex**: `enforceSection11ExactTable` requires "11" before "VERSION HISTORY" in the heading. Part 3b generates `# VERSION HISTORY` without "11", so the regex doesn't match. The function appends a new block at the end, but the original empty heading remains in place and the DOCX may not render the appended block correctly |
| Placeholder names (Malcy Balky/Kiddy/Talky) | These come from the user's **practice profile data** — the `safeguarding_lead_adults`, `safeguarding_lead_children`, and `siro` fields contain these test names. This is a data issue, not a code issue |

### The Fundamental Problem

The model ignores the compact brevity instruction and generates full-length content, then hits the token ceiling and truncates. The 3000-token floor is insufficient for content-heavy steps. Two fixes needed:
1. Raise token budgets so content completes even when the model is verbose
2. Fix the version history regex bug

## Plan

### 1. Raise token budgets (edge function)

Increase the minimum token floor from 3000 to **4000** and raise the compact scale from 0.35 to **0.5**:

| Step | Base | Current compact | New compact (×0.5, min 4000) |
|------|------|-----------------|------------------------------|
| Part 1 (sections 1-3) | 5200 | 3000 | 4000 |
| Part 2a (sections 4-5) | 8000 | 3000 | 4000 |
| Part 2b (section 6) | 4000 | 3000 | 4000 |
| Part 3a (sections 7-8) | 4000 | 3000 | 4000 |
| Part 3b (sections 9-11) | 3500 | 3000 | 4000 |

Additionally, raise Part 2a base to **10000** and Part 3b base to **5000** to give extra headroom for content-heavy sections.

### 2. Fix version history regex (edge function)

Update `enforceSection11ExactTable` to also match headings that don't include "11", such as `# VERSION HISTORY` or `## VERSION HISTORY`. Change the regex to:

```
/(?:^|\n)((?:#{1,6}\s*)?(?:(?:Section\s*)?11[.:]?\s*(?:[-–—]\s*)?)?VERSION\s*HISTORY[^\n]*)/i
```

This makes the "11" part optional while still matching all existing patterns.

### 3. Strengthen compact prompt brevity (edge function)

Update the compact length instruction to be more prescriptive: "Each subsection should be 2-4 sentences. Tables should have 3-5 rows maximum. Reference lists should contain the 10-15 most critical references only."

### 4. Placeholder names — user action needed

The names "Malcy Balky", "Malcy Kiddy", and "Malcy Talky" are stored in the practice profile database. The user needs to update their practice details (Safeguarding Lead Adults, Safeguarding Lead Children, and SIRO fields) with real staff names. This cannot be fixed in code.

### Files to change

1. **`supabase/functions/generate-policy/index.ts`**:
   - Line 874: Change compact scale from 0.35 to 0.5
   - Line 876: Change min floor from 3000 to 4000
   - Line 880: Strengthen compact length instruction with explicit brevity constraints
   - Lines 498-500: Fix version history heading regex to make "11" optional
   - Line 993: Raise Part 2a base from 8000 to 10000
   - Line 1219: Raise Part 3b base from 3500 to 5000
   - Deploy updated function

2. **No client-side changes needed** — `usePolicyJobs.ts` step labels are already correct from the previous update.

