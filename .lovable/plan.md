

## Plan: Apply Quick Guide Spelling & Content Quality Learnings to Infographic Generation

### Context

The Quick Guide pipeline (`analyse-policy-gaps`) has accumulated several battle-tested content quality fixes:
1. **Duplicate word removal** — regex strip of consecutive repeated words
2. **Practice name injection** — ensuring practice identity appears
3. **Vague placeholder standardisation** — replacing ambiguous contact placeholders
4. **Staff name corruption hardening** — detecting names used as verbs and replacing with `[CONTACT]`
5. **User name corrections** — a Supabase-backed dictionary of user-defined spelling corrections (`UserNameCorrections.ts`)

The infographic pipeline has its own `SPELLING_REFERENCE` constant (a prompt-level word list), but none of the post-generation validation or the user's custom corrections dictionary are applied.

### What needs to change

**Important constraint:** Infographics are *images*, not text. We cannot regex-replace words inside a rendered PNG. The fixes must therefore be applied **to the prompt before generation**, not post-generation. This is fundamentally different from the Quick Guide pipeline where we fix text output.

### Changes

#### 1. Enhance the prompt with user name corrections (client-side — `useContentInfographic.ts`)

Before calling the edge function, load the user's custom name corrections from Supabase and append them to the prompt as a "MANDATORY SPELLING" block. This mirrors what `SPELLING_REFERENCE` does but with the user's own dictionary.

- Import `userNameCorrections` from `@/utils/UserNameCorrections`
- Call `loadCorrections()` if not already loaded
- Build a corrections block like: `"- Always spell 'Spaull' (NOT Spall/Spawl)"` for each entry
- Append to the `imagePrompt` string before sending to the edge function
- Also apply `applyCorrections()` to the `documentContent` string so the source text itself is already corrected before the AI sees it

#### 2. Apply duplicate word removal to prompt content (client-side — `useContentInfographic.ts`)

Run the same regex used in the Quick Guide pipeline on the `documentContent` before it's sent to the AI:

```typescript
documentContent = documentContent.replace(/\b(\w+)([,;.]?\s+)\1\b/gi, '$1$2');
```

This prevents the AI from seeing (and reproducing) duplicates in its source material.

#### 3. Inject practice name into the infographic prompt (client-side — `useContentInfographic.ts`)

- Accept an optional `practiceName` parameter in `ContentInfographicOptions`
- Fetch it from the practice profile if not provided (same pattern as `QuickGuideDialog`)
- Add to the prompt: `"This infographic is for [Practice Name]"` and `"Include the practice name '[Practice Name]' in the title or header area"`

#### 4. Pass corrections to the edge function for Image Studio requests (edge function — `ai4gp-image-generation/index.ts`)

- Accept an optional `spellingCorrections` field in the request body (array of `{incorrect, correct}`)
- If provided, build a dynamic spelling block and append it alongside `SPELLING_REFERENCE`
- This covers the Image Studio path (which calls the edge function directly with `isStudioRequest: true`)

#### 5. Apply corrections to the Ask AI bubble infographic path (`MessageRenderer.tsx`)

- When the user clicks "Create as Infographic", pass the practice name and load/pass spelling corrections to `ContentInfographicModal`
- Add `practiceName` and `spellingCorrections` props to `ContentInfographicModal` and `useContentInfographic`

### Files to modify

| File | Change |
|------|--------|
| `src/hooks/useContentInfographic.ts` | Add name corrections loading, duplicate word cleanup on source content, practice name injection |
| `src/components/ContentInfographicModal.tsx` | Accept and pass through `practiceName` and corrections |
| `src/components/MessageRenderer.tsx` | Load practice name and corrections, pass to infographic modal |
| `supabase/functions/ai4gp-image-generation/index.ts` | Accept `spellingCorrections` array, build dynamic spelling block for prompts |

### Safety considerations

- Corrections are **prompt-level only** — no risk of breaking rendered images
- The existing `SPELLING_REFERENCE` constant remains unchanged; user corrections are additive
- User corrections are loaded from Supabase (authenticated), not localStorage, so they're per-user and secure
- No regeneration loop needed (unlike Quick Guides) since we can't inspect text inside generated images

