

## Problem: Recording Stops When Navigating Away From Home Page

### Root Cause

The `MeetingRecorder` component is rendered **only** inside `Index.tsx`, which is mounted on the `/` route. When Amanda navigates to any other section of NoteWell (e.g., Ask AI at `/ai4gp`, Settings at `/settings`, NRES at `/nres`, Meeting History at `/meetings`), React Router unmounts the `Index` page — and with it the entire `MeetingRecorder`. The component's cleanup effects then stop the MediaRecorder, close audio streams, and terminate transcription.

The `RecordingContext` exists at the app level, but it only tracks **state** (a boolean flag and an AudioContext). The actual recording machinery — MediaRecorder, audio streams, transcribers — all live inside `MeetingRecorder` and are destroyed on unmount.

### Fix Strategy

**Lift the recording engine out of MeetingRecorder and into a persistent, app-level layer that survives route changes.**

### Implementation Steps

1. **Create `RecordingEngine` singleton service** (`src/services/RecordingEngine.ts`)
   - Holds MediaRecorder, audio streams, transcriber references, and backup recorder
   - Provides `start()`, `stop()`, `pause()`, `resume()` methods
   - Stores transcript accumulation, duration timer, and word count
   - Emits events (or exposes a subscription) for UI updates
   - Lives outside React — not destroyed by route changes

2. **Create `PersistentRecordingBanner` component** (`src/components/PersistentRecordingBanner.tsx`)
   - Rendered in `App.tsx` **above** `<Routes>`, so it persists across all pages
   - When a recording is active, shows a compact floating banner: "Recording in progress — 12:34 — 847 words — [Return] [Stop]"
   - "Return" navigates back to `/` to see the full recorder UI
   - "Stop" triggers stop with the existing confirmation flow
   - Only visible when `isRecording === true` and current route is **not** `/`

3. **Enhance `RecordingContext`** to bridge the engine and UI
   - Add references to the singleton engine
   - Expose transcript, duration, word count as reactive state
   - `MeetingRecorder` reads from and writes to the engine instead of owning the resources directly

4. **Add navigation guard**
   - When recording is active and user clicks a nav link, show a warning: "Recording will continue in the background. You can return to the home page to see the full view."
   - This replaces the current silent kill behaviour

5. **Prevent unmount cleanup during active recording**
   - As a safety net, the `MeetingRecorder` cleanup effects should check `RecordingEngine.isActive` and skip teardown if recording is ongoing — the engine owns the resources now

### Scope and Risk

This is a significant architectural change. The `MeetingRecorder` component is ~8,000 lines and deeply couples UI with recording logic. A full extraction is high-risk for a single iteration.

**Recommended phased approach:**

- **Phase 1 (quick win)**: Add a navigation blocker that prevents leaving `/` while recording, with a confirmation dialog. This immediately stops the accidental-stop problem.
- **Phase 2 (full fix)**: Extract recording engine into a persistent service for true background recording across routes.

### Technical Details

**Phase 1 — Navigation Blocker (recommended to ship first)**

- Use React Router's `useBlocker` or `usePrompt` (v6) / `<Prompt>` to intercept navigation while `isRecording` is true
- Show a dialog: "You have an active recording. Leaving this page will stop the recording. Stay on page / Leave and stop"
- Modify `MeetingRecorder.tsx` to add the blocker near the existing `beforeunload` handler
- Optionally add a small red recording indicator dot to the `Header` component so users see recording state from any page

**Phase 2 — Persistent Recording Engine (follow-up)**

- Extract `MediaRecorder`, stream management, and transcription into `RecordingEngine.ts`
- Wire `PersistentRecordingBanner` into `App.tsx`
- Refactor `MeetingRecorder` to delegate to the engine

