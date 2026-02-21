

# Presentation Studio: Pasted Text Support and Stock Library Image Toggle

## Overview
Two enhancements to Presentation Studio:
1. **Pasted Text Input** — A textarea on the Content tab where users can paste text directly (alongside or instead of uploaded documents) to feed into the presentation.
2. **Stock Library Images Toggle** — A switch on the Generate tab to use Notewell Stock Library images instead of Gamma's default AI-generated ones.

---

## Feature 1: Pasted Text Input

### What changes
- **ContentTab.tsx**: Add a new "Paste Content" textarea between the Supporting Documents section and Custom Instructions. It will have a label like "Paste Content (optional)" with helper text explaining users can paste meeting minutes, reports, or any text.
- **presentationStudio.ts (types)**: Add a `pastedContent: string` field to `PresentationStudioSettings`.
- **presentationStudio.ts (request)**: Add `pastedContent?: string` to `PresentationStudioRequest`.
- **usePresentationStudio.ts**: Include `pastedContent` in the default settings (empty string) and pass it through in the request payload. Update the `canGenerate` check to also allow generation when pasted content is present.
- **generate-powerpoint-gamma/index.ts**: Read `pastedContent` from the request body and append it to `supportingContent` alongside any uploaded file content.

### UI Design
- A collapsible or always-visible textarea (4-5 rows) with a clipboard icon
- Character count shown below (e.g. "1,234 characters")
- Placed after the document upload area, before Custom Instructions

---

## Feature 2: Stock Library Images Toggle

### What changes
- **presentationStudio.ts (types)**: Add `useStockLibraryImages: boolean` to `PresentationStudioSettings` (default `false`).
- **presentationStudio.ts (request)**: Add `useStockLibraryImages?: boolean` to `PresentationStudioRequest`.
- **usePresentationStudio.ts**: Include in default settings and pass through in the request. Persist the setting.
- **GenerateTab.tsx**: Add a toggle/switch in the Summary Panel area, labelled "Use Notewell Stock Library Images" with a description like "Replace Gamma's default images with images from the Notewell Stock Library".
- **generate-powerpoint-gamma/index.ts**: 
  - Read the `useStockLibraryImages` flag
  - When enabled: query the `stock_images` table for active images, select a relevant subset, and inject their public URLs into `inputText` as image references
  - Set `imageOptions.source` to `'noImages'` so Gamma uses only the provided URLs rather than generating its own
  - When disabled: keep the current `aiGenerated` behaviour

### How stock images are injected
Gamma's API supports image URLs embedded in `inputText`. When the toggle is on:
1. The edge function creates a Supabase client and queries `stock_images` for active images
2. It selects images matching the topic/category where possible (using simple keyword matching against tags)
3. It appends image URLs to the input text in Gamma's expected format
4. `imageOptions.source` is set to `'noImages'` to prevent Gamma from generating its own

---

## Technical Details

### Files to modify

| File | Change |
|------|--------|
| `src/types/presentationStudio.ts` | Add `pastedContent: string` and `useStockLibraryImages: boolean` to settings and request interfaces |
| `src/hooks/usePresentationStudio.ts` | Add defaults, pass through in request, persist `useStockLibraryImages`, update `canGenerate` logic |
| `src/components/ai4gp/presentation-studio/ContentTab.tsx` | Add pasted content textarea with character count |
| `src/components/ai4gp/presentation-studio/GenerateTab.tsx` | Add stock library images toggle switch in the summary panel |
| `supabase/functions/generate-powerpoint-gamma/index.ts` | Handle `pastedContent` and `useStockLibraryImages` in generation logic |

### Edge cases
- Pasted content combined with uploaded documents: both are merged into the supporting content
- If stock library has no images: fall back to Gamma's default AI-generated images and show a console warning
- The Gamma API `inputText` has a practical limit: stock image URLs will be limited to ~10-15 images to avoid exceeding it
