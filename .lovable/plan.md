

## Plan: Match Word Output to Screen Preview & Improve Spacing

### Problems

1. **`---` separators appear in Word but not on screen** — The preview's `renderPreviewContent` skips `---` lines, but the Word export's `parseMarkdownLine` in `cleanWordExport.ts` treats them as regular paragraphs, outputting them as text.

2. **`####` headings not handled in Word export** — The preview renders `####` as `<h4>`, but `cleanWordExport.ts` only handles `#`, `##`, `###`. Lines starting with `####` fall through to paragraph.

3. **Preview spacing too tight** — The content wrapper uses `space-y-1` (4px gap), making the preview feel squashed compared to the actual Word output.

### Changes

#### File: `src/utils/cleanWordExport.ts`

1. **Skip horizontal rules** — In the line processing loop (line 220), add a check before `parseMarkdownLine`: if the trimmed line matches `/^[-*_]{3,}$/`, skip it (continue) — identical to the preview logic.

2. **Add `####` heading support** — In `parseMarkdownLine`, add a check for `#### ` before the `### ` check, returning `{ type: 'heading3', content: ... }` (same visual tier as h3 in Word).

#### File: `src/components/shared/DocumentPreviewModal.tsx`

3. **Increase content spacing** — Change line 444 from `space-y-1` to `space-y-2` for better breathing room between elements.

4. **Increase paragraph bottom margin** — Change `mb-3` to `mb-4` on the paragraph renderer (line 200) for more spacing between paragraphs, matching the Word document's `spacing.after: 120`.

### Files to Modify
1. `src/utils/cleanWordExport.ts` — skip `---` lines, add `####` heading
2. `src/components/shared/DocumentPreviewModal.tsx` — increase spacing

