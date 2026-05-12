# GPT-Realtime-Whisper — Connection Speed-up & Status Indicator Plan

Scope: Dictate service only. Do NOT modify `assemblyai.ts`, `deepgram.ts`,
batch `whisper.ts`, or the AssemblyAI / Deepgram code paths in the Dictate
component. Targeted edits only — no file regeneration.

Files in play:
- `src/services/transcription/gptRealtimeWhisper.ts` (provider)
- Dictate component (active-service handling) — `src/hooks/useAdminDictation.ts`
  and `src/components/ai4gp/AdminDictateServiceToggle.tsx` plus the parent
  Dictate UI component that renders the Start button (locate by searching
  for `useAdminDictation` consumers).

---

## STEP 1 — Pre-warm when the GPT-Realtime-Whisper pill is selected

Trigger: `useEffect` keyed on `activeService === 'gpt-realtime-whisper'`.

Run three actions in parallel:

1. **Pre-fetch ephemeral token**
   - `POST /functions/v1/openai-realtime-whisper-token`
     (current function name in repo is `gpt-realtime-whisper-token` — confirm
     and use whichever exists; do not rename).
   - Store `{ token, fetchedAt }` in a `useRef`.
   - If the user takes >60s before clicking Start, refetch on click.

2. **Pre-load AudioWorklet**
   - `const ctx = new AudioContext();`
   - `await ctx.audioWorklet.addModule('/worklets/pcm16-encoder.js');`
   - Store `ctx` in a ref for reuse.

3. **Check microphone permission (no prompt)**
   - `navigator.permissions.query({ name: 'microphone' as PermissionName })`
   - Do NOT call `getUserMedia` here — needs the Start gesture.

Cleanup: when `activeService` changes away from `gpt-realtime-whisper`,
close the AudioContext, null the token ref, and abort any in-flight
token fetch (AbortController).

---

## STEP 2 — Refactor `GptRealtimeWhisperProvider` for parallel startup

In `src/services/transcription/gptRealtimeWhisper.ts`:

a) Signature:
   ```ts
   connect(
     stream: MediaStream,
     options?: { ephemeralKey?: string; audioCtx?: AudioContext }
   ): Promise<void>
   ```

b) If `options.ephemeralKey` is provided, skip `/sessions` fetch and open
   the WebSocket immediately.

c) Open the WebSocket in parallel with mic acquisition (caller already
   owns `getUserMedia`; do NOT await mic before opening WS inside connect).

d) Add `onReady?: () => void`. Internal flags:
   - `sessionConfirmed` — set on `transcription_session.updated`
   - `workletWired` — set when worklet node is connected and piping to WS
   Emit `onReady()` exactly once when both become true.

e) Add `onStateChange?: (s: State) => void` where
   `State = 'idle' | 'connecting' | 'ready' | 'listening' | 'error'`.
   Transitions:
   - `idle → connecting` on `connect()`
   - `connecting → ready` when onReady fires
   - `ready → listening` on first audio frame sent
   - `* → error` on error
   - `* → idle` on `disconnect()`

Keep existing `onPartial` / `onFinal` wiring untouched.

---

## STEP 3 — Status indicator UI (Dictate only)

Render only when `activeService === 'gpt-realtime-whisper'`. Place 8px
above the Start button.

Layout: horizontal flex, 8px gap, 13px text. 12px circular dot + label.

| State       | Dot colour | Animation        | Label                          |
|-------------|------------|------------------|--------------------------------|
| idle        | grey       | static           | Ready to start                 |
| connecting  | amber      | pulse 1.4s       | Connecting…                    |
| ready       | green      | static           | Ready — speak now              |
| listening   | red        | pulse 1.4s       | Listening · MM:SS              |
| error       | red        | static           | Connection failed — try again  |

Pulse keyframes: opacity 1 → 0.4 → 1, 1.4s, ease-in-out, infinite. Add
to `tailwind.config.ts` if not already present (e.g. `animate-soft-pulse`).

Timer (MM:SS, no seconds-only formatting elsewhere — British format,
hours/minutes only per project rule; here MM:SS is acceptable as it is
an elapsed timer, not a clock time).

On `ready` transition, one-shot 600ms green box-shadow glow on the
textarea (CSS transition on `box-shadow`, then clear). No keyframe
animation.

AssemblyAI / Deepgram UI unchanged.

---

## STEP 4 — Button state coupling (gpt-realtime-whisper only)

| State       | Label                | Disabled | Style                    |
|-------------|----------------------|----------|--------------------------|
| idle        | Start Transcribing   | no       | default                  |
| connecting  | Connecting…          | yes      | spinner icon             |
| ready       | Speaking — Stop      | no       | red border (outline)     |
| listening   | Stop                 | no       | red filled (destructive) |
| error       | Try Again            | no       | default                  |

Other engines: existing behaviour preserved.

---

## STEP 5 — Wiring on Start click (gpt-realtime-whisper)

1. `const stream = await navigator.mediaDevices.getUserMedia({ audio: true });`
2. If `Date.now() - tokenRef.current.fetchedAt > 60_000` → refetch token.
3. `provider.onStateChange = setWhisperState;`
   `provider.onReady = () => { /* trigger glow flash */ };`
   (onPartial / onFinal already wired from earlier fix.)
4. `await provider.connect(stream, {
       ephemeralKey: tokenRef.current.token,
       audioCtx: audioCtxRef.current ?? undefined,
   });`
5. On Stop → `provider.disconnect()` → state returns to `idle`.

---

## Acceptance checklist

- [ ] Selecting the pill triggers token + worklet pre-warm in parallel.
- [ ] Switching pill aborts pre-warm and closes AudioContext.
- [ ] Click → Start latency noticeably reduced (token + worklet already hot).
- [ ] Status dot transitions: idle → connecting → ready → listening.
- [ ] Green glow flashes once on ready.
- [ ] Timer shows MM:SS while listening.
- [ ] Error state surfaces with "Try Again".
- [ ] AssemblyAI and Deepgram visually and functionally unchanged.
- [ ] No edits to `assemblyai.ts`, `deepgram.ts`, batch `whisper.ts`.
- [ ] Diagnostic `console.log` from previous step removed.
