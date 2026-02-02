
# Fix Plan: Recording Auto-Close and First 30s Missing Issues

## Summary

Two separate issues are happening on your live site:

1. **Recording auto-closed prematurely** - Multiple toast messages indicate the server closed the recording
2. **First 30 seconds missing** - Batch Whisper chunk #1 starts at 0:30 instead of 0:00

---

## Root Cause Analysis

### Issue 1: Recording Auto-Closed Prematurely

The code changes made earlier today (chunk timing fix) **have not been published to the live site**. The live site is running older code that may have different behaviour in the kill signal detection.

**Evidence from investigation:**
- Edge function logs show: `"Closed 0 inactive meetings"` - so the edge function is NOT the culprit
- Database function `cleanup_stuck_meetings` is correctly using 90-minute threshold
- Meeting created at 14:01:34, ended at 14:02:49 (only ~1 minute later)
- You had **multiple tabs open** - this can cause race conditions

**Likely cause:** With multiple tabs open, one tab's health monitor detected `status = 'completed'` in the database (possibly set by another tab's cleanup or stale state) and triggered the "Recording was ended by the server due to inactivity" toast.

### Issue 2: First 30 Seconds Missing

The batch Whisper chunk timing was calculating start/end times using `performance.now()` at **processing time** instead of **recording start time**.

- First chunk records 0-10s of audio
- Whisper API takes ~20s to process
- By processing time, `performance.now()` shows ~30 seconds elapsed
- Chunk displays as starting at 0:30 instead of 0:00

**This has been fixed** in the preview environment but needs publishing.

---

## Solution

### Step 1: Publish All Recent Changes

The following fixes are in preview but not yet live:

| Fix | Status | Action |
|-----|--------|--------|
| Chunk timing (0:00 start) | In preview | Publish |
| 90-min cleanup threshold | In database | Already live |
| Kill signal improvements | In preview | Publish |

**To publish:**
1. Click the **publish button** (globe icon, top right)
2. Click **"Update"**

### Step 2: Multi-Tab Protection (Enhancement)

To prevent multiple tabs from conflicting, we should add a **session lock** that prevents the kill signal from triggering prematurely.

**Proposed changes to `useMeetingKillSignal.ts`:**

```typescript
// Add a 5-second grace period before checking database status
// This allows the current tab's own updates to propagate

const checkMeetingStatusDirectly = useCallback(async () => {
  if (!meetingId || !isRecording || killTriggeredRef.current) return;
  
  // ENHANCEMENT: Wait 2 seconds after visibility change
  // to allow any pending updates from this tab to complete
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Double-check we're still recording after the delay
  if (!isRecording || killTriggeredRef.current) return;

  try {
    const { data, error } = await supabase
      .from('meetings')
      .select('status')
      .eq('id', meetingId)
      .single();

    if (error) {
      console.warn('Kill signal: Failed to check meeting status:', error.message);
      return;
    }

    // Only trigger if status is definitely 'completed'
    if (data?.status === 'completed') {
      console.log('Kill signal: Detected server-side closure via direct check');
      killTriggeredRef.current = true;
      showToast.warning('Recording was ended by the server due to inactivity', {
        section: 'meeting_manager',
        duration: 10000
      });
      onKillSignalRef.current();
    }
  } catch (err) {
    console.warn('Kill signal: Error checking meeting status:', err);
  }
}, [meetingId, isRecording]);
```

### Step 3: Add Session Lock for Multi-Tab Safety

Store a "recording lock" in sessionStorage with the tab's unique ID. When checking status, verify the lock is still valid.

---

## Implementation Steps

1. **Immediate**: Publish current changes to fix chunk timing
2. **Enhancement**: Add 2-second delay to kill signal visibility check
3. **Enhancement**: Implement session-based tab locking to prevent multi-tab conflicts

---

## Files to Change

1. **src/hooks/useMeetingKillSignal.ts** - Add delay before DB status check
2. **Publish** - Deploy all preview changes to live

---

## Testing After Fix

1. Start a recording on the live site
2. Open another tab with the same page
3. Switch between tabs multiple times
4. Verify recording continues without premature closure
5. Check that chunk #1 shows `0:00 → 0:10` (not `0:30`)

---

## Technical Details

### Current Flow (Problematic):
```
Tab A: Recording starts → status = 'recording'
Tab B: Opens same page → sees 'recording'
Tab A: User switches away → visibility hidden
Tab A: User switches back → visibility visible
→ checkMeetingStatusDirectly() runs IMMEDIATELY
→ If Tab B did anything, might see stale 'completed' status
→ Toast: "Recording was ended by server"
```

### Fixed Flow:
```
Tab A: Recording starts → status = 'recording'
Tab A: User switches away → visibility hidden  
Tab A: User switches back → visibility visible
→ Wait 2 seconds (let pending updates settle)
→ checkMeetingStatusDirectly() runs
→ Status still 'recording' → continue normally
```

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Delay hides legitimate server closures | 2s delay is minimal; 90-min timeout is the real protection |
| Multi-tab state conflicts | Session lock prevents conflicting updates |
| Toast spam from multiple checks | `killTriggeredRef` prevents duplicate toasts |
