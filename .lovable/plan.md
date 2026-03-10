

# Plan: Click-to-Place Signature Blocks per Signatory

## Problem
Currently, all signature blocks are pre-placed on the document and visible at once. For long documents this clutters the view and makes it hard to position each signer individually.

## New Behaviour
1. **No auto-placed blocks** — remove the `useEffect` that initialises default positions for all signatories
2. **Select-then-click workflow** — user scrolls to the desired location, selects a signatory name from the panel, then clicks on the PDF page to place that signer's block
3. **Only the selected signatory's block is visible** — other signatories' blocks are hidden (shown as a subtle label only, or not rendered at all)
4. **Already-placed signatories show a green tick** in the selector panel; unplaced ones show "Click to place"
5. **Blocks remain draggable** once placed — but only when that signatory is active

## Changes in `SignaturePositionPicker.tsx`

### A. Remove auto-initialisation
Delete the `useEffect` at lines 85–99 that creates default positions for every signatory on mount.

### B. Click-to-place on PDF pages
Add an `onClick` handler to each page container:
- If an `activeSignatoryId` is selected AND that signatory has no position yet, clicking the page places a block at the click coordinates
- If the signatory already has a position, clicking does nothing (they drag instead)

### C. Filter visible overlays
Change the overlay rendering (lines 485–521) so that only the `activeSignatoryId`'s block is shown on the page. Other signatories' blocks are hidden entirely while scrolling/reading.

### D. Update signatory selector panel
- Unplaced signatories: show "Click on document to place" hint when selected
- Placed signatories: show green check + page number
- Active/selected signatory gets highlighted border as now

### E. Status text update
Replace the bottom info line with contextual guidance:
- No signatory selected: "Select a signatory above, then click on the document to place their signature"
- Signatory selected, not placed: "Click anywhere on the document to place [Name]'s signature block"
- Signatory selected, already placed: "[Name]: page X — drag to reposition"

## Files Modified
- `src/components/document-approval/SignaturePositionPicker.tsx` — all changes above

