

# Fix: Notes Generation Status Getting Overwritten to `queued`

## Problem

Every time the user opens a meeting modal, it shows "Notes are being generated..." even though notes were already successfully generated. The title and overview are correct but the status banner persists.

## Root Cause (confirmed via database investigation)

The `auto-close-inactive-meetings` edge function runs periodically and finds meetings still in `status: 'recording'`. When it closes them, it **blindly sets `notes_generation_status: 'queued'`** (line 178) — even if notes have already been generated and the status was already `'completed'`.

Timeline for Jessica's meeting `dcac40f1`:
- **09:34:17** — MeetingRecorder triggers `auto-generate-meeting-notes`
- **09:35:45** — Orchestrator completes, sets status to `'completed'` ✅
- **~09:37-09:38** — `auto-close-inactive-meetings` runs, finds the meeting still in `status: 'recording'`, overwrites `notes_generation_status` back to `'queued'` ❌
- Result: `notes_generation_status = 'queued'` permanently, causing the "Notes are being generated..." banner to show forever

## Plan

### 1. Fix `auto-close-inactive-meetings` — don't overwrite completed status

In `supabase/functions/auto-close-inactive-meetings/index.ts` (line 172-180), before setting `notes_generation_status: 'queued'`, check if notes already exist. If `notes_generation_status` is already `'completed'`, preserve it.

```typescript
// Fetch current notes status before updating
const { data: currentMeeting } = await supabase
  .from('meetings')
  .select('notes_generation_status')
  .eq('id', meeting.id)
  .single();

const notesStatus = currentMeeting?.notes_generation_status;
const shouldQueueNotes = notesStatus !== 'completed' && notesStatus !== 'generating';

await supabase.from('meetings').update({
  status: 'completed',
  end_time: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...(shouldQueueNotes ? { notes_generation_status: 'queued' } : {})
}).eq('id', meeting.id);
```

### 2. Add client-side resilience in `MeetingDetailsTabs`

If `notesGenerationStatus` is `'queued'` or `'generating'` but an overview already exists, don't show the "generating" banner — the status is stale.

In `src/components/meeting-details/MeetingDetailsTabs.tsx` (line 105):

```typescript
// Don't show generating banner if overview already exists (stale status)
const showGeneratingStatus = (notesGenerationStatus === 'queued' || notesGenerationStatus === 'generating') && !currentOverview;
```

### 3. Fix the stuck meeting in the database

The existing stuck meeting needs its status corrected. Add a self-healing check in `MeetingHistory.tsx` `handleViewMeetingSummary`: if summary exists but status is stuck at `queued`/`generating`, silently update status to `completed`.

In `src/pages/MeetingHistory.tsx` (after line 337):

```typescript
// Self-heal: if summary exists but status is stuck
if (summaryData?.summary && 
    (meeting.notes_generation_status === 'queued' || meeting.notes_generation_status === 'generating')) {
  supabase.from('meetings')
    .update({ notes_generation_status: 'completed' })
    .eq('id', meetingId)
    .then(() => console.log('🔧 Self-healed stuck notes_generation_status'));
}
```

## Files to Change

- `supabase/functions/auto-close-inactive-meetings/index.ts` — check before overwriting notes status
- `src/components/meeting-details/MeetingDetailsTabs.tsx` — don't show banner if overview exists
- `src/pages/MeetingHistory.tsx` — self-heal stuck status on modal open

