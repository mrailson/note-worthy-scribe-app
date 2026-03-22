
Problem confirmed: AssemblyAI is not actually “dead” on the backend. The logs show it is receiving audio and returning transcript messages almost immediately.

What the logs say
- Assembly proxy is healthy:
  - `21:46:30 ✅ AssemblyAI WebSocket connected`
  - frequent `📡 Audio streaming: 50 frame(s), 156.3 KB in last 5s`
  - transcript messages start within seconds:
    - `21:46:35 msg #3 ... transcript:"In"`
    - `21:46:41 msg #20 ... transcript:"In what would cost initially..."`
    - `21:47:26 ... end_of_turn:true ...`
- So AssemblyAI is producing text early, not only after a minute.

Likely root cause in the app
1. Early connection churn
- The edge logs also show multiple rapid open/close cycles around `21:46:13–21:46:29` with `Client WebSocket closed`, `Received terminate signal`, and `AssemblyAI WebSocket closed: 1005`.
- That suggests the client starts/stops/restarts Assembly several times at recording start, so the first usable stream may be getting interrupted.

2. UI hides Assembly when there are no finals yet
- `LiveTranscriptGlassPanel` “All” view only renders:
  - `recentFinals`
  - `currentPartial`
- For Assembly, the visible block in debug mode uses:
  - `lines={recentFinals}`
  - `partial={currentPartial}`
- If the client reconnects or clears partials during startup, Assembly can look blank even though backend messages are arriving.
- Deepgram/Whisper appear because they render differently from full transcript text.

3. One possible client logic bug to verify/fix
- In `AssemblyRealtimeClient.start()`, after startup succeeds:
  - `this.isReconnecting = false;`
  - then code checks `if (this.isReconnecting) ... else onOpen`
- That means the reconnected path can never call `onReconnected`.
- This may leave the hook/UI in the wrong state after startup churn.

Implementation plan
1. Stabilize startup
- Inspect and tighten the recording-start flow in `MeetingRecorder.tsx` so Assembly preview is started exactly once per recording start.
- Prevent redundant stop/start cycles during initial mixer setup and early stream replacement.

2. Fix reconnect state handling in `src/lib/assembly-realtime.ts`
- Preserve whether the connection is a fresh start vs reconnect before zeroing flags.
- Ensure `onReconnected` actually fires after successful reconnects.

3. Make Assembly visible even before first final
- Update `LiveTranscriptGlassPanel` so the Assembly section can display a fallback from `assemblyPreview.fullTranscript` when `recentFinals` is empty.
- In “All” mode, show the latest Assembly partial/full text more explicitly during the first minute so it does not look empty.

4. Add better startup diagnostics
- Add targeted client logs for:
  - preview start requested
  - preview stopped
  - reconnect initiated/completed
  - first partial received
  - first final received
- This will distinguish “backend has no text” from “UI is not showing it”.

5. Verify likely cause of the screenshot behavior
- Your screenshot shows:
  - AssemblyAI: “Awaiting data…”
  - Deepgram and Whisper with text
- That is consistent with “Assembly partial/final state not being surfaced in the panel yet,” not with AssemblyAI failing server-side.

Files to update
- `src/lib/assembly-realtime.ts`
- `src/hooks/useAssemblyRealtimePreview.ts`
- `src/components/recording-flow/LiveTranscriptGlassPanel.tsx`
- possibly `src/components/MeetingRecorder.tsx` if duplicate startup is confirmed

Expected outcome
- Assembly text should appear within the first few seconds, not seem blank for the first minute.
- Reconnects should recover cleanly without losing visible transcript state.
- The panel should show Assembly progress even before a formal final turn arrives.

Technical notes
- Edge logs prove AssemblyAI is returning transcript deltas early, including `turn_order` 0/3/4 and later `end_of_turn:true`.
- Therefore the remaining issue is almost certainly client startup/reconnect/UI presentation rather than the Assembly service itself.
