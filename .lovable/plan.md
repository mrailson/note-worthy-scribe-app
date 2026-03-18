

## Rearrange Sidebar Card for Drag-Drop Efficiency

Reorder the sections inside the single `<Card>` so the interactive drag-and-drop elements (signatory buttons, field buttons, help text) are at the **bottom** — closest to the document preview. Less-used controls move to the top.

### New order inside the Card

1. **Placement Mode** toggle (Stamp ↔ Separated) — compact, rarely changed
2. **Custom Text** (collapsible, default closed) — rarely used
3. **Font size slider** (separated mode only) — set once
4. **Separator**
5. **Signatory Positions** + field buttons + help text — at the bottom, right next to the document

### File: `src/components/document-approval/SignaturePositionPicker.tsx`

- Move the Custom Text `<Collapsible>` block (lines ~598–685) up to sit right after the Placement Mode toggle section
- Move the font size slider (lines ~560–573) out of the signatory positions section and place it between Custom Text and the signatory list
- Keep the Signatory Positions section (signatory buttons, field buttons, help text) as the **last** section in the card — no separator after it

This puts the most-used interactive elements flush against the bottom of the card, minimising mouse travel to the document preview below.

