

## Investigation Results: Recording Stopped on Its Own (Edge Browser)

### What Happened

Meeting `6194d489` on **Edge/Windows** was recording successfully — 15 chunks delivered every ~90–120 seconds from 07:27 to 07:52. Then the client silently stopped sending chunks. The meeting remains stuck in `recording` status with 3,595 words but **no whisper or assembly transcript text** (all stored in `meeting_transcription_chunks` only). Notes generation never triggered because the meeting never transitioned to `completed`.

**Root cause (most likely):** Microsoft Edge's "Sleeping Tabs" / efficiency mode suspended the tab or throttled timers, causing `MediaRecorder` to silently stop firing `ondataavailable` events and the chunked recording `setTimeout` loop to freeze. When this happens, no error event fires — the recording just stops silently.

### Existing Protections (already in code)

| Protection | Status |
|---|---|
| Wake Lock API | ✅ Acquired — prevents screen dimming but does NOT prevent Edge sleeping tabs |
| Track health monitoring (3s poll) | ✅ Active — but only detects `ended` tracks, not frozen timers |
| Visibility change handler | ✅ Active — recovers on tab re-focus, but doesn't help if user never returns |
| AudioContext resume on visibility | ✅ Active |
| Microphone recovery (3 attempts) | ✅ Active — only triggers on track `ended` event |
| Auto-close service (90 min) | ✅ Running — but meeting has "recent activity" so it's kept alive indefinitely |

### Gaps Identified

1. **No chunk delivery watchdog** — If chunks stop arriving (timer frozen by Edge), nothing detects it client-side
2. **Auto-close "recent activity" check is too generous** — it considers `updated_at` which gets bumped by any DB write, even the last chunk before the freeze
3. **No Edge-specific tab lifecycle handling** — Edge fires `freeze` and `resume` events (Page Lifecycle API) which are distinct from `visibilitychange`
4. **No server-side orphan detection** — A meeting in `recording` status with no new chunks for 15+ minutes is almost certainly dead, but the auto-close only checks the 90-minute window

### Plan: Reliability Improvements

#### 1. Add client-side chunk delivery watchdog (DesktopWhisperTranscriber)
- Track `lastChunkDeliveredAt` timestamp, updated each time `processAudioChunks` completes
- Every 60 seconds, check if >3 minutes have passed since last successful chunk delivery
- If stalled: log a warning, attempt to restart `MediaRecorder` (stop + start), and show a toast: "Recording may have stalled — attempting recovery"
- If recovery fails after 2 attempts: show persistent warning toast with "Save & Stop" action

#### 2. Add Edge Page Lifecycle API listeners (DesktopWhisperTranscriber)
- Listen for `freeze` event (Edge-specific) — log it and set a `frozenAt` timestamp
- Listen for `resume` event — when fired, check elapsed time since freeze; if >30s, trigger full recovery (restart MediaRecorder, re-acquire mic, flush audio)
- This catches Edge sleeping tabs that `visibilitychange` misses

#### 3. Improve auto-close edge function orphan detection
- Change "recent activity" check from using `updated_at` to checking the **most recent `meeting_transcription_chunks.created_at`** for that meeting
- If the latest chunk is older than 15 minutes AND the meeting has been in `recording` status for >20 minutes total, auto-close it and trigger note generation
- This catches orphaned meetings much faster than the current 90-minute window

#### 4. Add structured diagnostic logging
- Log `edge_recorder.chunk_watchdog_stall` with timestamps when chunk delivery stalls
- Log `edge_recorder.page_frozen` and `edge_recorder.page_resumed` with freeze duration
- Log `edge_recorder.recovery_attempt` with attempt number and outcome
- Log `edge_recorder.mediarecorder_state` periodically (every 5th chunk) showing MediaRecorder.state, track readyState, and AudioContext.state

### Technical Details

**Files to modify:**
- `src/utils/DesktopWhisperTranscriber.ts` — chunk watchdog, freeze/resume listeners, diagnostic logging
- `supabase/functions/auto-close-inactive-meetings/index.ts` — smarter orphan detection using chunk timestamps
- `src/hooks/useRecordingHealthMonitor.ts` — surface chunk watchdog warnings in the UI

**Immediate fix for the stuck meeting:** The user can click "Generate Meeting Notes" manually on meeting `6194d489` from the meeting history, or the auto-close will eventually catch it at the 90-minute mark.

