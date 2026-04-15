

## Why the Meeting Title Didn't Generate

**Root cause**: Two issues combine to leave the title as the generic default:

1. **Early exit skips title generation**: When `auto-generate-meeting-notes` is called with `forceRegenerate: false` and notes already exist, it returns at line 305 — **before** reaching the title generation code at line 1463. So the manual Generate button never triggers title generation if notes already exist.

2. **Safety net not connected**: The `ensureMeetingTitle()` function in `manualTriggerNotes.ts` exists specifically to catch this scenario, but it's only called from `manualTriggerAutoNotes()` (used by the recovery helper). The Generate buttons in MeetingHistory and MeetingDetailsTabs call `auto-generate-meeting-notes` directly and never invoke `ensureMeetingTitle`.

---

## Plan

### Change 1 — `src/pages/MeetingHistory.tsx`
After the `auto-generate-meeting-notes` call completes (success or failure), add a call to `ensureMeetingTitle(meetingId)` as a safety net. Import `ensureMeetingTitle` from `@/utils/manualTriggerNotes`.

### Change 2 — `src/components/meeting-details/MeetingDetailsTabs.tsx`
Same fix: after calling `auto-generate-meeting-notes`, add `ensureMeetingTitle(meetingId)`. Import `ensureMeetingTitle` from `@/utils/manualTriggerNotes`.

### Change 3 — `supabase/functions/auto-generate-meeting-notes/index.ts`
In the early-exit block (lines 296–309), before returning the "skipped" response, add a title check: if the meeting title matches a generic pattern (e.g. starts with "Meeting -"), call `generate-meeting-title` to fix it even though notes generation is skipped. This ensures title generation happens regardless of whether notes are regenerated.

### Summary
- **Edge function**: Even when skipping note generation, check and fix generic titles
- **Client-side**: Both Generate buttons get the `ensureMeetingTitle` safety net
- No new files, no schema changes

