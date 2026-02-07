
# Update Complaint Outcome Letter System Prompt to Final Toggle-Aware Specification

## Overview

Replace the existing system prompt in the outcome letter generator with the user's refined, best-practice-aligned NoteWell AI specification. This also aligns the regeneration function and corrects the default toggle value for formal outcome labels from OFF to ON.

---

## Changes

### 1. Update default toggle value: Formal labels default ON

**File:** `src/components/ComplaintOutcomeQuestionnaire.tsx`

The new specification states **DEFAULT = ON** for formal outcome labels, but the current code defaults to `false`. Update the initial state:

- Line 80: Change `use_formal_outcome_labels: false` to `use_formal_outcome_labels: true`

This also affects the regeneration pass-through in `ComplaintDetails.tsx` (line 1304), which uses `?? false` as the fallback -- change to `?? true`.

### 2. Replace the system prompt in `generate-complaint-outcome-letter`

**File:** `supabase/functions/generate-complaint-outcome-letter/index.ts`

Replace the current `systemPrompt` (lines 243-321) with the user's full specification, structured as follows:

- **Preamble:** Role definition and compliance standards (NHS Regulations, PHSO, CQC, NoteWell governance rules)
- **Section 1 -- Inputs:** Document what inputs are expected (complaint report, practice details, signatory, patient details, questionnaireData with toggle and outcome)
- **Section 2 -- Outcome Wording Rules:** Toggle-aware logic
  - Formal labels ON (default): Must use exact phrases "upheld" / "partially upheld" / "not upheld"
  - Formal labels OFF: Plain, empathetic language with specific template paragraphs per outcome type
  - Never use "Rejected"
- **Section 3 -- Mandatory Letter Structure:** Enforced order: Header, Opening Acknowledgement, Summary of Investigation, Outcome Statement, Learning and Improvements, Individual Resolution (with safe phrasing), Escalation Rights (mandatory), Professional Closing
- **Section 4 -- Escalation Wording:** Verbatim paragraph provided in the spec
- **Section 5 -- Safety and Governance Rules:** No fabrication, no blame, no adversarial language, assume review by PHSO/CQC/ICB/legal
- **Section 6 -- Output Requirements:** British English, formal letter format, no bullet points, no internal system references, no AI disclaimers

Key differences from current prompt:
- Adds "No bullet points in the final letter" (new rule)
- Adds "No AI disclaimers" in output (new rule)
- Adds explicit "Individual Resolution" section with safe phrasing guidelines
- Adds "No internal system references" rule
- Specifies mandatory letter structure order (7 sections)
- Includes verbatim escalation paragraph
- Explicit mention of CQC/ICB/legal review assumption
- Cleaner structure with numbered sections

The existing data-fetching code (practice details, signatures, investigation findings, staff responses, etc.) remains unchanged -- only the prompt text is replaced.

Also update the user prompt (lines 421-495) to:
- Reference the new mandatory structure order
- Remove the standalone escalation text variable (lines 324-334) and instead embed the verbatim escalation wording directly in the system prompt as per the spec
- Add instruction: "Do not use bullet points anywhere in the letter"

### 3. Align the regeneration function prompt

**File:** `supabase/functions/regenerate-outcome-letter/index.ts`

Update the system prompt (lines 38-67) to reference the same rules:

- Add "No bullet points in the final letter" rule
- Add "No AI disclaimers" rule  
- Add "No internal system references" rule
- Add the mandatory escalation paragraph preservation rule: "Always preserve the PHSO escalation paragraph. If it is missing from the current letter, add it."
- Add safe phrasing rules for individual resolution sections
- Maintain existing signature deduplication and no-placeholder rules

### 4. Update the toggle default in the regeneration call

**File:** `src/pages/ComplaintDetails.tsx`

Line 1304: Change `?? false` to `?? true` to match the new default.

---

## Files Modified

| File | Change Summary |
|------|---------------|
| `supabase/functions/generate-complaint-outcome-letter/index.ts` | Replace system prompt with full NoteWell AI specification; update user prompt to enforce mandatory structure and no bullet points |
| `supabase/functions/regenerate-outcome-letter/index.ts` | Align system prompt with new rules (no bullets, no AI disclaimers, escalation preservation, safe phrasing) |
| `src/components/ComplaintOutcomeQuestionnaire.tsx` | Change `use_formal_outcome_labels` default from `false` to `true` |
| `src/pages/ComplaintDetails.tsx` | Change fallback from `?? false` to `?? true` |

## What Does NOT Change

- Data-fetching logic (practice details, signatures, investigation data)
- Practice/profile priority lookup order
- Logo handling (HTML comment approach)
- Frontend letter rendering (FormattedLetterContent.tsx)
- Database schema
- Acknowledgement letter function (separate prompt)
- Word document export
