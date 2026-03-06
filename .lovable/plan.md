

## Problem Analysis

The compact policy length uses a scale of `0.2`, which means `max_tokens` for each generation step are:

| Step | Base tokens | Compact (×0.2) | Effective (min 1500) |
|------|------------|----------------|---------------------|
| Part 1 (sections 1-3) | 5200 | 1040 → **1500** | 1500 |
| Part 2a (sections 4-5) | 8000 | 1600 | **1600** |
| Part 2b (section 6) | 3000 | 600 → **1500** | 1500 |
| Part 3 (sections 7-11) | 7000 | 1400 → **1500** | 1500 |

**Root cause**: 1500-1600 tokens is far too few to generate complete sections. Even a compact policy needs ~800-1000 words per step, which is 1200-1500 tokens just for the text — leaving no room for markdown formatting, tables, headings, etc. The model hits the token ceiling and truncates mid-sentence, causing:

- Section 5.1 cut off mid-sentence (Part 2a only gets 1600 tokens for sections 4+5)
- Section 6.3 cut off (Part 2b gets 1500 tokens)  
- Sections 9-10 missing entirely (Part 3 gets 1500 tokens for 5 sections including tables)
- Version history table blank (no tokens left by the time it reaches section 11)

## Plan

### 1. Raise the minimum token floor and adjust compact scaling

Change the `scaleTokens` function to use a higher minimum (e.g. 3000) and raise the compact scale from 0.2 to 0.35. This gives each step enough room to produce complete, albeit shorter, content:

| Step | Base | Compact (×0.35, min 3000) |
|------|------|--------------------------|
| Part 1 | 5200 | 3000 |
| Part 2a | 8000 | 3000 |
| Part 2b | 3000 | 3000 |
| Part 3 | 7000 | 3000 |

Total: ~12,000 tokens for compact vs ~23,200 for full — still roughly a third the size, producing ~8-10 pages.

### 2. Strengthen compact prompts to prevent truncation

Add an explicit instruction to the length instruction for compact mode: "You MUST complete every section listed. Do not truncate mid-sentence. If running low on space, reduce detail rather than omitting sections."

### 3. Deploy the updated edge function

Single file change: `supabase/functions/generate-policy/index.ts` — update lines ~871-873 (scale values and minimum) and ~877 (compact label instruction).

