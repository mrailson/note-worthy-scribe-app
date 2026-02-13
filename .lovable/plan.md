

# Fix Legacy File Processing and Add Evidence Detail Modal

## Two Changes

### 1. Fix Legacy .doc/.xls/.ppt File Processing

Currently, when a `.doc`, `.xls`, or `.ppt` file is uploaded, the edge function returns a static message: "Content preview not available for legacy format." Instead, we'll send these files to the Gemini vision API (same as PDFs and images) since Gemini can read binary Office formats when passed as base64 data.

**File:** `supabase/functions/analyse-evidence-file/index.ts`

- For `.doc` files (line 417-418): Instead of returning the static message, send the file via `aiVisionAnalyse()` with the correct MIME type — the same approach used for PDFs
- For `.xls` files (line 432-434): Same treatment
- For `.ppt` files (line 443-445): Same treatment
- This means all legacy Office formats will get proper AI summaries just like their modern counterparts

### 2. Add Expand/Detail Icon on Each Evidence Item

Add an "info" or "expand" icon button on each evidence file row that opens a fullscreen dialog showing comprehensive details.

**File:** `src/components/InvestigationEvidence.tsx`

- Add a new state for the detail modal (selected file)
- Add an `Expand` icon button (using the lucide `Maximize2` or `Info` icon) in the action buttons row for each evidence item
- When clicked, open a fullscreen `Dialog` showing:
  - File name and type badge
  - Full AI summary (rendered with proper formatting, not truncated)
  - File metadata: size, upload date/time, evidence type
  - For audio files: transcript text (if available), duration, confidence score
  - Audio review badges (if available)
  - Action buttons at the bottom: Download, Delete, Re-analyse

This replaces the current `HoverCard` approach (which requires hovering and is limited in size) with a proper fullscreen modal for deep inspection.

## Technical Details

### Edge Function Changes (analyse-evidence-file)

Replace the three "legacy format" fallback lines with vision API calls:

```
// .doc -> send to vision API
case "doc":
  summary = await aiVisionAnalyse(base64Data, mimeType || "application/msword", fileName, evidenceType, LOVABLE_API_KEY);

// .xls -> send to vision API  
case "xls":
  summary = await aiVisionAnalyse(base64Data, mimeType || "application/vnd.ms-excel", fileName, evidenceType, LOVABLE_API_KEY);

// .ppt -> send to vision API
case "ppt":
  summary = await aiVisionAnalyse(base64Data, mimeType || "application/vnd.ms-powerpoint", fileName, evidenceType, LOVABLE_API_KEY);
```

### Detail Modal UI

- Fullscreen dialog (max-w-3xl) with scroll area
- Header: file icon, file name, evidence type badge
- Body: full AI summary with whitespace preserved, metadata grid
- For audio: embedded transcript section with confidence and duration
- Footer: Download and Delete action buttons
- The existing HoverCard remains for quick glance; the modal provides the deep view
