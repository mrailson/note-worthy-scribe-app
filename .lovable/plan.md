## Findings before the plan

### Gladia footprint (full audit)

Gladia touches **15 files** plus secrets, config, and a database table. Specifically:

- **Edge functions:** `supabase/functions/gladia-streaming/` (the realtime proxy) + Gladia branch in `consolidate-meeting-chunks/index.ts`
- **Client:** `src/utils/GladiaRealtimeTranscriber.ts`, `src/hooks/useGladiaRealtimePreview.ts`, `src/utils/TranscriptionServiceFactory.ts`, plus references in `MeetingRecorder.tsx` (~12 lines) and `SafeModeNotesModal.tsx` (~30 lines including a dedicated "Gladia" tab + its export-doc section)
- **UI badges:** `LiveTranscriptGlassPanel.tsx` (Gladia engine badge "hue: 35 95% 55%"), `LiveContextStatusBar.tsx`, `RecordingFlowOverlay.tsx`
- **Types:** `src/types/transcriptionServices.ts`
- **Misc:** `src/lib/dpia-prompts.ts`
- **Database:** `gladia_transcriptions` table (51,996 rows historically), schema `(id, meeting_id, user_id, session_id, chunk_number, transcription_text, confidence, is_final, word_count, created_at, updated_at)`
- **Secrets:** `GLADIA_API_KEY` runtime secret
- **Config:** `[functions.gladia-streaming]` section in `supabase/config.toml`

**No other system depends on Gladia output.** Verified by searching every reference: it is consumed only by the realtime preview hook, the consolidate-meeting-chunks merger, and the SafeModeNotesModal display tab. No notes generation, email, export, audit, or downstream service references `gladia_transcriptions` or the Gladia transcript field.

### Best-of-All merger — already 3-engine ready

`consolidate-meeting-chunks/index.ts` line 208–401 already operates on `Engine = 'assembly' | 'whisper' | 'deepgram' | 'gladia'`, with Gladia treated as a **fourth optional source** (`gladiaRaw: RawChunk[] = []` defaulted to empty in the function signature). Removing Gladia is a clean reduction — the merger already handles a missing engine gracefully (it merges whichever sources arrive). The runtime weights in the engine confidence table (line 271) and the per-chunk pre-filter loop will both be cleaner once Gladia is gone.

### AssemblyAI Live — what actually broke on the 95-min test

DB read for the Cambridge meeting (`62554e27…`):

| Source | Chars |
|---|---|
| `assembly_transcript_text` | **17** |
| `assembly_ai_transcript` | **17** |
| `live_transcript_text` | 78,701 |
| `whisper_transcript_text` | 66,663 |

So AssemblyAI captured one fragment then died at session start — confirming your report. Pattern across recent long meetings shows AssemblyAI **succeeded fully** on two (58k chars / 53min, 77k chars / 79min) but **produced 0–46 chars** on most others. Not a "long meetings always break" pattern — it's a session-init fragility issue.

**Edge function logs for `assemblyai-realtime` are empty for this meeting** ("No logs found"), which is itself diagnostic — the Lovable log retrieval is dropping them, but it also means we have weak observability on this proxy. The session likely closed before producing enough log lines to be retained.

**Current implementation analysis (`src/lib/assembly-realtime.ts` + proxy):**

| Question | Current state |
|---|---|
| API version | **v3** — `wss://streaming.assemblyai.com/v3/ws` |
| Model | `u3-rt-pro` with `speaker_labels=true`, `format_turns=true` |
| Sample rate / encoding | 16 kHz PCM16, raw binary frames via AudioWorklet |
| Heartbeat / keepalive | **NONE** — no ping, no silence frames. v3 sessions can be culled by upstream/proxy infra during long silences |
| Reconnect logic | Yes — exponential backoff [2s, 4s, 8s, 16s, 30s, 30s], max 6 attempts |
| Transcript stitching across reconnects | Yes — `baseTranscriptRef` accumulates finals + 30s flush DB backup; reconnect preserves audio context and re-sends keyterms |
| Session rotation | Yes — pre-emptive close at **55 min** to dodge AAI's 60-min hard cap |
| Token expiry | 9 min (`expires_in_seconds=540`) but session uses token only at handshake — no refresh logic, so a reconnect after 9 min requires re-fetching token (currently the proxy refetches on every `initAssemblyAIConnection`) |
| Tab backgrounding | Mitigated by AudioContext + AudioWorklet (the existing `mobile-recording-safeguards` wake-lock + 20Hz oscillator helps) but no explicit watchdog |
| State logging | onclose logs `{code, reason, msgs, finals, partials, audioFrames}` — present but underused (logs not retained by edge platform for short-lived sessions) |

