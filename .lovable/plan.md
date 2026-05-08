# Ageing Well Admin — Notification Settings + Charts

Two additions to `src/pages/AdminAgewellResponses.tsx` and the `submit-agewell-response` edge function.

## 1. Notification settings (persisted)

A new "Notification Settings" panel (cog button beside Download CSV) opens a dialog where admins control who is emailed when a survey is submitted.

**Controls in the dialog**
- **Send for**: radio — *All submissions* / *Completed surveys only*
  - "Completed" = `overall_rating IS NOT NULL` (respondent reached the final question). Documented in helper text under the radio.
- **Recipients**: list of email chips. Add (input + Enter), remove (×). Multiple recipients allowed. Validated as email format.
- Save / Cancel.

Settings persist in a new tiny singleton table so changes survive deploys and apply server-side.

### Database

New table `agewell_notification_settings`:
- `id` uuid primary key
- `recipients` text[] not null default `{malcolm.railson@nhs.net}`
- `mode` text not null default `'all'` (check: `'all' | 'completed_only'`)
- `updated_at`, `updated_by`

RLS:
- SELECT/UPDATE/INSERT restricted to system admins + users with `agewell` service access (mirroring the page's existing access pattern).
- Edge function reads via service role (bypasses RLS).

### Edge function changes (`submit-agewell-response/index.ts`)

- Replace hard-coded `TO_EMAILS` constant with a fetch of `agewell_notification_settings` (single row) at request time.
- If `mode === 'completed_only'` and the submission has no `overall_rating`, **skip the email** (still insert the row).
- Use `recipients` from the row as the `to:` list. Fallback to existing default if row missing or empty.
- Test-mode (`?test=1`) bypass is unchanged.

## 2. Chart overviews

A new "Overview" section above the filters using `recharts` (already in project), driven by `filtered` rows so it reacts to the practice/channel/recommend filters.

Four charts in a 2×2 grid (stacks on mobile):
1. **Submissions over time** — line chart, last 12 weeks, count per ISO week.
2. **Overall rating distribution** — bar chart 1–5 with the existing rating colours (red/orange/teal).
3. **Recommendation breakdown** — donut: Yes / Unsure / No.
4. **Channel mix** — donut: Web / Phone / Paper.

Plus a slim **per-practice average rating** horizontal bar list below the grid (top 8 practices by volume) for at-a-glance comparison.

Charts use design-system colours from `index.css` where possible; the rating-specific palette reuses the existing `RATING_COLOUR` values for consistency with the table.

## Technical notes

- New file: `supabase/migrations/<ts>_agewell_notification_settings.sql` (created via the migration tool — singleton row seeded with current default recipient).
- New component: `src/components/agewell/NotificationSettingsDialog.tsx` (uses shadcn Dialog + Input + RadioGroup + Badge for chips).
- Page edits: add Settings button, add `<AgewellCharts />` section, no changes to filters/table/drawer.
- Edge function: small refactor — wrap email send in `if (shouldSend)` guard, fetch settings with cached 60-second TTL to avoid extra DB hits per submission.
- Deploy `submit-agewell-response` after edits.
