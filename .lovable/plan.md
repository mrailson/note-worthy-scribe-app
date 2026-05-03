## Stop ancient meetings cluttering the Stuck Meeting Check

**Two changes:**

### 1. UI cap — only show last 7 days
`src/pages/SystemAdmin.tsx` `fetchStuckMeetings` (line 619-625): add `.gte('created_at', sevenDaysAgo)` so the panel only flags actionable recent stalls.

### 2. One-off DB sweep — mark anything >24h stale as failed
Run an UPDATE migration that sets `status='failed'` (and `notes_generation_status='failed'` where queued/generating) on every meeting with `updated_at < now() - interval '24 hours'` that's still in `recording`, `processing`, `transcribing`, `pending_transcription`, `queued`, or `generating`. This clears the existing backlog and stops them surfacing anywhere else in the app.

No schema change — just one data-update migration plus the small UI tweak.

Approve to apply.