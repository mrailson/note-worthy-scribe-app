

## Problem Diagnosis

The stored policy content for Nicola Draper's Cervical Screening policy contains **two** Section 11 blocks:

1. **AI-generated**: `## Section 11: Version History` — with generic "Practice Manager" author and basic formatting
2. **Deterministic override**: `11. VERSION HISTORY` — with correct "Nicola Draper" and ownership footer, appended at the end

The `enforceSection11ExactTable` function is supposed to find and **replace** the AI-generated Section 11. However, its regex:

```
/(?:^|\n)((?:#{1,6}\s*)?11\.?\s*VERSION\s*HISTORY[^\n]*)/i
```

Only matches patterns like `11. VERSION HISTORY` or `## 11. VERSION HISTORY`. It does **not** match the format the AI is actually outputting: `## Section 11: Version History` — because the word "Section" sits between "##" and "11", and there's a colon before "Version History".

Since the regex fails to match, the function falls through to the else branch and **appends** the correct block at the end — leaving the old, incorrect one in place. The result: a duplicate Section 11 where the first one has wrong data and the second has correct data.

Depending on how the preview renders or truncates, the user may see only the first (wrong) one, or it may appear confusing.

## Plan

### 1. Fix the heading regex in `enforceSection11ExactTable`

Update the regex on line 491 to also match:
- `## Section 11: Version History`
- `# Section 11 — Version History`
- `Section 11: Version History` (no markdown heading prefix)
- Any variant with "Section" before the number

New regex:
```
/(?:^|\n)((?:#{1,6}\s*)?(?:Section\s*)?11[.:]?\s*(?:[-–—]\s*)?VERSION\s*HISTORY[^\n]*)/i
```

### 2. Redeploy the `generate-policy` edge function

---

### Technical detail

**File**: `supabase/functions/generate-policy/index.ts`, line 491

Single regex change — the rest of the function logic (find heading, slice before, replace with deterministic block) remains unchanged and correct.

