

## Patient Translation Summary Handout — Print, Email, SMS

**Goal**: After a translation session ends (and from history), staff can generate a patient-facing summary document in the patient's language, containing key encounter points and actions, plus a translation quality disclaimer. Deliverable via Word download, print, email, or SMS.

### New Edge Function: `generate-patient-translation-summary`

Creates an AI-generated patient-facing summary in the patient's language using GPT-4o-mini. Input: conversation text + patient language code. Output: a structured summary with:
- Key points of the encounter (in patient language)
- Actions for the patient (in patient language)
- No PII (same rules as the existing `summarise-translation-session` function)

The prompt instructs the model to write in the patient's language, use simple clear language, and structure output as: `{ keyPoints: string[], actions: string[], summary: string }`.

### New Utility: `generatePatientHandoutDocx.ts`

A new Word document generator (modelled on the existing `generateTranslationReportDocx.ts`) that produces a clean, patient-friendly A4 document:

- **Header**: Practice name + "Translation Visit Summary" (bilingual — English + patient language)
- **Date/Time**: Session date in simple format
- **Summary section**: AI-generated summary paragraph in patient's language
- **Key Points**: Bulleted list in patient's language
- **Actions for You**: Bulleted list of things the patient needs to do, in patient's language
- **English version**: Same content repeated in English below a separator
- **Disclaimer box**: Bilingual disclaimer (reuses the existing `PATIENT_DISCLAIMER` translations from `generateTranslationReportDocx.ts`) about AI translation quality and what to do if concerns
- **Practice contact**: Practice name and address at the bottom

Returns a Blob (not auto-download) so it can be attached to emails or downloaded on demand.

### New Component: `PatientHandoutActions.tsx`

A reusable component with 4 action buttons in a row:
1. **Download Word** — generates the DOCX and triggers download
2. **Print** — generates DOCX content as HTML print window (simpler: just the key points/actions/disclaimer formatted for print)
3. **Email** — opens a modal asking for patient email, then sends via `send-meeting-email-resend` with the DOCX attached
4. **SMS** — opens a modal, generates a short plain-text version of the summary in patient's language (key points + actions + disclaimer), sends via `send-sms-notify` or copies to clipboard

Props: `messages`, `patientLanguage`, `patientLanguageName`, `practiceInfo`, `sessionStart`, `sessionEnd`.

### Integration Points

**1. Session End Summary Modal** (`ReceptionTranslationView.tsx`, lines 3954-4048):
- Add a new section between the stats grid and "Download NHS Report" button
- Section header: "Send Patient Summary" with a brief description
- Embed `<PatientHandoutActions>` component
- The AI summary generation happens on-demand when any button is pressed (with loading state)

**2. Translation History Cards** (`TranslationHistoryInline.tsx`, lines 404-430):
- Add a new icon button next to the existing download (Word report) button — a `Send` or `UserCheck` icon
- On click, opens a small dropdown/popover with the 4 actions (Download, Print, Email, SMS)
- Uses the session's messages and metadata to generate the patient handout

### Files Changed

| File | Change |
|------|--------|
| `supabase/functions/generate-patient-translation-summary/index.ts` | **New** — AI summary in patient's language |
| `src/utils/generatePatientHandoutDocx.ts` | **New** — Patient-friendly DOCX generator |
| `src/components/admin-dictate/PatientHandoutActions.tsx` | **New** — Reusable action buttons component |
| `src/components/admin-dictate/ReceptionTranslationView.tsx` | Add PatientHandoutActions to session end modal |
| `src/components/admin-dictate/TranslationHistoryInline.tsx` | Add patient handout button to each history card |

