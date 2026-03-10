

## Root Cause Analysis: "Meeting too short" on rapid stop-then-start

### The Smoking Gun

In `MeetingRecorder.tsx`, when a short meeting is stopped (< 100 words), the `stopInProgressRef.current = false` reset happens inside a `setTimeout(() => { ... }, 0)` callback (line 4819-4825). This means:

1. User stops Meeting A on mobile
2. `stopRecording()` runs, hits the `effectiveWords < 100` branch
3. `setIsRecording(false)` happens synchronously (line 4777)
4. But `stopInProgressRef.current = false` is deferred to a microtask via `setTimeout`
5. User immediately starts Meeting B
6. `startRecording()` passes its guards (line 4196: `isRecording` is already `false`, `isStartingRecordingRef` is `false`)
7. Meeting B's database record is created
8. **Meanwhile**, the deferred `setTimeout` from step 4 fires, calling `resetMeeting()` which sets `isRecording = false` again, clears transcript state, and resets everything -- potentially wiping Meeting B's in-progress state
9. Worse: the `await Promise.all(deletePromises)` at lines 4792-4810 **deletes the meeting record and all transcript chunks** for `capturedMeetingId`. If Meeting B was created fast enough, the deletion and the new meeting's early chunks could collide on shared state.

Additionally, `startRecording()` does **not** check `stopInProgressRef.current`. So even for longer meetings where stop is still processing (3-second audio drain delay at line 4842), a user can start a new meeting while the old one is still being finalized.

### The Fix

Two changes in `MeetingRecorder.tsx`:

1. **Guard `startRecording` against in-progress stops**: Add a check at the top of `startRecording()` for `stopInProgressRef.current`. If a stop is still in progress, either block the start or wait for it to complete.

2. **Make the short-meeting cleanup synchronous before allowing new starts**: Move `stopInProgressRef.current = false` out of the `setTimeout` and ensure `resetMeeting()` completes before the ref is cleared. Alternatively, `await` the cleanup inline rather than deferring it.

### Proposed Code Changes

**In `startRecording()` (~line 4196):**
```typescript
// NEW: Block start while a stop operation is still finalizing
if (stopInProgressRef.current) {
  console.log('⚠️ Stop still in progress, cannot start new recording yet');
  showToast.warning('Please wait — previous recording is still saving...', {
    section: 'meeting_manager',
    duration: 3000,
  });
  return;
}

if (isStartingRecordingRef.current || isRecording) {
  ...
}
```

**In the short-meeting branch (~line 4817-4826):**
Replace the `setTimeout` wrapper with a synchronous `await`:
```typescript
// Was: setTimeout(async () => { ... }, 0)
try {
  await resetMeeting();
} finally {
  setIsStoppingRecording(false);
  stopInProgressRef.current = false;
}
```

This ensures the stop operation fully completes (including state resets) before `stopInProgressRef` is cleared, which in turn prevents `startRecording` from running concurrently.

### Impact

- Fixes Julia's scenario: rapid stop-then-start on mobile where the new meeting's transcript was being wiped by the deferred cleanup of the previous (short) meeting
- No UX regression -- user gets a brief "please wait" toast if they tap too fast, then can start normally

