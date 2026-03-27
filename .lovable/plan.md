

# Fix: Document Studio Needs a "Review & Update Against Guidance" Document Type

## What Happened to Julia

Julia uploaded her blood protocol document to the Document Studio using the **"Policy / Guidance Summariser"** type. She wanted the AI to **check her document against the latest NICE guidance and update it accordingly**.

However, the Policy Summariser's system prompt is hardcoded to generate a staff-facing summary + Top 10 one-pager — it **completely rewrites the input into a summary format** rather than preserving the original document structure and updating it.

Result: 696-word summary output instead of her updated multi-page blood protocol. The original document content was effectively discarded.

## Root Cause

There is no Document Studio type for "review my existing document against current guidance and update it". The two closest options are:
- **Policy Summariser** — summarises (wrong output format)
- **Policy Hub** — has gap analysis + update generation, but it's a separate feature not accessible from Document Studio

## Proposed Fix

### 1. Add a new document type: "Policy Review & Update"

Add a new entry in `documentTypes.ts` with type_key `policy_review_update`:
- **Display name**: "Policy Review & Update"
- **Description**: "Upload an existing policy or protocol. AI checks it against current NICE/NHS guidance and returns an updated version preserving your original structure."
- **Category**: `governance`
- **System prompt**: Instructs the AI to:
  - Preserve the original document's structure, headings, and formatting
  - Check content against current NICE guidelines, CQC standards, and NHS best practice
  - Update outdated references, doses, pathways, or recommendations
  - Add a "Changes Made" summary section at the end listing what was updated and why
  - Flag anything it cannot verify with a clear `[VERIFY]` marker
  - Use British English throughout
  - NOT fabricate guidance — only update where it has confident knowledge

### 2. Add clarifying questions specific to this type

- "What type of policy/protocol is this?" (pills: Clinical Protocol, Practice Policy, SOP, Prescribing Guideline, Other)
- "Which guidance should it be checked against?" (pills: Latest NICE Guidelines, BNF, CQC Standards, NHS England, All applicable)
- "What level of changes are acceptable?" (pills: Minor updates only, Full revision where needed, Flag issues but don't change)

### 3. Update the system prompt to be explicit about preservation

The key differentiator from the summariser: the prompt will say "Return the COMPLETE updated document in its original structure. Do NOT summarise or shorten. Preserve all sections, tables, and formatting."

## Files to Change

- `src/components/DocumentStudio/documentTypes.ts` — add new `policy_review_update` type with system prompt
- `src/components/DocumentStudio/StepChoose.tsx` — add `policy_review_update` to the visible types list (in the ordered array)

## Technical Detail

- No edge function changes needed — the existing `generate-document-studio` `generate_document` action will work, as the system prompt drives the output format
- The `callAI` timeout is already 120s which should be sufficient for longer policy documents
- File upload processing is already handled by `processUploadedFiles()` in StepGenerate

