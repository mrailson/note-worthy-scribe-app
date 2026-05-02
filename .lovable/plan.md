# Fix Stuck "Generating Notes" Pipeline (v2)

Three defects surfaced by tonight's 26-minute meeting (`0bc2717f-35ae-4a43-bd77-8cc0a8fac66e`), plus three additions Claude requested for better diagnostics and UX. All server changes in `supabase/functions/auto-generate-meeting-notes/index.ts`.

## 1. Fix the ReferenceError that hides every failure

At line ~3071, the final catch block references `actualModelUsed` which is not declared in that scope. The throw silently aborts the DB status update, so `notes_generation_status` stays `generating` forever and the spinner never stops.

**Action**: Declare `let actualModelUsed = configuredModel;` near the top of the orchestrator, update it inside each attempt loop. Wrap the status-update DB call in its own try/catch so a secondary failure can never swallow the primary error.

## 2. Restore the planned 3-attempt Sonnet fallback chain with correct timeouts

Logs show only "Attempt 1/2" and "Attempt 2/2", both labelled "30s" but actually aborting at ~90s. The May 2026 plan promised three attempts at 30s / 60s / 90s.

**Action**:
- `const SONNET_TIMEOUTS_MS = [30_000, 60_000, 90_000];` and iterate
- Single source of truth so the log line, `setTimeout`, and counter all agree
- Worst-case wall time 180s — well inside the 400s edge-function ceiling

## 3. Add a one-shot GPT-5 emergency fallback

After all three Sonnet attempts exhaust, fall through to **one** attempt against `openai/gpt-5` via Lovable AI Gateway with a 90s timeout. Tag `notes_model_used` as `gpt-5-emergency-fallback` so it appears in the model badge. Gate behind `system_settings.MEETING_EMERGENCY_FALLBACK_ENABLED` (default `true`).

## 4. Rich timeout logging (Claude addition)

When any AbortController fires, log on a single line:
- `elapsed_ms` (actual wall-clock measured from `performance.now()` at attempt start)
- `model` string sent to Anthropic
- `prompt_chars` and `prompt_token_estimate` (chars / 4)
- `anthropic_request_id` — read from the response's `request-id` header (or `x-request-id`); even on timeout we usually get headers before the body stalls, so `fetch().then(r => r.headers)` may resolve. Capture it inside the `try` and surface in the abort handler.
- `attempt_number` and `configured_timeout_ms`

Without these, every future timeout is guesswork. Format as a single JSON object so it's grep-able in Supabase log search.

## 5. Always surface the model badge with attempt info (Claude addition)

Today the model badge only varies when emergency fallback fires. Extend it so:
- Sonnet attempt 1 success → badge: `claude-sonnet-4-6`
- Sonnet attempt 2 success → badge: `claude-sonnet-4-6 (retry 2)`
- Sonnet attempt 3 success → badge: `claude-sonnet-4-6 (retry 3)`
- GPT-5 fallback → badge: `gpt-5-emergency-fallback`

Useful early-warning signal for Anthropic latency drift. Store both `notes_model_used` and a new `notes_model_attempt` integer column (default 1) on `meetings`.

## 6. Frontend safety net for the spinner

In the polling hook (likely `src/hooks/useMeetings.ts`): if `status === 'generating'` and `updated_at` older than 6 minutes, render "Generation timed out — click to retry" instead of the spinner. Protects users even if a future bug bypasses status updates.

## 7. Don't auto-retry on user-triggered regenerate (Claude addition)

When `forceRegenerate: true` is sent (i.e. user clicked "Regenerate Notes" after a stale job), bypass the 30s/60s rungs and run **one** Sonnet attempt with a fresh 90s window. If that fails, then fall through to GPT-5 emergency fallback. Rationale: most Anthropic blips are transient and clear within seconds — burning 3 minutes on a manual retry is poor UX.

## 8. Recover the stuck meeting

Run via the data-update tool:
```sql
UPDATE meetings
   SET notes_generation_status = 'failed',
       updated_at = NOW()
 WHERE id = '0bc2717f-35ae-4a43-bd77-8cc0a8fac66e';
```
Transcript is intact (28,157 chars in `best_of_all_transcript`); user can hit "Regenerate Notes" without re-uploading.

## 9. Anthropic support packet

After deploy, capture and email/raise with Anthropic:
- UTC timestamps of failed calls: `2026-05-02T17:15:24Z` and `2026-05-02T17:16:54Z`
- Model string passed: `claude-sonnet-4-6`
- Calling pattern: direct Anthropic Messages API from Supabase Edge Function, non-streaming
- Symptom: no response body within 90s, client AbortController fired
- `anthropic_request_id` (from item 4 above, once new logging is live and reproduces)

## Out of scope
- Switching to streaming Anthropic responses (separate, larger change — would also let us start writing partial notes earlier)
- Re-introducing Gemini for first-pass notes (governance memory rule still holds: Sonnet-only first pass)

## Files to edit
- `supabase/functions/auto-generate-meeting-notes/index.ts` — items 1, 2, 3, 4, 5, 7
- `src/components/meeting-history/LlmModelBadge.tsx` — item 5 display
- `src/hooks/useMeetings.ts` (or relevant polling hook) — item 6
- Migration: add `notes_model_attempt INTEGER DEFAULT 1` to `meetings` — item 5
- Data update: one-off UPDATE — item 8
