Plan to update the Top 25 patient side view so patient reveal works without asking for a separate reason, while still writing an audit log of the patient ID and user who opened it.

1. Remove the reason requirement from patient reveal
- In `PatientDrillDrawer.tsx`, remove the cross-practice exception reason text area and its minimum-length gate.
- Replace it with a simple “Reveal identifiers” action and short DSA/DPO reassurance text.
- Remove the “Reason: …” text shown after reveal.

2. Log individual patient opens/reveals
- Add a dedicated audit path that records:
  - current authenticated user via `auth.uid()` server-side,
  - practice ID,
  - patient FK/link ID,
  - context such as `top25_patient_side_view` or `patient_detail_reveal`,
  - route/source,
  - timestamp.
- Use the existing `narp_pii_access_log` pattern where possible, but add a per-patient RPC so the browser cannot spoof another user ID.
- Keep this as an audit-only action; it should not request or store a free-text reason.

3. Make Top 25 open the patient drawer with a cohort context
- Update the Top 25 `onOpenPatient` call in `NRESPopulationRisk.tsx` so it passes a cohort context like:
  - label: `Top 25 highest-risk patients`,
  - count: 25 or the current visible top-risk count,
  - source/context key for audit.
- This keeps the patient side view in the drill drawer and preserves the Back-to-cohort behaviour rather than feeling like a separate route.

4. Reveal identifiers after the audit succeeds
- When a user clicks Reveal in patient mode, call the new audit RPC first.
- If the audit succeeds, set the reveal state and show identifiers.
- If the audit fails because the user lacks permission or is unauthenticated, keep identifiers hidden and show a clear error toast.

5. Preserve existing safeguards
- Do not weaken the existing identifiable permissions (`can_view_narp_identifiable` / export permissions).
- Keep DSA-based permission checks server-side.
- Keep existing export behaviour and identifiable CSV modal unchanged.
- Keep existing drill-through animation, Back handling, selection, routing and worklist actions unchanged.

Technical details
- Likely database migration: add a nullable `patient_ref` / `fk_patient_link_id` text column to `public.narp_pii_access_log`, or create a small dedicated `public.narp_patient_reveal_log` table if the existing log shape should remain page-level only.
- Preferred RPC shape:
  - `public.log_narp_patient_reveal(_practice_id uuid, _fk_patient_link_id text, _route text, _context text default 'patient_detail_reveal')`
  - `SECURITY DEFINER`, `auth.uid()` required, validates `has_can_view_narp_identifiable(auth.uid(), _practice_id)` before inserting.
- Frontend code will call the RPC from `PatientDrillDrawer` on reveal/open, not from local storage or client-side-only logging.

Acceptance checks after implementation
- Clicking a Top 25 patient opens the patient side view.
- Reveal identifiers does not ask for a reason.
- Audit row includes patient ID and authenticated user.
- Users without identifiable permission cannot reveal identifiers.
- Back from patient view still returns to the Top 25/cohort context.
- No regression to export, worklist, routing or permission checks.