

## Plan: Add AI Edit & Quick Pick Adjustment Options to Document Preview Modal

### What We're Building
Adding an "AI Edit" feature to the `DocumentPreviewModal` that allows users to refine the generated document via:
1. **Typed instructions** — a text input for custom edit requests
2. **Voice input** — microphone button for dictating instructions
3. **Quick Pick flyout** — a popover with the top 10 most common adjustment options

### Quick Pick Options (Top 10)
1. Make it longer
2. Make it shorter
3. Add more detail
4. Remove all names
5. Simplify the language
6. Make it more formal
7. Make it more empathetic
8. Add bullet points
9. Remove jargon
10. Summarise key points

### UI Design
- Add an **"AI Edit"** button (with Brain icon) to the bottom action bar of `DocumentPreviewModal`, next to Word/PDF buttons
- Clicking opens a **popover/sheet** with:
  - Quick Pick chips (10 pre-set options) — clicking one auto-fills the instruction field
  - A textarea for typed instructions
  - A voice input button (using existing `AssemblyAISpeechToText` component)
  - A "Regenerate" submit button
- The regenerated content replaces the current preview content in-place

### Technical Approach

**1. New component: `src/components/shared/DocumentAIEditPanel.tsx`**
- Renders as a collapsible panel or popover within the modal
- Contains: quick pick chips, textarea, voice input button, submit button
- Props: `content`, `title`, `onContentUpdated`, `isProcessing`

**2. Modify `DocumentPreviewModal.tsx`**
- Add state: `showAIEdit`, `isAIEditing`, `editableContent` (to allow in-place content updates)
- Add "AI Edit" button to the bottom action bar
- When AI edit completes, update the displayed content with the new version
- Pass an `onContentUpdated` callback so parent components (like `StepGenerate`) can sync state

**3. New/reuse edge function for document refinement**
- Reuse the existing `generate-document-studio` edge function with a new action `refine_document`
- Send: current content, user instructions, document title
- Returns: refined content

**4. Props update for `DocumentPreviewModal`**
- Add optional `onContentUpdated?: (newContent: string) => void` prop
- `StepGenerate` passes a callback to update `state.generatedContent`

### File Changes
| File | Change |
|------|--------|
| `src/components/shared/DocumentAIEditPanel.tsx` | **New** — Quick pick chips, textarea, voice input, submit |
| `src/components/shared/DocumentPreviewModal.tsx` | Add AI Edit button, state management, content update flow |
| `src/components/DocumentStudio/StepGenerate.tsx` | Pass `onContentUpdated` callback to modal |
| `supabase/functions/generate-document-studio/index.ts` | Add `refine_document` action handler |

