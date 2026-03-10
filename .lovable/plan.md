

# Plan: Toggle Signatory Blocks & Investigate PDF Layout

## Issue 1: Toggle Signatory Blocks On/Off

Currently in `SignaturePositionPicker.tsx` (lines 351-357), clicking a signatory name always selects it. The fix is to add toggle logic:

**In the signatory button `onClick` handler:**
- If the clicked signatory is already active **and** has a placed position → remove their position from `value` (via `onChange`) and deselect them
- If clicked again (now unplaced and inactive) → re-select them so they can be placed again
- This gives a click-to-toggle cycle: select → place → click name to remove → click name to re-select → place again

**File:** `src/components/document-approval/SignaturePositionPicker.tsx` — update the `onClick` in the signatory buttons (lines 352-357)

## Issue 2: PDF Layout / Tables

The PDF viewer uses `pdfjs-dist` canvas rendering, which renders PDF pages pixel-perfectly — tables, fonts, and all formatting are preserved exactly as they appear in the original PDF file.

If the document was originally uploaded as a **DOCX**, it would have been converted to PDF during upload using the mammoth-to-jsPDF converter. That conversion process may strip table borders and complex formatting. This is a conversion-time issue, not a rendering issue.

**No changes needed to the PDF viewer itself** — the canvas rendering is correct. If you're seeing missing tables, the source PDF likely doesn't contain them (check by opening the PDF directly).

## Summary of Changes

| File | Change |
|------|--------|
| `SignaturePositionPicker.tsx` | Toggle logic: clicking active signatory with a placed block removes it; clicking again re-selects for placement |

