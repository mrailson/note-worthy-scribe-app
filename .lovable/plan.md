

## Plan: Enforce British English in Complaint Outcome Letter Generation

### Problem
The system prompt already includes "British English (spellings and grammar)" but the LLM occasionally produces American spellings (e.g., "minimize" instead of "minimise").

### Change
**File: `supabase/functions/generate-complaint-outcome-letter/index.ts`**

Strengthen the British English instruction in the system prompt (around line 322) by adding explicit examples and a stronger directive. Replace the single line with a more forceful, example-driven instruction:

```
- British English ONLY — this is mandatory. Use British spellings throughout (e.g., "minimise" not "minimize", "recognised" not "recognized", "centre" not "center", "behaviour" not "behavior", "colour" not "color", "organised" not "organized", "apologise" not "apologize", "specialised" not "specialized", "programme" not "program"). Any American English spelling is an error.
```

This will also require redeploying the edge function.

