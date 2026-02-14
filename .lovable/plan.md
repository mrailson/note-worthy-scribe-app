

## Fix: "Mic + System Audio" Reverting to "Mic" Immediately

### Root Cause

There are **two issues** causing the mode to revert:

**1. Competing state ownership (primary cause)**

`MeetingMicrophoneSettings` component has its **own independent** `audioSourceMode` state inside `useMeetingMicrophoneSettings()` hook, which always initialises to `'microphone'`. A `useEffect` syncs this to the parent MeetingRecorder via `onAudioSourceChange`. 

When `switchAudioSourceLive` updates `audioSourceMode` to `'microphone_and_system'` in MeetingRecorder, any re-render that touches `MeetingMicrophoneSettings` causes its `useEffect` to fire and push its own `'microphone'` value back into the parent -- immediately overwriting the switch.

**2. Aggressive `mute` event handling (secondary cause)**

In `buildAssemblyAudioStream.ts`, the `handleMute` listener on system audio tracks treats **any** `mute` event as permanent audio loss and immediately calls `onSystemAudioLost()`. Screen share audio tracks can fire transient `mute` events during setup or when the shared tab has no audio playing momentarily. This causes a premature fallback.

### Solution

**File 1: `src/components/MeetingRecorder.tsx`**
- Pass the current `audioSourceMode` value **down** to `MeetingMicrophoneSettings` so it stays in sync with the parent
- Or: remove the `onAudioSourceChange` sync effect from `MeetingMicrophoneSettings` and instead have it call the parent's setter directly only on user-initiated changes (not on mount/re-render)

The cleanest approach: add a `currentAudioSource` prop to `MeetingMicrophoneSettings` and use it to initialise/sync the hook's internal state, preventing the mount-time overwrite.

**File 2: `src/components/meeting/MeetingMicrophoneSettings.tsx`**
- Accept a `currentAudioSource` prop
- Sync internal state from parent when the prop changes (rather than pushing internal state to parent on every render)

**File 3: `src/hooks/useMeetingMicrophoneSettings.ts`**
- Accept an optional `initialAudioSource` parameter so the hook can initialise with the correct value instead of always defaulting to `'microphone'`

**File 4: `src/utils/buildAssemblyAudioStream.ts`**
- Replace the immediate `handleMute` -> `onSystemAudioLost` trigger with a **grace period** (e.g. 3 seconds)
- If `unmute` fires within the grace period, cancel the fallback
- This prevents transient silence from killing the system audio session

### Technical Details

**State sync fix (Files 1-3):**

```text
MeetingRecorder (audioSourceMode) 
    |
    v (pass down as prop)
MeetingMicrophoneSettings (currentAudioSource prop)
    |
    v (initialise hook with it)
useMeetingMicrophoneSettings(initialAudioSource)
    |
    v (only call onAudioSourceChange on USER clicks, not on mount)
```

- The `useEffect` that currently syncs `audioSourceMode` on every render will be changed to only fire when the user explicitly selects a different source via `selectAudioSource()`
- The hook will accept the parent's current value as the initial state

**Mute grace period fix (File 4):**

- Add a `muteGraceTimeout` that waits 3 seconds after `mute` before calling `onSystemAudioLost`
- Listen for `unmute` events to cancel the timeout if audio resumes
- Keep the `ended` event as an immediate trigger (since `ended` means the track is truly gone)

### Risk Assessment

- **Low risk**: Both changes are isolated to the audio source state management
- **No API changes**: All existing functionality preserved
- **Backwards compatible**: Default behaviour remains mic-only on fresh start
