

# Simplify Mobile Recording UI

## Goal
On mobile (< 768px), strip the recording stage down to a minimal "record and stop" experience. Remove all context-editing UI during recording since mobile users will fix up meetings later.

## Changes

### 1. `src/components/recording-flow/LiveContextStatusBar.tsx`
- Import `useIsMobile` from `@/hooks/use-mobile`
- When `isMobile` is true, hide:
  - The "Edit Context" button
  - The "Stop" button (the stop button exists elsewhere in the recorder controls)
  - The Agenda status pill
  - The entire 3-column quick action cards grid (Edit Attendees, Add Agenda, Screenshot)
- Keep visible on mobile: REC badge with timer, word count / live transcript panel, and the avatar stack (lightweight context)

### 2. `src/components/recording-flow/RecordingFlowOverlay.tsx`
- Import `useIsMobile`
- When `isMobile` is true and stage is `'setup'`, skip rendering `<PreMeetingSetup>` entirely — go straight to a simple "Start Recording" button so the user doesn't need to set up attendees or agenda on phone
- The recording stage and done stage remain (with the slimmed-down status bar from change 1)

### Technical notes
- Uses the existing `useIsMobile()` hook (breakpoint 768px) — no new dependencies
- Desktop experience is completely unchanged
- The stop button still needs to be accessible on mobile — will verify it exists in the recorder controls (`children` rendered below the status bar). If not, a minimal stop button will be kept.

