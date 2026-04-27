Plan to add stuck meeting visibility to System Overview

1. Add a “Stuck Meetings” status card to System Administration > Overview
- Show a count of meetings that look stuck or orphaned.
- Use a warning style when any exist, and a healthy/neutral style when none exist.
- Include a “Refresh” action so you can re-check immediately.
- Include a “View details” link/action that takes you to the existing Meeting Service monitoring area.

2. Detect the same failure mode as today’s lost iPhone meeting
The check will look for meetings such as:
- `status = recording` where chunks exist, but no new transcript chunk has arrived for more than 15 minutes and the meeting is older than 20 minutes.
- `status = recording` where transcript chunks exist but notes/transcript finalisation has not happened.
- `status in ('processing', 'transcribing', 'pending_transcription')` and `updated_at` is older than 15 minutes.
- meetings with chunks but no generated notes after a reasonable delay.

3. Add a compact stuck-meetings panel below the overview cards
- Show the latest stuck meetings with title, user, status, start time, last chunk time, word count, and likely reason.
- Keep it short in Overview, e.g. top 5 issues, so the page does not become cluttered.
- Add a button to jump to the fuller Meeting Service tab.

4. Improve the existing Meeting Service monitoring list
- The current `LiveAndRecentMeetings` component already shows active/stalled recordings, but only inside System Monitoring > Meeting Service.
- Extend it so it clearly labels orphaned/stuck meetings, not just “Stalled?”.
- Add clearer wording: “No transcript chunks for X minutes”, “Needs finalising”, or “Notes not generated”.

5. Recovery actions for admins
- Add safe action buttons where appropriate:
  - “Auto-close inactive meetings” using the existing `auto-close-inactive-meetings` function.
  - “Complete / recover” for a selected stuck meeting using the existing `complete-stuck-meeting` or `force-complete-meeting` flow.
- Keep actions admin-only and guarded by existing system admin checks.

Technical notes
- Main UI file: `src/pages/SystemAdmin.tsx`.
- Existing meeting monitoring component: `src/components/admin/LiveAndRecentMeetings.tsx`.
- Existing admin controls: `src/components/AdminMeetingControls.tsx`.
- Existing backend helpers already present:
  - `get_all_live_recordings` RPC
  - `auto-close-inactive-meetings`
  - `complete-stuck-meeting`
  - `force-complete-meeting`
- No new database tables should be needed. If a more reusable query is required, add a small read-only security-definer RPC that returns stuck meeting summaries for system admins only.