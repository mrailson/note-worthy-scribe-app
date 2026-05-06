## Why the current behaviour is poor

The mic is wired to the AssemblyAI realtime client, which routes audio through a Supabase Edge Function WebSocket proxy. The console logs show:

- ~2 seconds for the proxy + AssemblyAI session to begin sending audio
- Only **1 partial** returned across a 7-second utterance
- Final commit only fires on `end_of_turn`, so text appears in chunks (e.g. "Nicholas Den—") rather than word-by-word
- All audio is upsampled/encoded/sent over the network — adds 300–800ms latency per partial

For a small notes field on a fast laptop, this is the wrong tool. The browser's native Web Speech API runs locally (on Chromium it streams to Google's STT direct from the browser), returns interim results every ~150ms, and starts in well under a second.

## Plan

### 1. Replace AssemblyAI with native Web Speech API for the notes mic

In `src/pages/NRESTimeTracker.tsx`:

- Remove the `AssemblyRealtimeClient` import and the realtime client/refs added in the previous turn.
- Use the existing `BrowserSpeechRecognition` wrapper at `src/utils/BrowserSpeechRecognition.ts` (already used elsewhere in the project, configured for `en-GB`, continuous, interim results, auto-restart).
- New behaviour:
  - Click mic → `startRecognition()` immediately (mic permission already prompted on first use; subsequent starts are instant).
  - Capture `notesBaseRef` = current notes text at start.
  - On every interim result, set `notes = base + " " + interimAggregate` so the user sees words appear as spoken.
  - On final result, append the final segment to `notesBaseRef` and clear interim.
  - Click mic again → `stopRecognition()` and commit any trailing interim into the notes value.
- Keep the existing discreet pill button (red pulse when active, slate when idle) inside the input's right edge.

### 2. Graceful fallback

If `BrowserSpeechRecognition.isSupported()` returns false (e.g. Firefox, Safari desktop), show a one-line toast: "Voice input requires Chrome or Edge" and disable the button. No silent failure.

### 3. Smoothness details

- Debounce React state updates is unnecessary — Web Speech fires interim updates at a sensible cadence already.
- Show a subtle pulsing ring on the mic button while listening (already in place).
- Auto-stop after 60 seconds of silence to avoid runaway sessions (the wrapper already restarts on `onend` while `isListening` is true; we add a silence watchdog by tracking the last result timestamp).

## Technical notes

- File touched: `src/pages/NRESTimeTracker.tsx` only.
- No edge function changes, no new dependencies.
- The AssemblyAI realtime client stays available for the meeting recorder where its accuracy + diarisation matter — we just stop using it for the lightweight notes field.
- British English spelling throughout (`en-GB` locale already set in the wrapper).