**Most plausible root cause for the 17-char failure on the 95-min test:**

1. WebSocket handshake to proxy succeeded (we got 17 chars).
2. AssemblyAI v3 closed the upstream socket early — possible reasons: token request transient failure on retry, model `u3-rt-pro` capacity throttle, or one initial silence > AAI's session-init audio timeout.
3. The proxy's `assemblySocket.onclose` correctly forwards the close and triggers the client to close, which **does** schedule reconnect — but the reconnect path requires fetching a fresh token. If the close happened before audio was reliably flowing, reconnect attempts may have hit the same condition repeatedly until the 6-attempt cap, then gone silent.
4. No heartbeat means there's no signal differentiating "AAI hung silently" from "AAI closed cleanly".

---

## Plan

### Part 1 — Drop Gladia

#### 1.1 Edge functions
- **Delete** `supabase/functions/gladia-streaming/index.ts` (deploy removal)
- **Edit** `supabase/functions/consolidate-meeting-chunks/index.ts`:
  - Reduce `Engine` union to `'assembly' | 'whisper' | 'deepgram'`
  - Remove the `engine === 'gladia'` weight branch
  - Drop the `gladiaRaw` parameter from `mergeBestOfAll()` signature
  - Remove the Gladia fetch block (lines 993–1007), the Gladia chunk loop (1112–1119), and the Gladia branches in the empty-source guards
  - Update logs to read "Best-of-All 3-engine merge" (already worded that way)
- Remove `[functions.gladia-streaming]` from `supabase/config.toml`

#### 1.2 Client code
- **Delete** `src/utils/GladiaRealtimeTranscriber.ts`
- **Delete** `src/hooks/useGladiaRealtimePreview.ts`
- **Edit** `src/components/MeetingRecorder.tsx` — remove the import, hook call, start/stop calls, word-count branches, capture during stop, and the `gladiaText` prop pass-through (~16 surgical removals)
- **Edit** `src/components/recording-flow/LiveTranscriptGlassPanel.tsx` — remove `gladia` from the `EngineKey` union, the engine list entry, the `gladiaText` prop, and the `gladia` panel block
- **Edit** `src/components/recording-flow/LiveContextStatusBar.tsx` and `RecordingFlowOverlay.tsx` — drop the `gladiaText` prop and pass-through
- **Edit** `src/components/SafeModeNotesModal.tsx` — drop the Gladia tab, the load block (lines 1355–1376), the word-count line, the export-doc Gladia section, and update the merged-transcript caption to read "Merged from Whisper, Deepgram and AssemblyAI"
- **Edit** `src/utils/TranscriptionServiceFactory.ts` — remove the Gladia entry
- **Edit** `src/types/transcriptionServices.ts` — drop Gladia from the service type union
- **Edit** `src/lib/dpia-prompts.ts` — replace the Gladia mention with the trimmed engine list (Whisper, Deepgram, AssemblyAI) so DPIA outputs stay accurate

#### 1.3 Database
- New migration:
  - Archive `gladia_transcriptions` rows to a CSV at `/mnt/documents/gladia_transcriptions_archive.csv` (audit record)
  - `DROP TABLE public.gladia_transcriptions CASCADE`

#### 1.4 Secrets
- Delete `GLADIA_API_KEY` runtime secret via secrets tool

#### 1.5 Confirmation
After the build I will explicitly confirm:
- Best-of-All merger now operates on Whisper + Deepgram + AssemblyAI Live cleanly (the 3-engine path is the existing happy-path, just with the now-impossible 4th branch removed)
- Zero remaining references to "gladia" in the project (`rg -i gladia` returns empty)
- No edge function, no view, no email template, and no notes generator depended on Gladia

### Part 2 — Make AssemblyAI Live reliable

The fix is layered defence-in-depth, not a single switch:

#### 2.1 Add heartbeat (option a)
In `src/lib/assembly-realtime.ts`, add a 25-second WebSocket-level keepalive:
- Send `{type: 'ping'}` JSON every 25 s while session is open
- In the proxy (`assemblyai-realtime/index.ts`), intercept `type === 'ping'` from client and respond with `{type: 'pong'}` — also forward a silent PCM frame (320 zero bytes = 10ms of silence) to AAI to keep their inactivity timer reset

