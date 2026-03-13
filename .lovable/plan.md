

## Two Training Mode Tweaks for Demo Flow

### What changes

**1. Skip auto-play audio for the consent/intro message (training mode only)**

In the auto-play `useEffect` (line 1144), when `isTrainingMode` is true, skip playing audio for the very first staff message (the consent confirmation "Translation service started. The patient has agreed to…"). This is detected by checking if the message is the first staff message in the conversation (index 0 or matching the intro text pattern).

**File:** `ReceptionTranslationView.tsx` ~line 1150
- Add a condition: if `isTrainingMode` and the new staff message's `originalText` starts with "Translation service started", skip the `playAudioForMessage` call.

**2. Show "typing…" indicator earlier, but delay the actual AI reply until 2s after TTS finishes**

The existing `waitForAudioThenReply` (line 1871) already waits for audio to finish + adds a 2-second pause. Two refinements:

- **Show the typing indicator sooner**: Currently `setIsTrainingReplyLoading(true)` is set at line 1894 *before* `waitForAudioThenReply` runs. Change the flow so the typing indicator appears ~3 seconds before the audio ends rather than after it ends. This means:
  - When auto-play is on, detect audio duration from `currentAudioRef.current.duration`
  - Set a timer to show `isTrainingReplyLoading = true` at `max(0, audioDuration - 3)` seconds after audio starts
  - The actual API call still waits for audio to finish + 2 seconds (keeping existing logic)

- **When auto-play is off**: Keep current behaviour (brief random delay).

**File:** `ReceptionTranslationView.tsx` ~lines 1869-1920
- Restructure the training reply block:
  1. Don't set `isTrainingReplyLoading` immediately
  2. Start a "typing indicator" timer based on audio duration minus 3 seconds
  3. Keep the existing poll-for-audio-end logic + 2s pause before calling the edge function

### Summary of file changes

| File | Change |
|------|--------|
| `ReceptionTranslationView.tsx` | Skip auto-play for intro message in training mode; show typing indicator 3s before audio ends; keep 2s post-audio delay before AI reply |

