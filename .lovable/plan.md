
Root cause: this is not mainly an Assembly accuracy problem. It is a session lifecycle problem.

What the code and logs show
- AssemblyAI is producing transcript text within seconds:
  - edge logs show early messages at 21:53:32–21:53:38 and again 21:53:52–21:54:01
  - examples include turn_order 0 and 1 with real transcript text, so audio + backend are working
- But the Assembly websocket is also being closed repeatedly:
  - many `Client WebSocket closed`
  - many `AssemblyAI WebSocket closed: 1005`
- In the UI screenshot, Deepgram has continuous text while Assembly says “Awaiting data…”, which matches “Assembly stream is getting torn down/restarted before enough text survives into the panel”.

Primary bug I found
- In `src/components/MeetingRecorder.tsx`, `stopRecording()` clears the live transcript buffers immediately:
  - `assemblyPreview.clearTranscript()`
  - `deepgramPreview.clearTranscript()`
- That happens before word-count validation and before the normal stop flow finishes.
- So if anything transient triggers stop/restart logic, the Assembly transcript state is wiped instantly.
- Separately, there are multiple Assembly start points in the recorder:
  - normal recording start
  - mode switch restart
  - unpause restart
- The logs strongly suggest Assembly is being restarted/closed too often, which explains why you only see some text after a long delay.

Secondary issue
- `LiveTranscriptGlassPanel` still prefers `recentFinals`, and Assembly only adds those when:
  - `end_of_turn` fires, or
  - `turn_order` changes, or
  - the 30s force-commit fires
- So even if partials are arriving, Assembly can still look sparse unless the panel is explicitly driven by current partial/full rolling text.

Implementation plan
1. Stabilize Assembly session ownership in `MeetingRecorder.tsx`
- Audit every `assemblyPreview.startPreview()` / `stopPreview()` path.
- Add guards so Assembly starts exactly once per recording lifecycle phase.
- Prevent accidental start-on-top-of-start and stop-on-nonterminal events.

2. Fix premature transcript wiping in `stopRecording()`
- Move `assemblyPreview.clearTranscript()` and `deepgramPreview.clearTranscript()` out of the beginning of stop flow.
- Only clear them after the meeting has fully ended/reset, not before validation/processing.
- This is likely causing “too short” and “missing transcript” side effects too.

3. Preserve Assembly transcript across reconnects/restarts
- In `useAssemblyRealtimePreview`, make restart/reconnect paths preserve transcript unless it is a true new meeting.
- Ensure partial state is not blanked in a way that makes the panel look empty during reconnect churn.

4. Make the panel show live Assembly progress, not just committed turns
- Update `LiveTranscriptGlassPanel` to prioritize:
  - current Assembly partial when present
  - otherwise recent finals
  - otherwise a rolling fallback derived from `assemblyFullTranscript`
- This prevents the “Awaiting data…” state while Assembly is actively returning partials.

5. Add targeted diagnostics for the churn source
- Add logs around:
  - preview start requested
  - preview skipped because already active
  - preview stop requested and why
  - reconnect vs fresh start
  - first partial received
  - transcript cleared and why
- This will identify whether the repeated closes are from pause/unpause, mode switching, or duplicate startup.

Files to update
- `src/components/MeetingRecorder.tsx`
- `src/hooks/useAssemblyRealtimePreview.ts`
- `src/components/recording-flow/LiveTranscriptGlassPanel.tsx`
- possibly `src/lib/assembly-realtime.ts` if additional reconnect hardening is needed

Expected result
- Assembly text should appear within a few seconds and remain visible continuously.
- You should no longer get the pattern of “nothing for a minute, then a little bit”.
- Transcript state will survive reconnects and won’t be wiped prematurely during stop logic.

Technical details
- Edge logs prove the backend is returning transcript deltas early, so the failure is client-side.
- The repeated websocket closures (`1005` / client closed) indicate session churn.
- The current panel design is biased toward committed turns, but Assembly’s useful output is often partial/full-turn accumulation before commit.
