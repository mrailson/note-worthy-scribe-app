

## Problem

The **Context / Discussion / Agreed / Implication** sub-headings render correctly in Word document exports (handled by `generateProfessionalMeetingDocx.ts`), but the meeting notes modal displays them as plain bold text because neither of the two rendering paths in the modal have specific handlers for this pattern.

Two rendering functions need updating:

1. **`basicFormat`** in `SafeModeNotesModal.tsx` (line ~2512) — used for the standard notes view
2. **`InteractiveNotesContent.tsx`** — used for the interactive/editable notes view

---

## Plan

### 1. Add sub-heading handler to `basicFormat` in `SafeModeNotesModal.tsx`

In the `for` loop (around line 2566), add a new handler **before** the bullet match check (line ~2630) that detects lines matching `**Context:**`, `**Discussion:**`, `**Agreed:**`, `**Implication:**` patterns.

The handler will:
- Match the regex: `/^\s*[-•]?\s*\*{1,2}(Context|Discussion|Agreed|Implication|Meeting Purpose)[:\s]*\*{0,2}\\?\*?\s*(.*)$/i`
- Render a styled `<div>` with a bold coloured label (`text-blue-600` for most, `text-red-600 font-bold` for Agreed) followed by the body text
- Add left indentation (`pl-4`) to nest under the numbered topic heading
- Add extra top margin before "Context" (start of a new topic block)

### 2. Add sub-heading line type to `InteractiveNotesContent.tsx`

- Add a new `ParsedLine` type value: `'subheading'`
- In the parsing loop (line ~50), add detection before the bullet match for the same regex pattern
- Store the label and body text, and render with the same blue/red label styling
- In `reconstructContent`, preserve the original markdown format (`**Label:** text`)

### 3. Clean escaped asterisks

In `applyInlineFormatting` in both files, add `.replace(/\\\*/g, '')` to strip escaped asterisks that leak from AI output.

---

## Styling Details

- **Context / Discussion / Implication labels**: `text-blue-600 font-semibold` 
- **Agreed label**: `text-red-600 font-bold` (matches the Word doc red treatment)
- **Body text after Agreed**: also bold to match Word doc emphasis
- **Indentation**: `pl-4` or `ml-4` to visually nest under topic headings
- **Spacing**: extra top margin before "Context" lines to separate topic blocks

### Files to change
- `src/components/SafeModeNotesModal.tsx` — `basicFormat` function only
- `src/components/meeting-notes/InteractiveNotesContent.tsx` — parser and renderer

