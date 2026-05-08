
# Mandatory Reads — Policy Acknowledgement & Reminder System

A new module under the Document/Policy area where managers publish policies that **must** be read by named staff, capture electronic acknowledgements (tick + typed name), chase non-readers automatically by email, and produce a one-click compliance log for inspectors.

## 1. Where it lives

- New top-level page **Mandatory Reads** under the existing Document Vault / Policy menu (practice manager + admin roles).
- Two tabs:
  - **Library** — list of mandatory documents with live compliance % per item.
  - **My Reads** — every staff member sees outstanding items they must acknowledge (also surfaced as a red badge on the main header until cleared).

## 2. Publishing a mandatory read

Manager flow:
1. Click **New Mandatory Read**.
2. Pick source: existing Vault policy, uploaded PDF/Docx, or paste text.
3. Set **title, version, effective date, re-read interval** (none / 6 / 12 / 24 months).
4. Choose **assignees** (admin chooses per policy, any combination):
   - Everyone in the practice
   - By role (clinicians, reception, managers, etc. — pulled from existing role table)
   - Custom — pick individuals or reuse existing distribution lists
5. Set **due date** (default +14 days) and **reminder cadence** (default below, editable).
6. Publish → assignment rows created, first email goes out immediately.

Re-publishing a new version automatically resets everyone's status to *Outstanding* and triggers a "policy updated, please re-read" email.

## 3. Reading & acknowledging

Recipient flow (signed-in users):
- Email link or in-app badge → opens the policy in a clean reader pane.
- Scroll-to-bottom unlocks the acknowledgement panel:
  - Tick "I confirm I have read and understood this policy"
  - Type full name (must match account name within tolerance)
  - Submit → record stored with timestamp, IP, user-agent, policy version hash.
- Confirmation screen + email receipt.

External / non-account staff: signed magic link sent to their email opens the same flow without needing a login.

## 4. Reminder schedule (default, override per policy)

- Day 0 — initial assignment
- Day +3 — gentle reminder
- Day +7 — second reminder
- Day +14 — overdue notice (also CC's line manager if set)
- Then weekly until acknowledged
- On version change — new "please re-read" email regardless of prior status

Manager can pause reminders for a specific person or policy.

## 5. Compliance dashboard & inspector log

Per policy:
- Donut: Acknowledged / Outstanding / Overdue
- Table of every assignee with status, acknowledged date, version acknowledged
- **Export** button → branded PDF "Policy Acknowledgement Log" suitable for CQC inspectors, plus CSV
- Filter by role, date range, practice

Practice-wide view:
- Heatmap of policies × roles showing % compliance
- Top 5 outstanding policies
- Top 5 staff with overdue items

## 6. Email templates (Notewell AI branded)

- New mandatory read assigned
- Reminder (gentle / second / overdue)
- Policy updated — please re-read
- Acknowledgement receipt
- Weekly manager digest (optional toggle) listing outstanding items across the practice

All sent via the existing Notewell AI sender, queued through the standard transactional email infrastructure (retry-safe, suppression-aware).

## 7. Audit & security

- Append-only acknowledgement table — no edits, no deletes.
- RLS: staff can only see their own assignments; managers see their practice; admins see all.
- Signed magic-link tokens single-use, 30-day expiry, hashed in DB.
- Each acknowledgement stores the **document version hash** so the log proves *which* version was acknowledged even after future edits.

## Technical section

**New tables**
- `mandatory_reads` — id, practice_id, title, source_type, source_ref, version, version_hash, body_storage_path, effective_date, reread_interval_months, due_days, reminder_schedule jsonb, paused, created_by
- `mandatory_read_assignments` — id, mandatory_read_id, user_id (nullable), email, full_name, role_snapshot, due_at, status (`outstanding|acknowledged|overdue|paused`), reminder_count, last_reminder_at, magic_token_hash, magic_token_expires_at
- `mandatory_read_acknowledgements` — id, assignment_id, mandatory_read_id, version_hash, acknowledged_at, typed_name, ip, user_agent (append-only, no UPDATE/DELETE policies)
- `mandatory_read_reminder_log` — assignment_id, sent_at, kind, message_id

**Edge functions**
- `mandatory-reads-publish` — creates assignments, enqueues initial emails
- `mandatory-reads-reminder-cron` — pg_cron every 15 min, picks due reminders, calls `send-transactional-email`
- `mandatory-reads-acknowledge` — validates magic token or auth, writes acknowledgement, sends receipt
- `mandatory-reads-export-log` — generates PDF (docx-js → PDF via existing pipeline) + CSV

**Email templates** (registered in transactional template registry):
`mandatory-read-assigned`, `mandatory-read-reminder`, `mandatory-read-overdue`, `mandatory-read-updated`, `mandatory-read-receipt`, `mandatory-read-manager-digest`.

**Frontend**
- `src/pages/MandatoryReads.tsx` (Library + dashboard)
- `src/pages/MandatoryReadsMine.tsx` (staff inbox)
- `src/pages/MandatoryReadView.tsx` (reader + acknowledgement panel; supports `?token=` for magic-link mode)
- Components: `PublishMandatoryReadDialog`, `AssigneePicker` (reuses existing distribution-list hook), `AcknowledgePanel`, `ComplianceDonut`, `ComplianceTable`, `InspectorExportButton`
- Header badge hook: `useOutstandingMandatoryReads`

**Reuses existing infra**
- Notewell AI transactional email sender (queue + suppression + Notewell AI from-name)
- Distribution lists (`useDistributionLists`)
- Role table (`user_roles` + `has_role`)
- Document branding/metadata for PDF export
- Vault for source policies

## Open question (one)

Reminder cadence default — confirm the schedule above (Day 0, +3, +7, +14, then weekly, escalate to manager on overdue) or pick a different default during build.
