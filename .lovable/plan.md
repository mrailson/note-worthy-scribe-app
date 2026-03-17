

## Plan: Fix Pseudo Logo and Garbled Text in Ask AI Infographics

### Problem
1. **Pseudo logo (e.g. "NRES")**: The `useContentInfographic` hook injects the practice name directly into the prompt text (`Include the practice name "NRES" in the title or header area`), causing the AI to render it as a fake logo graphic. The Meeting Manager avoids this by passing `practiceContext` as a structured field to the edge function, which uses `buildBrandingSection()` to handle branding properly.
2. **Nonsensical/garbled words**: The Ask AI infographic prompt lacks the critical text length rules that the Meeting Manager has (max 20 words per sentence, bullet points 8-12 words, headings 3-6 words). Long text causes Gemini to render garbled characters.
3. **`logoUrl` ignored**: The hook accepts `logoUrl` in options but never sends it to the edge function.

### Fix — Single file: `src/hooks/useContentInfographic.ts`

**A. Remove inline practice name injection** (lines 155-158)
- Delete the `practiceNameBlock` that embeds practice name directly in the prompt text.

**B. Pass `practiceContext` as a structured body field** (matching Meeting Manager pattern)
- Build a `practiceCtx` object with `brandingLevel`, `practiceName`, `logoUrl`, `includeLogo`, `logoPlacement` — identical to `useMeetingInfographic.ts` lines 383-394.
- Send it as `practiceContext` in the edge function body, letting `buildBrandingSection()` handle it correctly.

**C. Add text length rules to the prompt** (from Meeting Manager)
- Add these critical requirements:
  - `CRITICAL TEXT LENGTH RULE: Every text block must be SHORT. Maximum 20 words per sentence. Maximum 2 sentences per section.`
  - `Use bullet points with 8-12 words each rather than full paragraphs`
  - `Headings should be 3-6 words maximum`
  - `Never render a sentence longer than 20 words`
  - `NEVER duplicate a section`
  - The spelling/language rules block from Meeting Manager
  - The "never render prompt instructions" safeguard

**D. Pass `documentContent` as a separate body field**
- Currently the content is embedded in the prompt. Send it as a separate `documentContent` field (like Meeting Manager does), keeping the prompt focused on design instructions.

### Result
The edge function's existing `buildBrandingSection()` will handle practice name and logo placement correctly (with proper "leave empty space" instructions instead of rendering text), and the text length constraints will prevent garbled output.

