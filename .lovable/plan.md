
# Plan: Prevent "Start Recording" Button During Post-Meeting Processing

## Problem
When a meeting ends, there is a brief window (2-3 seconds) where the "Start Recording" button becomes clickable behind the "Meeting Saved Successfully" modal. This happens because `isStoppingRecording` is set to `false` and `isRecording` is set to `false` after `resetMeeting()` completes, but before the user has acknowledged the post-meeting modal. This is confusing — users may think the system is ready for a new meeting when note generation is still in progress.

## Root Cause
The recording stop flow works like this:

1. `stopRecording()` sets `isStoppingRecording = true` (button hidden)
2. Meeting data is saved to the database
3. The post-meeting modal opens (`setShowPostMeetingActions(true)`)
4. Background processing calls `resetMeeting()` and `setIsStoppingRecording(false)`
5. At this point, `!isRecording` is `true` and `isStoppingRecording` is `false` -- the "Start Recording" button becomes fully enabled
6. Meanwhile, notes are still being generated in the background

The "Start Recording" button (line 6314) only checks `!isRecording` and has no awareness of whether the post-meeting modal is still open or notes are still generating.

## Solution
Disable the "Start Recording" button whenever the post-meeting actions modal is open (`showPostMeetingActions === true`). This is the simplest, most reliable guard because:

- It covers the entire period from meeting end through note generation
- It naturally clears when the user explicitly dismisses the modal or clicks "Start New Meeting"
- It follows the existing `useRef` pattern recommended for preventing stale closures

## Technical Details

### File: `src/components/MeetingRecorder.tsx`

**Change 1 — Disable the "Start Recording" button when the post-meeting modal is showing**

At the "Start Recording" button (around line 6318), add a `disabled` prop:

```tsx
<Button
  onClick={startRecording}
  size="lg"
  disabled={showPostMeetingActions}
  className="bg-gradient-to-r from-primary to-primary/90 ..."
>
  <Mic className="h-5 w-5 mr-2" />
  Start Recording
</Button>
```

**Change 2 — Guard the `startRecording` function itself**

As an additional safety measure, add an early return at the top of the `startRecording` function to prevent recording from starting if the post-meeting modal is still open. This uses a `useRef` to avoid stale closure issues (following the project's established pattern):

```tsx
// New ref to track post-meeting modal state
const showPostMeetingActionsRef = useRef(false);

// Keep ref in sync with state
useEffect(() => {
  showPostMeetingActionsRef.current = showPostMeetingActions;
}, [showPostMeetingActions]);

// Inside startRecording function, add at the top:
if (showPostMeetingActionsRef.current) {
  console.log('Cannot start recording while post-meeting modal is active');
  return;
}
```

**Change 3 — Also guard the compact mic button (around line 6696)**

The compact microphone button also needs the same `disabled` guard:

```tsx
<button
  type="button"
  onClick={onMicButtonClick}
  disabled={isStoppingRecording || showPostMeetingActions}
  ...
>
```

These three changes together ensure the button is both visually disabled and functionally blocked during the entire post-meeting processing window.
