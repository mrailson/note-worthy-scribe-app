
# Enhance Orphaned Whisper Connections: Pause Status and Graceful End & Generate

## Overview

Upgrade the Orphaned Whisper Connections panel on the Admin page to:
1. Show whether a meeting is **Paused** (using the `is_paused` database column)
2. Add a friendly **"End & Generate"** button alongside the existing Kill button that gracefully closes the meeting, triggers transcript consolidation, notes generation, and emails the user their meeting minutes

## What Changes

### 1. Update the `get_all_live_recordings` RPC to include `is_paused`

Currently the database function does not return the `is_paused` column, so the admin UI has no way to distinguish between a deliberately paused meeting and a stalled one. A new SQL migration will add `is_paused` to the return type and SELECT statement.

This means when `words_last_5_mins` is 0 and `is_paused` is true, the UI will show a calm "Paused" badge instead of a scary red "Stalled" warning.

### 2. Add "Paused" badge to the Orphaned Whisper Monitor UI

When a meeting has `is_paused = true`:
- Show a blue/purple **"Paused"** badge instead of the red stalled warning
- The "+0 last 5 min" indicator will use a neutral colour rather than red
- Paused meetings are still shown in the orphaned list (they are still consuming resources) but are visually distinguished from genuinely stalled meetings

### 3. Add "End & Generate" button

A new button next to the existing Kill button that performs a graceful meeting closure:

```text
[End & Generate]  [Kill]
```

- **End & Generate** (primary/blue): Stops the recording, runs consolidation, queues notes generation, and sends the completed notes to the user via email
- **Kill** (red/destructive): Remains as-is for emergency force-stop without notes generation

### 4. Create new edge function: `graceful-end-meeting`

This server-side function will orchestrate the full graceful closure pipeline:

1. **Stop the meeting** -- Set status to `completed`, set `end_time`
2. **Broadcast kill signal** -- Notify any connected client to stop recording
3. **Consolidate transcript chunks** -- Invoke `consolidate-meeting-chunks` to merge Whisper, AssemblyAI, and Deepgram data
4. **Queue notes generation** -- Insert into `meeting_notes_queue` with `pending` status
5. **Trigger immediate generation** -- Invoke `auto-generate-meeting-notes` directly (rather than waiting for the queue processor cron)
6. **Send email notification** -- Look up the user's email from profiles, fetch the generated notes, and invoke `send-meeting-email-resend` with a professional HTML email containing the meeting title, date, duration, and AI-generated minutes
7. **Audit log** -- Record the admin action in `system_audit_log`

### 5. Update confirmation dialog

The "End & Generate" button will show its own confirmation dialog with a friendlier tone:

> **End Meeting & Generate Notes**
>
> This will gracefully end "Team Standup" and:
> - Consolidate all transcript sources
> - Generate AI meeting minutes
> - Email the notes to user@example.com
>
> Current duration: 2h 15m | Words: 11,190
>
> [Cancel] [End & Generate Notes]

## Technical Details

### Files to Create

**`supabase/functions/graceful-end-meeting/index.ts`** -- New edge function that orchestrates the full pipeline:
- Accepts `{ meetingId: string }` in the request body
- Uses service role key to bypass RLS
- Performs all 7 steps listed above in sequence
- Returns success/failure with details of each step
- Has proper error handling so partial failures don't lose data (e.g., if email fails, the notes are still generated)

### Files to Modify

**`supabase/migrations/[new]` (new SQL migration)** -- Update `get_all_live_recordings`:
- Add `is_paused boolean` to the RETURNS TABLE definition
- Add `m.is_paused` to the SELECT statement

**`src/components/admin/OrphanedWhisperMonitor.tsx`**:
- Add `is_paused` to the `OrphanedMeeting` interface
- Map `is_paused` from the RPC response data
- Add "Paused" badge display logic (blue badge when `is_paused && words_last_5_mins === 0`)
- Change the stalled indicator colour to neutral when paused
- Add new "End & Generate" button alongside Kill
- Add new confirmation dialog state for the graceful end action
- Add `handleGracefulEnd` function that calls `graceful-end-meeting` edge function
- Show a success toast with "Notes are being generated and will be emailed to [user]"

**`supabase/config.toml`** -- Register the new `graceful-end-meeting` function with `verify_jwt = false`

### UI Layout Change (per meeting row)

```text
Before:
[User info] [Stats] [Kill]

After:
[User info] [Paused badge if applicable] [Stats] [End & Generate] [Kill]
```

On mobile or narrow screens, the buttons will stack vertically.

### Edge Function Pipeline Flow

```text
Admin clicks "End & Generate"
         |
         v
graceful-end-meeting (edge function)
         |
         +-- 1. Update meetings.status = 'completed'
         +-- 2. Broadcast force_stop to meeting-kill channel
         +-- 3. Invoke consolidate-meeting-chunks
         +-- 4. Upsert meeting_notes_queue (status: 'pending')
         +-- 5. Invoke auto-generate-meeting-notes
         +-- 6. Fetch user email from profiles
         +-- 7. Wait briefly for notes, then invoke send-meeting-email-resend
         +-- 8. Insert system_audit_log entry
         |
         v
Return { success: true, steps: [...] }
```

### Error Handling Strategy

Each step in the pipeline is wrapped independently so that:
- If consolidation fails, notes generation still attempts (it can read raw chunks)
- If notes generation fails, the queue entry remains for the cron processor to retry
- If email fails, a warning is returned but the meeting is still properly closed
- The admin always sees which steps succeeded/failed in the toast notification
