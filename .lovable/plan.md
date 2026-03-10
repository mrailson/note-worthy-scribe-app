

# Plan: Redesign Signature Placement Flow & PDF Viewer

## Problem Summary
1. The PDF viewer in "Position Signature Block" is basic — needs to match the quality of Document Studio's preview (A4 page feel, smooth scrolling, zoom)
2. Signature block positioning happens BEFORE signatories are added — it should come AFTER so each signer can have their block placed individually
3. No per-signatory placement — currently one shared rectangle for all signatures

## Proposed Changes

### 1. Reorder the Flow Steps
**File: `CreateApprovalFlow.tsx`**

Change step order from:
`upload → stamp_position → signatories → review`
to:
`upload → signatories → stamp_position → review`

- After uploading with "stamp" method selected, skip directly to signatories
- After signatories are confirmed, THEN show stamp_position step
- Pass signatory names into the picker so each can be placed individually

### 2. Rebuild `SignaturePositionPicker` as a Professional PDF Viewer

**File: `SignaturePositionPicker.tsx`** (rewrite)

Inspired by the Document Studio preview style:
- **A4-styled page rendering**: White pages with subtle shadow on a grey background, matching DocumentPreviewModal's aesthetic
- **Smooth scrollable viewport**: All pages rendered vertically in a scrollable container (not one-page-at-a-time like current), with scroll-to-page navigation
- **Toolbar**: Page indicator, zoom controls (+/- and slider), fit-to-width toggle
- **Page thumbnails sidebar** (optional, for multi-page docs): Small clickable thumbnails on the left that scroll the main view

### 3. Per-Signatory Signature Placement

**File: `SignaturePositionPicker.tsx`**

- Accept `signatories: { id: string; name: string }[]` prop
- Show a **signatory selector panel** (list of signer names with coloured indicators)
- User clicks a signatory name → that signer becomes "active" → drag to place their signature block on the PDF
- Each block is colour-coded and labelled with the signer's name
- Blocks are individually draggable and repositionable
- Output: `Record<string, StampPosition>` (keyed by signatory ID)

### 4. AI-Suggested Placement

**File: `SignaturePositionPicker.tsx`** + edge function call

- Add a "Suggest Positions" button that:
  1. Sends the PDF text + signatory names to an edge function
  2. The AI reads the document, finds where each person's name appears (e.g. signature lines, "Signed by:" sections)
  3. Returns suggested page + coordinates for each signatory
  4. Auto-places the blocks with a toast: "AI suggested positions — adjust if needed"
- Uses existing Lovable AI gateway via a new edge function `suggest-signature-positions`

### 5. Update Data Flow

**File: `CreateApprovalFlow.tsx`**

- `stampPosition` changes from single `StampPosition` to `Record<string, StampPosition>` (per-signatory)
- `updateSignaturePlacement` call updated to save per-signatory positions
- Review step shows each signatory's placement summary

### Technical Details

**Step order change** in `CreateApprovalFlow.tsx`:
- `handleUploadAndContinue`: When stamp method, go to `signatories` (not `stamp_position`)
- `handleContinueToReview`: Renamed/repurposed — after signatories saved, go to `stamp_position`
- New `handleStampDone`: From stamp_position → review

**New StampPosition type**:
```typescript
export interface PerSignatoryPositions {
  [signatoryId: string]: StampPosition;
}
```

**PDF viewer rendering**: Render all pages as canvases stacked vertically inside a ScrollArea, with IntersectionObserver to detect current visible page for the page indicator.

**AI suggestion edge function** (`suggest-signature-positions`):
- Input: extracted PDF text + signatory names
- Prompt: "Given this document text and these signatory names, suggest page number and approximate position (as percentage) for each signature"
- Output: `{ positions: { name: string, page: number, x: number, y: number }[] }`

### Files to Create/Modify
1. **Modify**: `src/components/document-approval/SignaturePositionPicker.tsx` — full rewrite with per-signatory placement, better PDF viewer
2. **Modify**: `src/components/document-approval/CreateApprovalFlow.tsx` — reorder steps, update data types
3. **Create**: `supabase/functions/suggest-signature-positions/index.ts` — AI placement suggestions
4. **Modify**: `src/hooks/useDocumentApproval.ts` — update `updateSignaturePlacement` for per-signatory data

