

# Fix: Inconsistent PowerPoint Slide Layouts (Tiny Text and Excessive Spacing)

## Root Cause

Two issues in `supabase/functions/generate-powerpoint-gamma/index.ts` are causing Gamma to produce slides with tiny, cramped text on some slides while others look fine:

### 1. Overly Restrictive Font Instructions (Line 237)
The font instruction explicitly tells Gamma: `"Use Calibri or Arial fonts only -- do not use Inter or any non-standard fonts"`. Project memory confirms this exact approach previously "resulted in unreadably small font sizes and was subsequently rolled back" -- but the code still contains it. When Gamma tries to force all content into Calibri/Arial at its default sizing, complex slides (tables, multi-column layouts, icon grids like slide 11) end up with tiny text to fit the constrained font metrics.

### 2. Stock Image URL Injection Overloads the Prompt (Lines 287-319)
When `useStockLibraryImages` is enabled (which meeting PowerPoints always set to `true`), the code injects **15 markdown image references** directly into `inputText`. This bloats the prompt content significantly. On slides where Gamma tries to render both these image references AND dense content (e.g. the ICB Reporting Requirements slide with 6 content blocks + 9 logos), it compresses the text to fit everything, resulting in tiny fonts and awkward spacing.

## Fix

### Change 1: Soften Font Instructions
In `supabase/functions/generate-powerpoint-gamma/index.ts`, replace the restrictive font-banning instruction with a softer preference that doesn't force Gamma into layout compromises:

- **Line 237**: Change the default from `'Use Calibri or Arial fonts only -- do not use Inter or any non-standard fonts'` to `'Prefer standard Office fonts such as Calibri or Arial'`
- **Lines 231-236**: Soften the fontMap entries similarly (e.g. `'Prefer Calibri or Arial'` instead of `'Use Calibri or Arial fonts only'`)

### Change 2: Limit Stock Image Injection
Reduce the number of stock images injected from 15 to 5, and add an instruction telling Gamma to use a maximum of one image per slide rather than trying to cram multiple images onto a single slide:

- **Line 297**: Change `.limit(15)` to `.limit(5)`
- **Line 308**: Add a note in the injected text: `"Use at most one image per slide. Select the most relevant image for each slide's topic."`

### Change 3: Add Minimum Font Size Instruction
Add a layout quality instruction to `additionalInstructions` to prevent Gamma from shrinking text:

- After line 211 (data integrity), add: `"LAYOUT: Body text must be at least 16pt. Headings at least 24pt. Never shrink text to fit more content -- split across slides instead."`

## Technical Details

| File | Line(s) | Change |
|------|---------|--------|
| `supabase/functions/generate-powerpoint-gamma/index.ts` | 231-237 | Soften font instructions from "only" to "prefer" |
| `supabase/functions/generate-powerpoint-gamma/index.ts` | 297 | Reduce stock image limit from 15 to 5 |
| `supabase/functions/generate-powerpoint-gamma/index.ts` | 308 | Add "one image per slide" instruction |
| `supabase/functions/generate-powerpoint-gamma/index.ts` | ~212 | Add minimum font size instruction |

All changes are in a single edge function file. Redeploy required after editing.

