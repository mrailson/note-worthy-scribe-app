
# Fix Plan: Prevent Premature Meeting Auto-Closure

## Summary

Your meetings are being closed prematurely by a **database cron job** (`cleanup_stuck_meetings`) that runs hourly and closes ANY meeting with `word_count > 0`, regardless of how long it's been recording. This overrides the 90-minute timeout you configured.

---

## Technical Details

### The Problem

Three systems can close meetings:

| System | Threshold | Runs | Issue |
|--------|-----------|------|-------|
| `auto-close-inactive-meetings` edge function | 90 mins | Every 5 mins (client triggers) | Correct |
| `cleanup_stuck_meetings` database function | word_count > 0 OR 4 hours | Hourly via pg_cron | **Closes meetings with ANY words** |
| Client health monitor | 60/75 min warnings | Every 30 seconds | Correct (needs republish) |

The `cleanup_stuck_meetings` function was designed to clean up genuinely stuck meetings, but its logic is too aggressive - it closes any recording that has transcribed words, even if it's actively in progress.

---

## Solution Steps

### Step 1: Update the Database Function

Modify `cleanup_stuck_meetings` to:
- Only close meetings older than **90 minutes** (matching the edge function threshold)
- Remove the `word_count > 0` condition that causes premature closure
- Add logging to track when meetings are auto-closed

New logic:
```sql
WHERE status = 'recording' 
  AND (
    notes_generation_status = 'completed'  -- Already has notes = definitely stuck
    OR created_at < now() - INTERVAL '90 minutes'  -- Match the edge function threshold
  )
```

### Step 2: Publish Frontend Changes

The client-side warning thresholds (60/75 minutes) are in the preview but need to be published to the live site.

---

## Implementation

The following database migration will fix the function:

```sql
CREATE OR REPLACE FUNCTION public.cleanup_stuck_meetings()
RETURNS TABLE(fixed_meetings_count integer, fixed_meeting_ids uuid[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  fixed_count integer := 0;
  meeting_ids uuid[];
BEGIN
  -- Find and fix meetings stuck in recording status
  -- IMPORTANT: Only close meetings that are:
  -- 1. Older than 90 minutes (matching the edge function threshold), OR
  -- 2. Already have notes generated (definitely stuck)
  -- 
  -- Do NOT close meetings just because they have word_count > 0
  -- as this would close actively recording meetings prematurely.
  UPDATE meetings 
  SET 
    status = 'completed',
    end_time = COALESCE(end_time, updated_at, created_at + INTERVAL '2 hours'),
    updated_at = now()
  WHERE status = 'recording' 
    AND (
      notes_generation_status = 'completed'  -- Already has notes = definitely stuck
      OR created_at < now() - INTERVAL '90 minutes'  -- Match edge function threshold
    )
  RETURNING id INTO meeting_ids;
  
  GET DIAGNOSTICS fixed_count = ROW_COUNT;
  
  -- Log the cleanup operation
  IF fixed_count > 0 THEN
    PERFORM log_system_activity(
      'meetings',
      'AUTO_CLEANUP_STUCK_RECORDINGS',
      NULL,
      jsonb_build_object(
        'fixed_count', fixed_count,
        'meeting_ids', meeting_ids,
        'cleanup_time', now(),
        'threshold_minutes', 90
      ),
      NULL
    );
  END IF;
  
  RETURN QUERY SELECT fixed_count, meeting_ids;
END;
$$;
```

---

## Files to Change

1. **Database migration** - Update `cleanup_stuck_meetings` function (required - fixes the bug)
2. **Publish to live** - Click Update button in publish dialog (required - enables client warnings)

---

## Testing Recommendation

After implementing:
1. Start a test recording
2. Switch to other tabs/windows
3. Leave recording running for 10-15 minutes
4. Return to verify it's still active
5. Check that no premature closure occurs until 90 minutes

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Genuinely stuck meetings not cleaned up | The 90-minute threshold still catches them; edge function also runs every 5 minutes |
| Cost from orphaned recordings | 4-hour hard limit remains in place; 60/75-minute client warnings alert users |
