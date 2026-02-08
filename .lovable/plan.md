

# Change Audio Evidence Review to Factual Call Summary

## What Changes

The AI-generated review of uploaded audio evidence in the Complaints service will switch from an opinionated tone/wellbeing analysis to a **straightforward, factual summary** of the call. No commentary on tone, no staff wellbeing assessments, no suggestions — just the facts.

---

## What You Will See

The dialog will now show a clean factual summary covering:

- **Call Overview** — who was involved, when, how long the call lasted
- **Key Points Discussed** — factual bullet points of what was raised
- **Actions or Outcomes** — any commitments, next steps, or resolutions mentioned
- **Call Statistics** — word count, estimated duration, number of speakers

The dialog title changes from "AI Audio Evidence Review" to "AI Call Summary", and the footer updates accordingly.

---

## Technical Changes

### 1. Edge Function: `supabase/functions/generate-audio-review/index.ts`

Replace the entire analysis prompt (currently ~80 lines about tone, wellbeing, staff support) with a concise factual summarisation prompt:

- **Remove**: Sections on "What Was Done Well", "Tone Assessment", "Staff Wellbeing Considerations", "Constructive Suggestions", "Learning & Development Opportunities"
- **Replace with**: Sections for "Call Overview" (who, when, duration), "Key Points Discussed" (factual bullet points), "Actions or Outcomes Mentioned", and "Call Statistics"
- **Rules**: No opinions, no tone commentary, no suggestions, no praise/criticism — purely factual third-person summary in British English
- **Call duration**: Pass the `audioDuration` parameter from the client so the prompt can include it in the summary header

### 2. Component: `src/components/AudioAIReviewDialog.tsx`

- Change dialog title from "AI Audio Evidence Review" to "AI Call Summary"
- Update footer disclaimer from "AI-generated analysis" to "AI-generated summary"
- Update toast messages and copy button text to match

### 3. Component: `src/components/InvestigationEvidence.tsx`

- Pass `audioDuration` (from the transcript record's `audio_duration_seconds`) to the edge function call body so the AI can reference call length
- Update all three call sites (auto-generate after transcription, manual generate, and re-analyse) to include the duration
- Update toast messages from "AI review" to "AI summary"

---

## No Breaking Changes

- The database column (`ai_summary`) remains unchanged
- Existing cached reviews will display as-is until re-analysed using the "Re-analyse" button
- The re-analyse button continues to work, generating the new factual format on demand

