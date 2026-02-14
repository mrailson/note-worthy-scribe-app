

## Translation Service Improvements Based on User Feedback

The feedback confirms the translation and transcription quality is excellent -- the two practical issues are:

1. **Speakers need to talk slowly** -- the silence threshold (wait time before processing) may be too short for natural pauses in non-English speech, causing mid-sentence cuts.
2. **Speaker needs to be close to the microphone** -- we can enable browser audio enhancements (auto gain control, noise suppression) and surface clear guidance to users.

---

### Proposed Changes

#### 1. Enable Auto Gain Control and Noise Suppression on Microphone

Currently, `useGPTranslation` requests microphone access with bare `{ audio: true }`. Enabling `autoGainControl`, `noiseSuppression`, and `echoCancellation` will let the browser amplify quieter speech and reduce background noise -- meaning users won't need to be as close to the microphone.

**File:** `src/hooks/useGPTranslation.tsx`
- Change `getUserMedia({ audio: true })` to include enhanced constraints:
  ```
  { audio: { autoGainControl: true, noiseSuppression: true, echoCancellation: true } }
  ```

#### 2. Increase Default Silence Threshold

The current default is 2000ms (2 seconds). For speakers who need to pause mid-sentence (common in non-English speech or when thinking), this is too aggressive. Increase the default to 3000ms (3 seconds) to give more breathing room.

**File:** `src/hooks/useGPTranslation.tsx`
- Change default `silenceThreshold` from `2000` to `3000`.

**File:** `src/pages/GPTranslationService.tsx`
- Change initial `silenceThreshold` state from `2000` to `3000`.

#### 3. Add "Tips for Best Results" to the Consent/Setup Screen

Add a small, friendly tips section on the consent screen so users know what to expect before starting.

**File:** `src/components/translation/ConsentScreen.tsx`
- Add a tips card with guidance such as:
  - "Hold the device close to the speaker or use a headset"
  - "Speak clearly at a steady pace"
  - "Pause briefly between sentences"
  - "Use the Wait Time slider to allow longer pauses"
  - "Tap 'Send Now' if the system hasn't picked up your speech"

#### 4. Add Gujarati to the Speech Recognition Locale Map (if missing)

Gujarati (`gu`) is not currently in the `SPEECH_RECOGNITION_LOCALES` map. Adding `gu: 'gu-IN'` will ensure Chrome uses the correct speech model for Gujarati speakers.

**File:** `src/hooks/useGPTranslation.tsx`
- Add `gu: 'gu-IN'` to the `SPEECH_RECOGNITION_LOCALES` record.

---

### Technical Summary

| Change | File | Detail |
|--------|------|--------|
| Enhanced mic constraints | `useGPTranslation.tsx` | Add `autoGainControl`, `noiseSuppression`, `echoCancellation` |
| Increase default wait time | `useGPTranslation.tsx`, `GPTranslationService.tsx` | 2s to 3s |
| Add Gujarati locale | `useGPTranslation.tsx` | `gu: 'gu-IN'` |
| Add usage tips | `ConsentScreen.tsx` | Friendly guidance card on setup screen |

