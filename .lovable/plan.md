
# Improve AI Response Formatting: Horizontal Rules and Spacing

## Problem
When the AI returns content with `---` (markdown horizontal rules), they appear as literal dashes text instead of clean visual dividers. Additionally, the spacing between sections feels cramped, making the content harder to scan.

## What Will Change
1. **Horizontal rules (`---`)** will render as subtle, professional dividers instead of literal dashes
2. **Section spacing** will be increased so content breathes better between headings and paragraphs
3. The overall reading experience will feel more like a well-formatted document

## Technical Details

### File: `src/lib/nhsMarkdownRenderer.ts`

**1. Add horizontal rule conversion**
- Insert a new regex rule before the paragraph processing (around line 204) to convert `---`, `***`, and `___` patterns into styled `<hr>` elements
- Style: a subtle border with generous vertical margin (`my-6`) to create clear section breaks
- Must be processed **before** bold/italic rules to avoid conflicts with `***`

**2. Improve section spacing**
- Increase paragraph bottom margin from `mb-3` to `mb-4` for better breathing room
- Increase header top margins slightly (e.g. H2 from `mt-5` to `mt-6`, H3 from `mt-4` to `mt-5`) to create clearer visual separation between sections

**3. Add `hr` to DOMPurify allowed tags**
- The sanitiser currently strips any tags not in the allow list — `hr` needs to be added to `ALLOWED_TAGS` on line 276

### Summary of Changes
- Single file edit: `src/lib/nhsMarkdownRenderer.ts`
- Add horizontal rule regex before paragraph processing
- Adjust spacing classes on paragraphs and headers
- Add `hr` to the DOMPurify allow list
