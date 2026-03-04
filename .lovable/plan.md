

## Investigation Report: Inconsistent Policy Formatting

### Evidence

I examined all saved policies (from user cd649038/Bugbrooke Medical Practice — the only user with saved policies). Every policy has a **different** document header format:

| Policy | Header Format |
|--------|--------------|
| Asbestos Management | Bold key-value pairs on separate lines (`**Practice:** ... **ODS Code:** ...`) |
| Confidentiality | Markdown table for document control (`\| **Document Title** \| ... \|`) |
| DNACPR | Two-column markdown table (`\| **Version** \| 1.0 \|`) |
| End of Life Care | ALL-CAPS title, two-column table |
| Patient Consent | Mixed bold key-value with `---` separator |
| Accident & Incident | Bullet-point list for document control (`- **Practice Name:** ...`) |
| Safeguarding Children | Bold key-value pairs + version history table |

### Root Cause

The problem is a **two-model pipeline** with conflicting format instructions:

1. **`generate-policy`** (Gemini Flash) has a system prompt with a strict structure template (sections 1–11, version history table at the end). However, the **document header / document control** format is not explicitly specified — it just says `===METADATA===` then `===POLICY_CONTENT===`. The AI is left to decide how to present the header block each time.

2. **`enhance-policy`** (Claude/Gemini/OpenAI — configurable) receives the generated policy and rewrites it. Its system prompt says "Return the enhanced policy as a complete, ready-to-use document" but gives **no format template for the header or document control section**. Each model interprets "document control" differently every time.

The result is that the first model generates inconsistent headers, and the second model makes them even more inconsistent by reformatting freely.

### Proposed Fix

**Add an explicit, mandatory document header template** to both system prompts so every policy starts with an identical structure.

#### Step 1: Update `generate-policy` system prompt

Add a concrete document header template immediately after `===POLICY_CONTENT===` in the FORMAT REQUIREMENTS section:

```text
# [POLICY TITLE IN TITLE CASE]

**Practice:** [Practice Name]
**ODS Code:** [ODS Code]

---

## Document Control

| Field | Detail |
|-------|--------|
| **Version** | 1.0 |
| **Effective Date** | [DD/MM/YYYY] |
| **Review Date** | [DD/MM/YYYY] |
| **Author** | [Practice Manager name], Practice Manager |
| **Approved By** | [Lead GP name], Lead GP |

---

## Equality Impact Assessment Statement
This policy has been assessed to ensure it does not discriminate...

---

## 1. Purpose
...
```

This gives the AI an exact layout to follow every time.

#### Step 2: Update `enhance-policy` system prompt

Add to the OUTPUT FORMAT section:

```text
CRITICAL FORMAT RULE: You MUST preserve the exact document header structure 
from the input policy. Do NOT restructure, reformat, or rearrange the 
Document Control table, header fields, or section ordering. Only enhance 
the content within existing sections and add missing sections at the end.
```

This prevents the enhancement step from reformatting the standardised header.

#### Step 3: Move Version History to fixed position

The current `generate-policy` prompt puts Version History at section 11 (end). Standardise this and ensure the enhance step doesn't move it.

### Files to modify
- `supabase/functions/generate-policy/index.ts` — update `systemPrompt` with explicit header template
- `supabase/functions/enhance-policy/index.ts` — add format preservation rule to `POLICY_ENHANCEMENT_SYSTEM_PROMPT`

### No database changes required.