#### 2.2 Granular WebSocket lifecycle telemetry (option e)
Persist diagnostics so we can debug *next* failure without relying on edge-log retention:
- New `assemblyai_session_diagnostics` table: `(meeting_id, event, code, reason, message_count, finals, partials, audio_frames_sent, ts)`
- Client sends a row at: open, first-final, every reconnect, every close, manual stop
- Surface a small "AAI: connected | reconnecting (N) | error" indicator in the recorder UI so users see degradation in real time rather than discovering it post-hoc
- Increase per-event log retention by writing structured JSON the platform retains

#### 2.3 Robust reconnect-with-stitch (option b — already mostly present, hardened)
Current reconnect is 6 attempts with backoff. Hardening:
- Reset `reconnectAttempts` whenever a new final arrives (not just on full session rotation), so a long meeting with one wobble doesn't accidentally consume the 6-attempt budget for the rest of the session
- On every reconnect, check `baseTranscriptRef` length — if 0 chars after 60s of audio frames, log a "stuck-session" diagnostic so we capture pre-flight failures (this is what the Cambridge meeting almost certainly was)
- Add a 60-second "no finals received" watchdog that force-closes + reconnects (separate from the existing 30s turn-commit timer, which only fires inside an open turn)

#### 2.4 Token refresh on long sessions (preventive)
Currently the proxy refetches a token on every `initAssemblyAIConnection`, which means each reconnect already gets a fresh token — good. **But** the 9-minute token TTL is irrelevant once the session is established; the existing 55-min session rotation is the right cap. **No change needed.**

#### 2.5 Tab-backgrounding hardening (option d)
The existing wake-lock + 20Hz oscillator (`features/meeting-manager/mobile-recording-safeguards`) keeps the AudioContext alive. Add:
- `document.visibilitychange` listener that, on `visible` after >30s hidden, checks WS readyState and triggers a reconnect if it's CLOSED/CLOSING
- Existing audio pipeline survives backgrounding fine on Chrome/Edge desktop; Firefox needs the wake-lock fallback (already present)

#### 2.6 Universal Streaming v3 — already on it
We are **already on v3** (`u3-rt-pro` model). No migration needed. The reliability gap is the missing heartbeat, not the API version.

#### 2.7 Acceptance criteria
After deploy, the next 60+ minute browser recording should produce, in the SafeMode preview:
- Whisper batch: 10–15k chars
- Deepgram: 10–15k chars
- AssemblyAI Live: 8–12k chars
- New diagnostics row count: at least 2 (open + close); for a clean session, 2 rows; with reconnects, more

If AAI Live is again < 500 chars, the new `assemblyai_session_diagnostics` table tells us exactly which lifecycle stage it died at (handshake / pre-first-final / mid-session / reconnect-storm) — you'll have a decisive answer rather than guessing.

---

## Files to change / create / delete (summary)

**Delete (4):**
- `supabase/functions/gladia-streaming/`
- `src/utils/GladiaRealtimeTranscriber.ts`
- `src/hooks/useGladiaRealtimePreview.ts`
- `gladia_transcriptions` table (after CSV archive)

**Edit (~12 files):**
- `supabase/functions/consolidate-meeting-chunks/index.ts`
- `supabase/config.toml`
- `src/components/MeetingRecorder.tsx`
- `src/components/SafeModeNotesModal.tsx`
- `src/components/recording-flow/{LiveTranscriptGlassPanel,LiveContextStatusBar,RecordingFlowOverlay}.tsx`
- `src/utils/TranscriptionServiceFactory.ts`
- `src/types/transcriptionServices.ts`
- `src/lib/dpia-prompts.ts`
- `src/lib/assembly-realtime.ts` (heartbeat + watchdog + reconnect-budget reset + visibilitychange handler + diagnostics writer)
- `supabase/functions/assemblyai-realtime/index.ts` (ping/pong handler + silent-frame keepalive)

**Create (2):**
- New migration: drop `gladia_transcriptions`, create `assemblyai_session_diagnostics` table with RLS
- Optional: small UI badge component for "AAI status" in the recording header

**Secrets:** delete `GLADIA_API_KEY`

---

## Order of operations on approval

1. CSV archive Gladia rows → drop table → confirm row count matches archive
2. Strip Gladia from edge functions → deploy
3. Strip Gladia from client → verify `rg -i gladia` is empty
4. Delete `GLADIA_API_KEY` secret
5. Add AAI heartbeat + diagnostics + watchdog + visibilitychange handler
6. Deploy `assemblyai-realtime` proxy with ping/pong support
7. Brief post-deploy summary listing exactly what changed and what to test

Approve and I'll switch to build mode and ship in that order.