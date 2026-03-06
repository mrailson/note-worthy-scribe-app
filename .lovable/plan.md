

## Investigation Results

### Issue 1: Missing Sections 7-10

**Root cause identified.** The multi-step generation pipeline works correctly — logs confirm all 5 steps complete successfully for Gemini 2.5 Flash (part_1 through part_3b, producing 54,166 chars including sections 7-10). The problem occurs **after generation**, during the `enhance` and `gap_check` steps.

`gemini-2.5-flash` is **not** in the `budgetModels` list (line 1423), which currently only includes legacy model IDs:
```
['claude-haiku-4-5', 'gpt-4o-mini', 'gemini-2.0-flash', 'gemini-2.0-flash-thinking-exp']
```

This means Gemini 2.5 Flash policies go through both the `enhance` step and `gap_check` remediation step. Both steps pass the **entire 54K-char document** to the LLM and ask it to return a complete rewritten version — but with only 16,384 max_tokens. Gemini 2.5 Flash truncates its output, dropping sections 7-10 and jumping straight to Version History (which is then re-enforced by `enforceSection11ExactTable`).

**Fix:** Add `gemini-2.5-flash` and `gemini-2.5-pro` to the `budgetModels` list so they skip the destructive enhance/gap_check rewrite steps and go directly to `finalise`.

### Issue 2: Concise Mode for Gemini

A Gemini-specific concise writing instruction will be injected into the system prompt only when the selected model starts with `gemini-`. This targets prose style (no padding, prefer lists, direct sentences) without reducing section coverage.

---

## Plan

### File: `supabase/functions/generate-policy/index.ts`

**Change 1 — Fix budgetModels list (line ~1423)**

Add `gemini-2.5-flash` and `gemini-2.5-pro` to the array so Gemini models skip the enhance and gap_check steps that truncate their output:

```typescript
const budgetModels = [
  'claude-haiku-4-5', 'gpt-4o-mini',
  'gemini-2.0-flash', 'gemini-2.0-flash-thinking-exp',
  'gemini-2.5-flash', 'gemini-2.5-pro',
];
```

**Change 2 — Add Gemini concise mode instruction (after line ~1055)**

Create a conditional concise-mode instruction block that is appended to the system prompt only for Gemini models:

```typescript
const geminiConciseInstruction = generationModel.startsWith('gemini-')
  ? `\n\nGEMINI CONCISE MODE:
- Write in direct, professional NHS policy style — no padding, repetition, or filler phrases.
- Each procedural point should be one clear sentence unless clinical detail requires more.
- Prefer structured bullet lists over paragraphs where appropriate.
- Target 6,000–8,000 words for a full-length policy. Do NOT inflate to 12,000+.
- Do NOT omit any required sections or subsections — brevity applies to prose style, not content coverage.`
  : '';
```

Then append `geminiConciseInstruction` alongside `lengthInstruction` in each step's `callAnthropic` system prompt argument (all 5 generation steps, lines ~1088, 1158, 1233, 1308, 1384):

```typescript
BASE_SYSTEM_PROMPT + lengthInstruction + geminiConciseInstruction + PART1_SYSTEM_ADDITION
```

**Redeploy** the edge function after both changes.

