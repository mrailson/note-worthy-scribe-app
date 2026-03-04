

## Plan: Switch Policy Generator to Claude Sonnet 4.6

### Changes Required

**1. `supabase/functions/generate-policy/index.ts`** — Replace Gemini with Claude
- **Line 196 (update path)**: Change model from `google/gemini-3-flash-preview` to call the Anthropic API directly using `claude-sonnet-4-6`
- **Line 376 (new path)**: Same change for the update generation type
- This means switching from Lovable AI Gateway to the Anthropic API (same pattern as the enhance-policy Claude branch)
- Both the "update" call (line 189–202) and the "new policy" call (line 369–382) need updating

**2. `supabase/functions/enhance-policy/index.ts`** — Update Claude model string
- **Line 384**: Change `claude-sonnet-4-20250514` → `claude-sonnet-4-6`
- **Line 413**: Change `modelUsed` from `claude-sonnet-4-20250514` → `claude-sonnet-4-6`

**3. `src/components/admin/PolicyEnhancementModelSettings.tsx`** — Update display name
- **Line 82**: Update model name label from `Claude Sonnet 4` to `Claude Sonnet 4.6` for clarity

### Technical Detail

The generate-policy function currently uses the Lovable AI Gateway with Gemini. Switching to Claude requires using the Anthropic API directly (with `ANTHROPIC_API_KEY`), matching the pattern already used in the enhance-policy Claude branch. The request/response format differs: Anthropic uses `system` as a top-level field and returns `data.content[0].text` rather than `data.choices[0].message.content`.

Both edge functions will be redeployed after changes.

