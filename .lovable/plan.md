

## Show All Placed Signatures with Ghost Blocks

**Problem**: When positioning a signatory's signature block, you can only see that one block. Other signatories' placed blocks are invisible, making it easy to overlap them.

**Solution**: Render all placed signature blocks on every page, not just the active one. Non-active blocks render at 25% opacity as "ghost" indicators, while the active block remains fully visible and draggable.

### Changes

**File: `src/components/document-approval/SignaturePositionPicker.tsx`** (lines 510-547)

Replace the current rendering logic that only shows the active signatory's block with a loop over **all** signatories. For each signatory with a placed position on the current page:

- **Active signatory**: Render as-is (full opacity, draggable, ring highlight, `cursor-move`)
- **Inactive signatories**: Render with `opacity: 0.25`, `pointerEvents: 'none'`, no ring/outline, and a dashed border -- visible enough to avoid overlap but clearly non-interactive

The ghost blocks use the same colour coding so you can tell which signatory each belongs to.

