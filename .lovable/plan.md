

## Root Cause: Enhance Step Destroys Full-Length Haiku Policies

The document confirms sections 6-10 are entirely missing. Here's exactly what happened:

1. **Parts 1 → 3b all succeeded** — the 5-step pipeline generated all 11 sections correctly
2. **The `enhance` step destroyed the document** — it sends the entire policy to the LLM and asks it to return the entire enhanced version, with `max_tokens: 10000`
3. **Claude Haiku 4.5 has a hard output limit of 8192 tokens** (~6000 words / ~12 pages). Even the 10000 ceiling in code gets silently capped to 8192 by the API
4. The LLM started writing the enhanced document from section 1, hit the 8192 token wall at section 5.4.4, and stopped
5. The truncated output (sections 1-5 only) **replaced** the complete original, destroying sections 6-10
6. The `finalise` step then appended section 11 (Version History), giving the final result: sections 1-5 → 11

The same risk exists for `gap_check` remediation (also 10000 max_tokens).

The `policyContent.length > 25000` skip condition (line 1316) was supposed to catch this, but the full Cervical Screening content was likely just under 25000 chars at the enhance step — close enough to slip through.

## Fix

**Skip enhance and gap_check for Haiku models entirely.** Haiku is the "budget" model chosen for speed and cost — enhance doubles the API calls, and Haiku's 8192 token output limit makes it physically impossible to return a full-length policy without truncation.

### Changes to `supabase/functions/generate-policy/index.ts`:

1. **In `generate_part_3b` step** (line 1267-1270): Add Haiku to the skip condition alongside compact:
   ```
   const skipEnhance = policyLength === 'compact' || generationModel === 'claude-haiku-4-5';
   ```

2. **As a safety net for Sonnet**, increase enhance max_tokens from `10000` to `16384` (line 1361 and 1467) to handle larger full-length documents without truncation.

3. **Lower the skip threshold** from `25000` to `18000` chars (line 1316) as an additional safeguard — if content is already 18000+ chars, the enhance LLM call risks truncation even with higher token limits.

### No client-side changes needed.

