

## Upload Evidence Overhaul: Drag-and-Drop with AI Analysis

### Overview
Replace the current basic file input on the "Upload Evidence" tab with a modern drag-and-drop zone (matching the patterns used elsewhere in Notewell, e.g. Ask AI, Meeting Context). Files will be uploaded to Supabase storage, analysed by AI to generate a brief description, and displayed in the Evidence Files list with rich metadata.

### Current State
- The Upload Evidence tab uses a simple `<input type="file">` (single file only)
- Requires the user to manually select an evidence type and optionally type a description
- No drag-and-drop, no paste, no multi-file support
- No AI analysis of uploaded content

### What Changes

#### 1. Database Migration
Add an `ai_summary` column to the `complaint_investigation_evidence` table to store AI-generated file descriptions separately from the user-entered description:

```sql
ALTER TABLE complaint_investigation_evidence 
ADD COLUMN ai_summary text;
```

#### 2. New Edge Function: `analyse-evidence-file`
A new Supabase Edge Function that:
- Accepts a file as base64 data along with its filename and MIME type
- Detects the file category (document, image, audio, email, archive)
- For documents (PDF, Word, Excel, PowerPoint, CSV, TXT): extracts text content using the same patterns as `extract-document-text` (JSZip for Office formats, Gemini for PDFs)
- For images: uses Gemini vision to describe the image content
- For audio files: returns a placeholder note (audio transcription is handled separately via the existing Transcribe button)
- For email files (.eml, .msg): extracts headers and body text
- For ZIP archives: lists the contained filenames
- Returns a structured response with:
  - `evidenceType`: auto-detected type (email, pdf, image, audio, document, spreadsheet, presentation, archive, other)
  - `summary`: a brief 1-2 sentence AI-generated description of the file contents
- Uses `LOVABLE_API_KEY` with `google/gemini-3-flash-preview` for AI analysis
- Handles 429/402 rate limit errors gracefully

#### 3. Redesigned Upload Evidence Tab (`InvestigationEvidence.tsx`)
Replace the current upload form with:

- **Drag-and-drop zone** using `react-dropzone` (same pattern as `SimpleFileUpload` and Ask AI)
  - Supports drag, drop, click-to-browse, and clipboard paste (Ctrl+V)
  - Up to **20 files** at once
  - Maximum **10MB per file**
  - Accepted types: PDF, Word (.doc/.docx), Excel (.xls/.xlsx), PowerPoint (.ppt/.pptx), Images (.jpg/.jpeg/.png/.gif/.webp/.bmp/.svg/.tiff/.tif), Audio (.mp3/.wav/.m4a/.ogg/.flac/.aac), Text (.txt/.csv/.rtf), Emails (.eml/.msg), ZIP archives (.zip)

- **Upload progress UI**: once files are dropped, show a list of files being processed with:
  - File name and size
  - A spinner/progress indicator per file
  - Status badges: "Uploading...", "Analysing...", "Complete", "Failed"

- **Processing pipeline per file**:
  1. Upload file to Supabase storage (`communication-files` bucket)
  2. Call `analyse-evidence-file` edge function with the file data
  3. Auto-detect evidence type from AI response
  4. Save to `complaint_investigation_evidence` with AI-generated description and auto-detected evidence type
  5. Update the evidence files list in real-time as each file completes

- **Remove** the manual evidence type selector and description fields for the initial upload (the AI handles this automatically)

#### 4. Enhanced Evidence Files Display
Update the Evidence Files tab to show richer metadata per file:
- File name (bold)
- Auto-detected evidence type badge (colour-coded)
- AI-generated summary/description (1-2 lines)
- File size and upload date/time
- Existing download, transcribe (for audio), and delete buttons remain

### File Changes

| File | Action | Purpose |
|------|--------|---------|
| `supabase/functions/analyse-evidence-file/index.ts` | Create | New edge function for AI file analysis |
| `supabase/config.toml` | Edit | Add `analyse-evidence-file` function entry |
| `src/components/InvestigationEvidence.tsx` | Edit | Replace upload tab with drag-and-drop + AI pipeline; enhance file list display |
| Database migration | Create | Add `ai_summary` column to `complaint_investigation_evidence` |

### Technical Details

**Edge Function Architecture:**
- The function receives base64-encoded file data (keeping file under 10MB means base64 stays under ~14MB, within Edge Function limits)
- For Office formats (Word, Excel, PowerPoint): uses JSZip for deterministic XML text extraction (no AI needed)
- For PDFs and images: uses Gemini 3 Flash via the Lovable AI Gateway for content extraction/description
- For text/CSV/RTF files: direct text decoding
- For emails (.eml): basic header/body parsing
- For ZIP files: lists archive contents via JSZip
- The AI then summarises the extracted content into a brief evidence description
- Handles rate limiting (429) and payment (402) errors with user-friendly messages

**Upload Flow:**
```text
User drops files
    |
    v
For each file (parallel, up to 5 concurrent):
    1. Upload to Supabase Storage
    2. Convert to base64, send to analyse-evidence-file
    3. Receive { evidenceType, summary }
    4. Insert into complaint_investigation_evidence
    5. Update UI with completed file
    |
    v
All files shown in Evidence Files tab with AI summaries
```

**Paste Support:**
- Listen for `paste` events on the dropzone
- Extract files from `clipboardData.items`
- Process the same as dropped files

**Concurrency:**
- Process up to 5 files concurrently to balance speed and server load
- Queue remaining files if more than 5 are dropped at once

