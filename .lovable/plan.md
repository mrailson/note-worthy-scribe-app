

## Plan: Increase Claude Token Limits to Prevent Truncation

### Problem
Both `generate-policy` and `enhance-policy` edge functions have `max_tokens: 8000`, which is insufficient for lengthy NHS policy documents. Sections like Training 7.2 and results tables in 6.6.2 are being cut off mid-content.

### Changes

**1. `supabase/functions/generate-policy/index.ts`**
- Line 213: Change `max_tokens: 8000` → `max_tokens: 16000`
- Line 383: Change `max_tokens: 8000` → `max_tokens: 16000`

**2. `supabase/functions/enhance-policy/index.ts`**
- Line 385: Change `max_tokens: 8000` → `max_tokens: 16000`

Claude Sonnet 4.6 supports up to 64K output tokens, so 16,000 gives ample room for complete policy documents without risk of truncation. Both functions will be redeployed.

