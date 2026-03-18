

## Consolidate Sidebar Cards into One

### What changes

Merge the three separate cards (Placement Mode, Signatory Positions, Custom Text) into a single card. Remove the "AI Suggest Positions" button. Make the placement mode a toggle/slider instead of two separate buttons. Make the Custom Text section collapsible and collapsed by default.

### File: `src/components/document-approval/SignaturePositionPicker.tsx`

1. **Remove the first `<Card>` (Placement Mode, lines ~458–489)** and the second `<Card>` (Signatory Positions, lines ~492–673)** and the third `<Card>` (Custom Text, lines ~676–751)** — replace with a single `<Card>` containing all three sections.

2. **Replace the two mode buttons with a Switch/toggle slider** — use the existing shadcn Switch component. Label: "Placement Mode" with "Block" on one side and "Separated" on the other.

3. **Remove the "AI Suggest Positions" button** (lines ~495–510) and the `handleSuggestPositions` function (lines ~402–444) plus the `suggestingPositions` state and `Sparkles`/`Loader2` imports if unused elsewhere.

4. **Wrap Custom Text section in a Collapsible** (using the existing `Collapsible` component) — collapsed by default. Use a simple collapsible header "Custom Text" with a chevron toggle.

5. **Layout inside the single card**:
   - Section 1: Placement Mode toggle (Switch + labels)
   - Divider
   - Section 2: Signatory Positions (existing content, minus AI button)
   - Divider
   - Section 3: Custom Text (collapsible, default closed)

### Imports to add/remove
- Add: `Switch` from `@/components/ui/switch`, `Collapsible`, `CollapsibleContent`, `CollapsibleTrigger` from `@/components/ui/collapsible`, `ChevronDown`/`ChevronUp` from lucide
- Remove: `Sparkles`, `Loader2` (if not used elsewhere in file)

