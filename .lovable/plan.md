
# Fix Plan: False "Ended by Server" Toast on Manual Stop

## Summary

When you manually stop a recording, the toast "Recording was ended by the server due to inactivity" incorrectly appears. This is a **stale closure bug** - the kill signal check is reading an outdated value of `isRecording` from when the callback was created.

---

## Root Cause

The `checkMeetingStatusDirectly` callback in `useMeetingKillSignal.ts` captures `isRecording` in its closure. After the 2-second grace period, it checks this value, but it's the **old** value from when the callback was created, not the current state.

### Timeline of the Bug

```text
1. Tab becomes visible → checkMeetingStatusDirectly starts (isRecording = true in closure)
2. 2-second wait begins...
3. User clicks "Stop Recording"
   → isRecording state becomes false
   → Meeting status updated to 'completed' in database
4. 2 seconds elapse
5. Callback checks: if (!isRecording)... 
   → Sees OLD value (true) from closure!
6. Database returns status = 'completed'
7. Toast incorrectly shows "Recording was ended by the server"
```

---

## Solution

Use a **ref** to track the current `isRecording` value, similar to how `onKillSignalRef` is already used. This ensures we always read the latest value, not a stale closure.

### Changes to `src/hooks/useMeetingKillSignal.ts`

1. Add a new ref to track current recording state:
   ```typescript
   const isRecordingRef = useRef(isRecording);
   useEffect(() => {
     isRecordingRef.current = isRecording;
   }, [isRecording]);
   ```

2. Update `checkMeetingStatusDirectly` to read from the ref:
   ```typescript
   // Before grace period
   if (!meetingId || !isRecordingRef.current || killTriggeredRef.current) return;

   // After grace period
   if (!isRecordingRef.current || killTriggeredRef.current) {
     console.log('Kill signal: State changed during grace period, skipping check');
     return;
   }
   ```

3. Remove `isRecording` from `useCallback` dependencies (since we use the ref now)

---

## Implementation

```typescript
// Add ref for current recording state (after line 20)
const isRecordingRef = useRef(isRecording);
useEffect(() => {
  isRecordingRef.current = isRecording;
}, [isRecording]);

// Update checkMeetingStatusDirectly to use the ref
const checkMeetingStatusDirectly = useCallback(async () => {
  if (!meetingId || !isRecordingRef.current || killTriggeredRef.current) return;

  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Now correctly reads the CURRENT value
  if (!isRecordingRef.current || killTriggeredRef.current) {
    console.log('📡 Kill signal: State changed during grace period, skipping check');
    return;
  }

  // ... rest of the function
}, [meetingId]); // Removed isRecording from deps since we use ref
```

---

## Files to Change

1. **src/hooks/useMeetingKillSignal.ts** - Add isRecordingRef and use it in the callback

---

## Testing After Fix

1. Start a recording on the live site
2. Switch to another tab briefly
3. Switch back and immediately click "Stop Recording"
4. Verify the "Meeting Saved Successfully" dialog appears WITHOUT the "ended by server" toast

---

## Technical Notes

- Using a ref (`isRecordingRef.current`) always gives the **latest** value
- Using state in a closure (`isRecording`) gives the value **when the function was created**
- This pattern is already used in the same hook for `onKillSignalRef`
