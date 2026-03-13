

## Two Fixes for Training Mode

### Issue 1: Double-send on accidental repeat click
**Root cause**: `handleConfirmSend` (line 1836) checks `if (pendingTranscript)` but doesn't guard against concurrent calls. Two rapid clicks both see `pendingTranscript` as truthy before either clears it.

**Fix**: Add an `isSendingRef` guard at the top of `handleConfirmSend`. Set it `true` immediately, clear it at the end. Return early if already sending.

```typescript
const isSendingRef = useRef(false);

const handleConfirmSend = useCallback(async () => {
  if (!pendingTranscript || isSendingRef.current) return;
  isSendingRef.current = true;
  // ... existing logic ...
  // At the very end (after training reply kickoff or speaker switch):
  isSendingRef.current = false;
}, [...]);
```

### Issue 2: Patient reply appears before audio finishes
**Root cause**: The `waitForAudioThenReply` starts checking audio 1 second after send (line 1903), but the auto-play itself only starts after a 500ms delay (line 1156). If the TTS fetch takes a moment, the audio element may not exist yet when the check runs, so `!audio` evaluates true, the promise resolves immediately, and the AI reply fires before audio even starts.

**Fix**: Increase the initial delay before polling from 1000ms to 2000ms, AND add a retry count so it waits for audio to *begin* (not just check once and give up). Specifically:
- Start checking after 2000ms (giving auto-play time to fetch and start)
- If no audio element exists yet, retry up to 10 times (3 seconds) before giving up
- Only resolve when audio has actually ended

```typescript
setTimeout(checkAudio, 2000); // was 1000

// Inside checkAudio:
if (!audio || audio.paused || audio.ended) {
  // If audio hasn't started yet, wait longer (up to ~5s total)
  if (!audioHasEverPlayed && retryCount < 10) {
    retryCount++;
    setTimeout(checkAudio, 500);
    return;
  }
  // Audio finished or never started after retries
  ...
}
```

Track `audioHasEverPlayed` by also checking `audio.currentTime > 0` or on the playing path setting a flag.

### Files changed
| File | Change |
|------|--------|
| `ReceptionTranslationView.tsx` | Add `isSendingRef` guard to prevent double-send; fix `waitForAudioThenReply` to wait for audio to actually start before polling for end |

