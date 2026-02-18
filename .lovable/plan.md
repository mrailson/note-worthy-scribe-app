

## Fix: setState-during-render warning and recording stability

### Problem 1: setState called during render (causes unpredictable behaviour)

The `onDurationUpdate(timeString)` call (which sets parent `Index` state) is being called **inside** `setDuration`'s updater function in two places (lines ~3856 and ~4468). When React batches state updates, this can trigger a parent re-render during the child's render cycle, producing the "Cannot update a component while rendering a different component" warning. This can cause unpredictable state resets during recording.

### Problem 2: Random recording stop

The console logs show repeated `GET / 404`, `GET / 412 (Precondition Failed)`, and `WebSocket connection failed` errors. This happens when **Lovable pushes a code change while you are recording** -- Vite's hot module replacement reloads the page/component, destroying all recording state. This is an editor-related issue rather than a code bug. However, we can add resilience against it.

### Fix Plan

**Step 1: Fix setState-during-render in duration timer (2 locations)**

In both `setInterval` callbacks (lines ~3850-3858 and ~4462-4485), move `onDurationUpdate()` outside the `setDuration` updater:

```typescript
// BEFORE (broken):
setDuration(prev => {
  const newDuration = prev + 1;
  const timeString = `${mins}:${secs}`;
  onDurationUpdate(timeString);  // <-- triggers parent setState during child setState
  return newDuration;
});

// AFTER (fixed):
setDuration(prev => prev + 1);
// Duration effect will handle the parent update
```

Then add a `useEffect` that syncs duration to the parent:

```typescript
useEffect(() => {
  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;
  const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  onDurationUpdate(timeString);
}, [duration, onDurationUpdate]);
```

This ensures the parent's `setDuration` is called in an effect (after render), not during render.

**Step 2: Move early word count display logic out of the updater**

The early word count display at lines ~4471-4481 also calls `setEarlyWordCountValue` and `setShowEarlyWordCount` inside `setDuration`'s updater. Move this to the same `useEffect`.

**Step 3: Fix `<p>` nesting warning in StopRecordingConfirmDialog**

Change the `AlertDialogDescription` content to use `<div>` or `<span>` instead of block-level elements nested inside the `<p>` tag that `AlertDialogDescription` renders.

### What this does NOT fix

The random stop caused by Lovable's editor rebuilding/reloading during recording is an infrastructure limitation -- when code changes are deployed, the preview page reloads. **This only happens when editing code in Lovable while recording.** On the published site (`meetingmagic.lovable.app`), this cannot occur. To avoid it during testing, use the published URL rather than the preview.

