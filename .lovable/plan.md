

## Add "Closed – Withdrawn/Resolved" Complaint Status

### Problem
When a patient withdraws their complaint (e.g. issue resolved informally), there is no way to close it without going through the full outcome letter questionnaire. Practice Managers need a quick "Withdrawn/Resolved" closure path.

### Changes

**1. Add "Withdrawn/Resolved" as an outcome type option in the Outcome Questionnaire**
- File: `src/components/ComplaintOutcomeQuestionnaire.tsx`
- Add `'withdrawn'` to the `outcome_type` union type in `QuestionnaireData`
- Add a new radio/select option: "Withdrawn / Resolved Informally"
- When `withdrawn` is selected, skip the outcome letter generation step — save directly to `complaint_outcomes` with `outcome_type: 'withdrawn'` and a brief summary
- The questionnaire should still collect: a short resolution note (what was done), and who resolved it — but skip tone, letter generation, and detailed findings

**2. Update status display labels across all views**
- File: `src/pages/ComplaintDetails.tsx` — Add `'withdrawn'` mapping in the two `outcomeType` display blocks (~lines 1811-1817, 2255-2261) and the outcome letter heading (~line 2700-2720) to show "Closed – Withdrawn/Resolved"
- File: `src/pages/ComplaintsSystem.tsx` — Add `withdrawn: 'Withdrawn/Resolved'` to the `outcomeLabels` map in `getStatusDisplayLabel` (~line 1483)
- File: `src/components/complaints/ComplaintsSummaryView.tsx` — Already has `withdrawn: 'Withdrawn'` in `OUTCOME_LABELS` (line 69); update to `'Withdrawn/Resolved'`

**3. Update the validation gate**
- File: `src/components/ComplaintOutcomeQuestionnaire.tsx` (~line 911) — Add `'withdrawn'` to the allowed outcome types array so it passes validation

**4. Handle the withdrawn flow in the questionnaire UI**
- When "Withdrawn / Resolved Informally" is selected, show a simplified panel:
  - Resolution summary textarea (required, e.g. "Spoke to patient, prescription issued, future appointment booked")
  - Skip letter tone, formal findings, improvements sections
  - Button label: "Close as Withdrawn/Resolved" instead of "Generate Outcome Letter"
- Save to DB via the existing `create_complaint_outcome` RPC with `outcome_type: 'withdrawn'`, summary text, and no outcome letter

**5. No database schema changes needed**
- The `complaint_outcomes.outcome_type` column already accepts text values; `withdrawn` is already referenced in `OUTCOME_LABELS`

### Files changed
- `src/components/ComplaintOutcomeQuestionnaire.tsx` — Add withdrawn option, simplified flow, validation update
- `src/pages/ComplaintDetails.tsx` — Display label mappings for withdrawn
- `src/pages/ComplaintsSystem.tsx` — Display label in list view
- `src/components/complaints/ComplaintsSummaryView.tsx` — Update outcome label text

### Behaviour
- Existing complaint closure flows (Upheld, Partially Upheld, Not Upheld) are completely unchanged
- "Withdrawn/Resolved" skips letter generation — saves time for informal resolutions
- Complaint status shows as "Closed – Withdrawn/Resolved" across all views
- The complaint is properly closed with an audit trail of what was resolved

