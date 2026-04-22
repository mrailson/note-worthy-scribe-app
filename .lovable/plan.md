

## Reduce Hallucinations in Handwritten Complaint Letter Import

### Problem
When a practice manager uploads a photo of a handwritten complaint letter, the system uses GPT-4.1 Vision to OCR the text, then immediately auto-populates the complaint form. There are no safeguards specific to handwriting — no confidence scoring, no hallucination detection, and no human review step before the data is saved. Handwritten text is inherently ambiguous, so the AI frequently fabricates names, dates, and complaint details.

### Root Causes
1. **Single-pass OCR with no verification** — one GPT-4.1 Vision call extracts text, with a generic prompt ("extract all text accurately") that has no handwriting-specific guidance
2. **No preview step for images** — extracted data is immediately pushed into the form via `onDataExtracted()` + `onClose()`, bypassing the existing preview panel
3. **No confidence signal** — the AI never reports which words it is uncertain about
4. **No hallucination detection** — the existing `documentResponseValidation.ts` checks are not wired into this flow

### Changes

**1. Add handwriting-aware OCR prompt with uncertainty markers** (Edge function)
- File: `supabase/functions/import-complaint-data/index.ts`
- Replace the generic image OCR prompt with a handwriting-specific version that instructs GPT-4.1 to:
  - Mark uncertain words with `[?]` suffix (e.g. "Thornton[?]")
  - Never guess dates, NHS numbers, or phone numbers — output `[illegible]` instead
  - Describe letter structure (greeting, body, sign-off) rather than inventing missing sections
- Add a `confidence_notes` field to the response: a brief list of words/sections the AI was uncertain about

**2. Dual-pass verification for image uploads** (Edge function)
- File: `supabase/functions/import-complaint-data/index.ts`
- For image files only, run two separate OCR calls with slightly different prompts (one strict transcription, one structured extraction)
- Compare key fields (patient name, dates, phone numbers) between passes
- Flag any field where the two passes disagree as `[unverified]`
- Return a `verification_status`: `verified` (both passes agree), `partial` (some disagreements), or `unverified` (major disagreements)

**3. Add extracted text preview step for image imports** (Client)
- File: `src/components/ComplaintImport.tsx`
- When the source is an image file (photo of handwritten letter), do NOT auto-close the modal
- Instead, show an intermediate "Review Extracted Text" panel displaying:
  - The raw OCR text with `[?]` and `[illegible]` markers highlighted in amber
  - A verification status badge (Verified / Partially Verified / Needs Review)
  - An editable textarea so the PM can correct misread words before proceeding
  - "Confirm & Import" button to proceed, "Re-scan" button to retry
- Only after the PM confirms does the structured extraction (second AI call) run

**4. Add hallucination guard to the structuring prompt** (Edge function)
- File: `supabase/functions/import-complaint-data/index.ts`
- Update the system prompt for the JSON extraction step to include:
  - "If a field value was marked [illegible] or [?] in the source text, set it to null rather than guessing"
  - "Never infer an NHS number, date of birth, or phone number that is not clearly present"
  - "Set `confidence: 'low'` on any field derived from uncertain text"
- Add a `low_confidence_fields` array to the JSON response listing which fields had uncertain source text

**5. Show confidence warnings on the complaint form** (Client)
- File: `src/components/ComplaintImport.tsx`
- After import, if `low_confidence_fields` is non-empty, show an amber alert banner listing which fields need manual verification
- Highlight those specific form fields with an amber border (pass field names to the parent via `onDataExtracted`)

**6. Update edge function standards** (Edge function)
- File: `supabase/functions/import-complaint-data/index.ts`
- Replace `esm.sh` import with `npm:` specifier for supabase-js (per project standards)
- Replace deprecated `serve()` with `Deno.serve()`

### Files Changed
- `supabase/functions/import-complaint-data/index.ts` — Handwriting-aware prompts, dual-pass verification, confidence metadata, Deno.serve migration
- `src/components/ComplaintImport.tsx` — Preview step for image imports, confidence warnings, editable OCR text

### Behaviour
- **Text/email/Word imports**: Unchanged — auto-populate as before
- **Image imports (handwritten letters)**: Now show an intermediate review screen with highlighted uncertain text, allowing the PM to correct before importing
- **All imports**: Low-confidence fields are flagged on the form after import
- **No database changes required** — all new fields are transient (passed in the API response, not stored)

