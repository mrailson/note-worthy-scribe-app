## What's happening

You (`malcolm.railson@nhs.net`) are a `system_admin`. The meetings list on the recorder page is showing meetings owned by other users — `j.railson`, `beth.wilson22`, `leann.farrell1`, `tom.howseman` — which is a privacy breach.

Two compounding problems:

### 1. Database RLS lets system admins read every user's meetings

The `meetings` table has these SELECT policies (all PERMISSIVE, so they OR together):

```text
meetings_select_authenticated → user_id = auth.uid() OR shared_with me
meetings_select_system_admin   → is_system_admin(auth.uid())   ← reads ALL meetings
```

Because you have the `system_admin` role, the second policy returns every meeting in the database, including other users'. Other users don't have this role, which is why they only see their own — exactly what you observed.

### 2. The recorder's "My meetings" query has no user filter

`src/components/MeetingRecorder.tsx` → `loadMeetingHistory()` queries `meetings` with no `.eq('user_id', user.id)` filter and just relies on RLS. With the admin policy above, that returns the whole table.

The other entry point (`src/pages/MeetingHistory.tsx`) does filter by `user_id`, so it isn't affected — which matches the screenshots showing the leak only on the recorder's "My meetings" tab.

## Fix

### A. Tighten RLS on `meetings` (migration)

Drop the broad `meetings_select_system_admin` policy so a logged-in user — admin or not — can only ever see:
- meetings they own (`user_id = auth.uid()`), or
- meetings explicitly shared with them via `meeting_shares`.

Admin tooling that genuinely needs cross-user visibility (e.g. the audio backup search admin page) already uses dedicated server-side paths and won't be affected by removing this client-facing read.

Apply the same tightening to the related child tables that currently mirror the admin-wide pattern, so an admin can't pull other people's notes/transcripts/overviews either:
- `meeting_overviews`
- `meeting_summaries`
- `meeting_transcripts`
- `meeting_documents`
- any other `meeting_*` child table whose SELECT policy uses `is_system_admin`

(Each will be reviewed and only the admin-wide SELECT policy dropped; the owner/shared policies stay.)

### B. Defence in depth in client code

In `src/components/MeetingRecorder.tsx` `loadMeetingHistory()`, add `.eq('user_id', user.id)` to the meetings query so even if RLS is ever loosened again, the recorder UI cannot show another user's meetings.

### C. Fix the "Generate Meeting Notes" prompt regression (same area)

The recent embed of `meeting_overviews(...)` in `src/pages/MeetingHistory.tsx` and `src/components/MeetingRecorder.tsx` is read as `meeting.meeting_overviews?.overview`, but PostgREST returns the embedded child as an **array**, so `.overview` is always `undefined`. Result: every card shows "Transcript available — notes haven't been generated yet" and "No overview available", even when an overview exists in the DB.

Fix by reading the first element (`meeting.meeting_overviews?.[0]?.overview`) and falling back to the legacy `meetings.overview` column if present, in both files.

## Verification

After deploy:
1. Log in as `malcolm.railson@nhs.net` → "My meetings" should only list meetings where `user_id = your id` (plus anything explicitly shared with you).
2. The 4 leaked meetings (Cambridge Community House, Bungalow Centre, UKRI Dementia, Investigation into Unaccounted Private Work) should disappear from your list.
3. Existing overview text should re-appear on the cards instead of the amber "Generate Meeting Notes" prompt.
4. Run the Supabase security linter to confirm no new issues.

## Out of scope

- No changes to how other users' meetings are stored — only to who can read them.
- No changes to the audio backup admin page or any server-side admin tooling.
