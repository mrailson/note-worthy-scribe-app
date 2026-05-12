
## MDU Indemnity Risk Assessor — Complaints Service

Add an AI-driven assessment that reads each complaint's content and metadata, classifies the medico-legal risk to the practice on a green / amber / red scale, and recommends whether the practice should contact their MDO (MDU, MPS, other). Surfaced alongside the existing manual `IndemnityConsiderationField` so the clinician retains the final decision.

### 1. Risk model (what the AI looks at)

Inputs sent to the analyser:
- Complaint title, description, category, sub-category
- Patient harm indicators (incident_date vs reported, severity if present)
- Staff mentioned, clinician involvement flag
- Whether the complaint mentions: missed/delayed diagnosis, medication error, safeguarding, death, serious harm, surgery/procedure, mental health crisis, child, threats of legal action, regulator (CQC/GMC/NMC/Ombudsman), media/solicitor
- Existing log entries / outcome status

Output (structured JSON):
- `risk_level`: green | amber | red
- `recommendation`: no_action | consider_mdo | contact_mdo_now
- `suggested_mdo`: mdu | mps | other | unknown (best guess from staff mentioned / practice profile if available, else "unknown")
- `rationale`: 2–4 short bullets, British English
- `red_flags`: string[] of detected high-risk phrases/themes
- `confidence`: 0–1

Heuristic guardrails (deterministic, run before AI to bias result):
- Any mention of death, serious harm, safeguarding, solicitor, coroner, GMC/NMC, police → forced **red**.
- Missed/delayed diagnosis, medication error, procedural injury, formal Ombudsman escalation, threats of legal action → at least **amber**.
- Service/admin only (rudeness, appointment booking, parking, comms tone) → **green**.
AI may upgrade but never downgrade below the heuristic floor.

### 2. Backend

New edge function: `assess-complaint-indemnity-risk`
- Input: `{ complaint_id }`
- Pulls complaint + log entries server-side (RLS via service role + practice check).
- Runs heuristic floor, then calls Anthropic `claude-sonnet-4-6` (per project Sonnet-only rule for clinical/governance outputs) with a strict JSON schema and British English instructions.
- Persists result.

New table: `complaint_indemnity_risk_assessments`
- complaint_id (uniq)
- risk_level (enum: green/amber/red)
- recommendation (enum)
- suggested_mdo
- rationale (jsonb / text[])
- red_flags (text[])
- confidence (numeric)
- model, prompt_version
- generated_by (uuid, nullable for system runs)
- generated_at, updated_at
- RLS: same practice scoping pattern as `complaint_indemnity_considerations`.

Re-assessment triggers:
- Manual "Re-assess" button.
- Auto on first open if no assessment exists.
- Auto when complaint description, category, or a new log entry is added (debounced; `stale=true` flag shown until refreshed).

### 3. UI — traffic light on the complaint

Replace the current narrow `w-56` indemnity field block with a two-part panel:

```text
+------------------------------------------------------------+
| 🟢/🟡/🔴  Indemnity Risk: AMBER                            |
| Recommendation: Consider contacting MDU                    |
| • Delayed diagnosis mentioned                              |
| • Patient referencing solicitor                            |
|                                                            |
| [ Re-assess ]   Confidence: 82%   Updated 12:04            |
+------------------------------------------------------------+
| Manual status: [Advice sought from MDO ▾]  (existing field)|
+------------------------------------------------------------+
```

Visual rules:
- Use semantic tokens already in the design system (no raw hex). Map:
  - green → success token / soft green background, dark green text
  - amber → warning token / soft amber, dark amber text, subtle pulse on first display
  - red → destructive token / soft red, dark red text, persistent gentle pulse until acknowledged
- Amber/red show a prominent call-out: *"Best practice: contact your MDO (MDU/MPS) before responding."*
- Green shows quiet reassurance: *"No medico-legal escalation indicators detected."*
- Tooltip explains AI is advisory and the registered clinician retains responsibility (matches existing CSO AI safety guardrails memory).

New component: `src/components/complaints/IndemnityRiskTrafficLight.tsx`
- Loads assessment, shows traffic light, rationale list, red flags chips, "Re-assess" button.
- "Acknowledged" action (red/amber) writes a log entry via existing `logComplaintActionWithMetadata`.

`IndemnityConsiderationField` stays — it becomes the *human decision* under the AI advisory banner. When AI recommends `contact_mdo_now` and the manual status is still `not_applicable`, show a soft inline nudge.

### 4. Complaints list / dashboard surfacing

- Add a small traffic-light dot next to each complaint row in `ComplimentsSummaryView`-equivalent complaints list (the complaints list view, not compliments) so triagers see risk at a glance.
- Add a "High medico-legal risk" filter chip (red + amber).
- Show count of unacknowledged red items at top of complaints dashboard.

### 5. Audit & safety

- Every assessment write logs to complaint audit trail (model, prompt version, risk level).
- AI output never auto-changes the manual `consideration_status`; it only recommends.
- Standard MHRA Class I disclaimer banner reused from CSO module: "Advisory only — not a substitute for MDO advice."
- Rate-limit re-assessment to e.g. once per 30s per complaint.

### 6. Rollout

1. Migration: enum + table + RLS + trigger.
2. Edge function with heuristic + Sonnet call + JSON schema validation.
3. `IndemnityRiskTrafficLight` component + integration in `ComplaintDetails.tsx` (replace the `w-56` block with the new panel; keep manual field beneath).
4. Dashboard list dot + filter.
5. Audit log entries + acknowledgement flow.
6. QA on a few seeded complaints (clear red, clear amber, clear green) to confirm heuristic floor behaviour and British English wording.

### Out of scope
- No automatic email to MDU.
- No change to existing `complaint_indemnity_considerations` table or the manual dropdown's behaviour — only an advisory layer above it.
- No changes to compliments, meeting, or other services.
