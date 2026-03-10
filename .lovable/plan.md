

# Plan: Embed PDF Viewer in Public Approval Page

## Overview
Replace the current "Download Document" button on the signer's public approval page (`/approve/:token`) with an inline PDF viewer matching the one built in `SignaturePositionPicker`. The signer can read the full document with zoom, page navigation, and scrolling — then click a "Go to Signature" button to jump to the approval form.

## Layout Change

Current layout: Document info card → Download button → Approval form (narrow `max-w-2xl`)

New layout (wider `max-w-5xl`):
1. **Header bar**: Document title, sender info, sent date — compact single row
2. **PDF Viewer**: Full-width, tall (`70vh`), all pages rendered vertically with A4 styling, grey background, shadows. Toolbar with zoom controls (+/-), page indicator, and a prominent **"Go to Signature Block"** button
3. **Approval form**: Same fields (name, role, org, checkboxes, approve/decline) — anchored below the viewer with an `id` for smooth scroll targeting

## Technical Approach

### File: `src/pages/PublicApproval.tsx`

1. **Widen the page shell** from `max-w-2xl` to `max-w-5xl` for the main approval form view
2. **Add inline PDF viewer** using `pdfjs-dist` (already installed) — reuse the same rendering pattern from `SignaturePositionPicker`:
   - Fetch PDF via public URL (`document.file_url`) as ArrayBuffer
   - Render all pages as canvases stacked vertically inside a scrollable container
   - IntersectionObserver for current page detection
   - Zoom controls (50%–200%) in a toolbar
   - Page indicator showing "Page X of Y"
3. **"Go to Signature Block" button** in the toolbar — smooth-scrolls to `#approval-form` anchor below the viewer
4. **Remove** the old "View Document" button that opens a new window
5. Keep the form compact below the viewer — add `id="approval-form"` to the form card

### No new files needed
All changes are contained within `PublicApproval.tsx`, reusing the same `pdfjs-dist` rendering approach already in the codebase. The viewer is self-contained (no signature overlays needed here — it's read-only for the signer).

