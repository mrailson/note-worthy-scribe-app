
Issue confirmed and reproducible: the `generate-demo-response` edge function (evidence mode) is still producing judgemental language for Complaint 17/`COMP260017` (e.g. “perceived as minimising”, “potentially dismissive”, training recommendations).  

Root cause is a combination of prompt + input contamination:
1) `supabase/functions/generate-demo-response/index.ts` evidence prompt is “factual” but not strict enough.  
2) Evidence context currently includes subjective sources:
   - `complaint_investigation_findings.critical_friend_review`
   - `complaint_investigation_evidence.ai_summary` (audio summaries with sections like “Tone Assessment”, “Staff Behaviour”, “Training Requirements”).
3) No post-generation guardrail check before returning text to the questionnaire.

Implementation plan

1) Tighten evidence source selection (highest impact)
- In `generate-demo-response` (evidence path), stop feeding subjective analysis fields into the model:
  - Remove `critical_friend_review` from prompt context.
  - For investigation evidence, prefer neutral `description` and document metadata.
  - For audio, rely on transcript excerpts from `complaint_investigation_transcripts` rather than AI summaries that include tone scoring.
- Keep factual sources: complaint description, decisions, actions, staff responses, dated notes, transcripts.

2) Replace prompt with hard “factual-only / no value judgement” constraints
- Update `evidenceSystemPrompt` with absolute rules already used in your other complaint functions:
  - No assessment of tone, professionalism, empathy, attitude, competence.
  - No evaluative adjectives (poor, dismissive, unprofessional, minimising, etc.).
  - No recommendations about communication training unless explicitly documented as an action already taken.
  - If allegation exists, label it as allegation/documented claim, not factual conclusion.
- Keep British English and concise field lengths.

3) Add a deterministic output guardrail before return
- Add a lightweight server-side checker in `generate-demo-response`:
  - Scan generated fields for judgemental patterns/phrases.
  - If hit, trigger one forced rewrite pass (“convert to factual-only; preserve documented facts and direct quotes only”) before responding.
- Return only cleaned fields to the client so “Auto-fill from Evidence” is safe by default.

4) Optional but recommended: visibility for debugging
- Include a response flag (e.g. `guardrailRewritten: true/false`) to aid verification in logs without changing UI behaviour.

Validation plan

1) Reproduce baseline (already done) with:
- POST `/generate-demo-response` `{ "action":"evidence", "complaintId":"8e4aa3a8-e329-4d3d-bcf7-cf12e32edc8b" }`
- Confirm old output contains value judgements.

2) Re-test after fix:
- Same payload should return factual wording only.
- Must not include judgemental phrases in any of the four fields.
- Must still include factual transcript content and actions/referral steps where documented.

3) UI verification:
- In Complaint Outcome Questionnaire, test:
  - “Auto-fill All from Evidence”
  - Per-field “Generate from evidence”
- Confirm no judgemental content is inserted.

4) Regression checks:
- Complaint with minimal evidence should produce “insufficient documentation” style factual text, not opinion.
- Complaint with no transcript should still generate neutral output from remaining evidence.

Technical details
- Files to update:
  - `supabase/functions/generate-demo-response/index.ts` (main fix)
- No database migration required.
- No client component changes required for core behaviour.
- Existing previously saved questionnaire text is not auto-rewritten; only new generation output will be corrected unless we add a separate backfill/clean action.
