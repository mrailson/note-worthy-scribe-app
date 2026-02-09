
# Plan: Enforce Flowing Letter Style (No Section Headings)

## Problem
The AI sometimes produces outcome letters with bold titled sections like **"Summary of Investigation"**, **"Outcome Statement"**, **"Learning and Improvements"**, etc. The preferred style is a natural, flowing professional letter — like a real NHS letter — with no visible section headings.

## Root Cause
Two edge function prompts instruct the AI to follow a numbered structure (Header, Opening Acknowledgement, Summary of Investigation, etc.) without explicitly telling it these are internal guidance only and must NOT appear as visible headings.

## Changes

### 1. `supabase/functions/generate-complaint-outcome-letter/index.ts`

**System prompt (Section 3 - Mandatory Letter Structure, ~line 285):**
Add a clear instruction that these are internal content guidance, not visible headings:
- Add: "These are internal content sections for your guidance only. Do NOT include section titles, headings, or labels in the letter. The letter must flow naturally as a single continuous professional document, with smooth paragraph transitions. No bold headings, no numbered sections, no titled blocks."

**System prompt (Section 6 - Output Requirements, ~line 319):**
Add to the formatting rules:
- Add: "No section headings, titles, or labels — the letter must read as a flowing, natural professional letter"

**User prompt (~line 432):**
Update the instruction from "Follow the mandatory letter structure..." to clarify these are content requirements, not formatting:
- Change to: "Ensure the letter covers all required content areas (opening acknowledgement, investigation summary, outcome, learning and improvements, individual resolution if appropriate, escalation rights, closing) but present them as a single flowing letter without any section headings or titles."

### 2. `supabase/functions/regenerate-outcome-letter/index.ts`

**System prompt (~line 55-56):**
The "MANDATORY LETTER STRUCTURE" line currently reads:
> "The letter must follow this order: Header -> Opening Acknowledgement -> Summary of Investigation -> ..."

Update to:
- "The letter must cover this content in order: Header, Opening Acknowledgement, Summary of Investigation, Outcome Statement, Learning and Improvements, Individual Resolution (if appropriate), Escalation Rights, Professional Closing. These are internal content areas only — do NOT include section titles, headings, or labels. The letter must flow naturally as a continuous professional document."

**Add to OUTPUT RULES (~line 77-82):**
- Add: "No section headings, titles, or labels — the letter must read as a flowing, natural professional letter"

## Files Modified

| File | Change |
|------|--------|
| `supabase/functions/generate-complaint-outcome-letter/index.ts` | Add no-headings instructions to system prompt sections 3 and 6, and update user prompt |
| `supabase/functions/regenerate-outcome-letter/index.ts` | Add no-headings instructions to mandatory structure and output rules |

Both edge functions will be redeployed after the changes.
