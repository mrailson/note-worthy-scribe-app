

## Why Anna Hicks's meeting (and last week's) didn't auto-generate

### What I found

**The meeting**
- ID: `c4bbe760-d281-429c-b303-7cd545ef4622`, titled generically `Meeting - Mon, 20th April 2026 (8:45 am)` — Anna Hicks isn't in the attendees table, so I'm matching on the only meeting today owned by you with a real transcript (CDR / palliative-care discussion). Confirm this is the right one.
- Status: `completed`. Transcript: present and substantial (multi-page). **No row in `meeting_summaries`. No row in `meeting_notes_multi`.** So nothing was generated.

**The queue**
- `meeting_notes_queue` row exists for this meeting:
  - `status: failed`
  - `error_message: "Edge Function returned a non-2xx status code"`
  - `retry_count: 1`, `max_attempts: 3`, `attempts: 0`
  - Created 07:45:08, failed by 07:46:01

**Last week (13 April) and the week before (7 April)** — same exact error message recorded on their queue rows. Difference: those eventually flipped to `completed` (likely after a manual trigger or a downstream retry). Today's stayed `failed`.

### Root cause — two compounding bugs

1. **The queue processor cron is firing into a 404.**
   Two cron jobs run every 2 minutes:
   - `process-meeting-notes-queue` → function **does not exist** in the codebase
   - `process-notes-queue` → function **does not exist** in the codebase (confirmed 404 in edge logs at 07:50)
   
   So `failed` queue rows never get retried by the scheduled worker. They sit there forever unless something else picks them up.

2. **The initial trigger in `graceful-end-meeting` failed once and there's no fallback.**
   When you stop a recording, `graceful-end-meeting` invokes `auto-generate-meeting-notes` directly (step 5). That call returned a non-2xx status (likely a 504 / timeout — this transcript is long and the function does multi-tier note generation inline). That failure was written to the queue, and then nobody retried it because of bug #1. The other "stuck meeting" cron only handles `status IN ('queued','uploaded')` or word_count-based recovery, **not** `meeting_notes_queue` rows in `failed` state.

3. **Why last week "worked":** the same first-attempt failure happened, but the meeting got a real title later (16 April, 16:13 — three days after the meeting), strongly suggesting you or a downstream batch process manually triggered it. Today nobody has done that yet, so it's still blank.

### Immediate fix for today's meeting (one click, no deploy needed)

Reset the queue row to `pending` and invoke `auto-generate-meeting-notes` directly with `forceRegenerate: true`. Either I do this for you now via the existing recovery utility, or I can add a one-liner button to your recovery tool.

### Permanent fix (queued as the next ticket — needs your go-ahead)

Three small changes, in priority order:

1. **Restore the queue processor** — either rebuild `process-meeting-notes-queue` as an edge function that scans `meeting_notes_queue` for `status='pending'` OR `status='failed' AND retry_count < max_attempts`, calls `auto-generate-meeting-notes`, and updates the row. OR delete the dead cron jobs and replace them with a SQL-only `pg_cron` job that does the same work via `net.http_post`.
2. **Add a Postgres safety net** — extend the existing `auto-process-stuck-meetings` cron to also pick up `meeting_notes_queue` rows where `status='failed' AND retry_count < max_attempts AND updated_at < now() - interval '5 minutes'` and re-fire `auto-generate-meeting-notes`.
3. **Make `auto-generate-meeting-notes` resilient to long transcripts** — the original failure was almost certainly a timeout on a long meeting. Switch the long-transcript path to the chunked `generateMinutesFast` orchestrator (already exists in `src/utils/MeetingMinutesOrchestrator.ts`) on the server side, with map-reduce summarisation. This fixes the underlying cause, not just the retry.

### What I want from you

- Confirm `c4bbe760-d281-429c-b303-7cd545ef4622` is Anna Hicks's meeting (Heather, palliative care, QR code feedback, John Vidler).
- Say "recover it now" and I'll re-queue + force-regenerate today's notes immediately.
- Then I'll raise items 1–3 above as the next ticket so this stops happening week after week.

