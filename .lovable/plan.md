
Diagnosis:
- Yes, the right direction is to use the existing Dictate pattern, not the current Meeting preview reconnection stack.
- The repeating failure is not really the `vendor.js` / `tabs:outgoing.message.ready` noise — those look like extension/runtime noise.
- The real problem is that `MeetingRecorder` uses `useAssemblyRealtimePreview`, which adds a second reconnect/dispose layer around `AssemblyRealtimeClient`.
- Dictate is more stable because it uses a single `AssemblyRealtimeClient` instance directly and lets that client own reconnects.

Recommendation:
- Do not literally plug `useAdminDictation` into meetings — that hook also brings admin drafts, formatting, templates, and admin-specific persistence.
- Instead, replace the internals of `useAssemblyRealtimePreview` with the same AssemblyAI session lifecycle used by Dictate: one client instance, direct callbacks, no hook-level client recreation.

Implementation plan:
1. Simplify `src/hooks/useAssemblyRealtimePreview.ts`
   - Remove the outer `attemptReconnect()` loop, reconnect timeout orchestration, and `dispose()`-based client handoff.
   - Keep the public API the same (`startPreview`, `stopPreview`, `clearTranscript`, `fullTranscript`, `recentFinals`, `currentPartial`, `status`, `error`, `isActive`) so `MeetingRecorder` and `useScribeRecording` still work.
   - Wire callbacks exactly like Dictate:
     - `onOpen` → set `recording`
     - `onPartial` → update `currentPartial` + combined preview
     - `onFinal` → append/replace deduped final text
     - `onReconnecting` / `onReconnected` → just update status
     - `onError` → only surface fatal errors instead of spawning a second client

2. Preserve Meeting-specific features inside the simplified hook
   - Keep `externalStream` support for mixed mic+system audio.
   - Keep `keyterms`.
   - Keep `preserveTranscript` for pause/resume.
   - Keep the transcript backup flush to the `meetings` table if needed.

3. Keep `src/components/MeetingRecorder.tsx` mostly as-is
   - Continue the new mic-only path (`startPreview(undefined, ...)`) and the mixed-stream path when system audio exists.
   - Do not add any extra reconnect logic there; let the client own it.
   - Keep Whisper and Deepgram as independent fallback/parallel engines.

4. Clean up `src/lib/assembly-realtime.ts` usage assumptions
   - Stop depending on `dispose()` for preview recovery.
   - If `dispose()` is no longer needed anywhere, remove it later; otherwise leave it isolated and unused by the preview hook.
   - Keep internal reconnect behavior as the only reconnect owner.

Why this should work better:
- It matches the already-working Dictate lifecycle.
- It removes the race between:
  - client-internal reconnect, and
  - hook-level “kill and recreate the client” reconnect.
- It avoids passing stale stream references into `createMediaStreamSource(...)`.

Technical note:
```text
Current failing stack:
MeetingRecorder -> useAssemblyRealtimePreview -> AssemblyRealtimeClient
                                   |
                            second reconnect layer
                                   |
                     dispose old client / recreate new client
                                   |
                   stale stream / closed context / MediaStream errors

Planned stack:
MeetingRecorder -> simplified preview hook -> AssemblyRealtimeClient
                                              |
                                      single reconnect owner
```

Files to change:
- `src/hooks/useAssemblyRealtimePreview.ts` (main refactor)
- Possibly minor cleanup in `src/lib/assembly-realtime.ts`
- Likely no or only tiny changes in `src/components/MeetingRecorder.tsx`

QA to run after implementation:
- Desktop mic-only recording with AssemblyAI preview
- Desktop mic + system audio recording
- Pause/resume with `preserveTranscript`
- Temporary proxy close / 1011 recovery
- Verify Whisper and Deepgram still continue independently
- Verify no duplicate AssemblyAI text in the live panel
