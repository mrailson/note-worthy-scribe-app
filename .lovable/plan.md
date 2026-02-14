

## Simplify Translation Speaker Switching and Fix Audio Playback Interference

### Problem 1: Confusing Speaker Switching

Currently, users must manually click between "Receptionist" and "Patient" buttons to switch who is speaking. This requires understanding the concept of "modes" and remembering to toggle before each person speaks. The current layout (two buttons flanking a mic button with badges) is cluttered and non-obvious.

**Solution: Auto-pause mic during speaker switch + single "walkie-talkie" style interaction**

Replace the two-button toggle with a clearer "turn-based" approach:
- Redesign `SpeakerModeSelector` to use a single, prominent **segmented toggle** (like a pill switch) instead of two separate buttons
- Add a clear visual indicator showing "Your turn" / "Patient's turn" with large, obvious colour coding
- When the user finishes speaking (confirmation shown), auto-suggest switching to patient mode with a single "Now let patient speak" button
- When patient speech is confirmed and sent, auto-switch back to staff mode
- Add a brief animated transition between modes so the switch is visually clear

### Problem 2: Audio Playback Feeds Back into Speech Recognition

When playing translated audio (TTS), the microphone picks up the speaker output and transcribes it into the English side, creating false entries.

**Solution: Pause speech recognition during audio playback**

- In `ReceptionTranslationView.tsx`, modify `playAudioForMessage` to **pause the mic** before playing audio and **resume it** when playback ends
- Use the existing `isMicPaused` mechanism (already implemented via `toggleMicPause`) to suppress recognition results during playback
- Set `isMicPausedRef.current = true` before `audio.play()` and restore it on `audio.onended` / `audio.onerror`
- This ensures no speech recognition results are processed while TTS audio is playing through the speakers

### Technical Changes

**File 1: `src/components/admin-dictate/SpeakerModeSelector.tsx`**
- Redesign to use a pill-style segmented control instead of two separate buttons
- Make the active mode much more visually prominent (larger text, bolder colour)
- Simplify the layout: remove the flanking badge slots, integrate the translation direction into the toggle itself
- Show a clear arrow/flow indicator: "English --> [Language]" or "[Language] --> English"

**File 2: `src/components/admin-dictate/ReceptionTranslationView.tsx`**

Audio playback fix:
- Add an `isPlayingAudioRef` ref to track playback state
- In `playAudioForMessage`, set `isMicPausedRef.current = true` before playing
- On `audio.onended` and `audio.onerror`, restore `isMicPausedRef.current = false`
- Also guard `onresult` handler: if `isPlayingAudioRef.current`, discard results

Auto-switch after send:
- In `handleConfirmSend`, after sending a staff message, auto-switch to patient mode
- After sending a patient message, auto-switch back to staff mode
- Add a brief delay (300ms) before the auto-switch so the user sees the sent message first

### UX Flow After Changes

```text
1. Staff clicks mic (starts listening in English)
2. Staff speaks -> confirmation appears
3. Staff clicks "Send" -> message sent, auto-switches to Patient mode
4. Patient speaks -> confirmation appears  
5. Staff clicks "Send" on patient's behalf -> auto-switches back to Staff mode
6. When audio plays, mic is temporarily muted (no feedback)
```

### Risk Assessment

- **Low risk**: The auto-switch is a UX convenience; manual switching still works
- **Audio pause is safe**: Uses the existing `isMicPaused` mechanism already proven stable
- **No backend changes**: All changes are frontend-only

