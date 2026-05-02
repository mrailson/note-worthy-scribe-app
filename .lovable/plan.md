## Approved scope — implementation plan (locked)

You approved Phase A; this is the final shape with your three Phase B additions and the Bedrock note for Phase C. Approving this flips me to build mode and I ship immediately.

### Phase A — ship now (2 narrow edits, 1 file)

**File:** `supabase/functions/auto-generate-meeting-notes/index.ts`

1. **Narrow the rescue guard (line ~2521).** Replace:

   ```ts
   if ((!generatedNotes || ...) && !callerSpecifiedModel) {
   ```

   with:

   ```ts
   const rescueAllowedForCaller =
     !callerSpecifiedModel || (modelOverride === 'claude-sonnet-4-6');
   if ((!generatedNotes || ...) && rescueAllowedForCaller) {
   ```

   Effect: manual "Generate Meeting Notes" clicks (which always pass `claude-sonnet-4-6`) now reach the GPT-5 rescue. Explicit non-Sonnet overrides (e.g. an admin selecting Gemini) still bypass — we don't second-guess explicit choices.

2. **Add success / failure / request-id logging around the GPT-5 fallback (lines ~2534–2549).**
   - Wrap `runAttempt('gpt-5', 90_000, ...)` so we capture `start_ms`, `end_ms`, returned char count, OpenAI's `x-request-id` header.
   - Emit a structured `GPT5_FALLBACK_RESULT` JSON line with `{ outcome: 'success' | 'empty' | 'error', elapsed_ms, chars, openai_request_id, meeting_id }`.
   - Currently we log "🚨 attempting" then nothing if the call returns empty (only thrown errors are logged). This closes that audit gap.

No DB migration. No frontend change. No new toggles. No badge change (badge already shows `gpt-5-emergency-fallback`).

### Phase B — diagnostic edge function (one-shot, deleted after)

**New file:** `supabase/functions/diagnose-anthropic-routing/index.ts`

Admin-gated (header `x-diag-token` matches a new `DIAG_TOKEN` secret — I'll add it via `add_secret` so the function can't be probed publicly even if the URL leaks).

The function runs the following sequence and returns one JSON report:

1. **Egress IP** — `GET https://api.ipify.org` from inside the runtime. Identifies the Deno Deploy edge IP we're being seen as. (Your addition #3 — catches silent shared-IP rate-limiting.)
2. **DNS-equivalent check** — `Deno.connect({ hostname: 'api.anthropic.com', port: 443 })`, capture the resolved peer address; cross-check against DoH lookups to Cloudflare (`https://cloudflare-dns.com/dns-query`) and Google (`https://dns.google/resolve`). (Test 4.)
3. **Sonnet 4.6, 50-token prompt × 3, ~5 s apart** (your addition #1) — direct to `api.anthropic.com/v1/messages` using the edge function's `ANTHROPIC_API_KEY`. Capture per-attempt: HTTP status, `request-id` header, full timing breakdown via manual timestamps, response body length, first 200 chars of body. (Test 2 + intermittent vs stable.)
4. **Haiku 4.5 comparator, 50-token prompt × 1** (your addition #2) — identical payload shape, only `model` swapped to `claude-haiku-4-5`. Isolates model-specific from path-level issues.
5. **Sonnet 4.6, ~14k-input-token prompt × 1** — synthetic transcript matching the failing payload size, to test prompt-size dependency.
6. **Sonnet 4.6, ~14k-input-token prompt × 1, stripped headers / no system prompt / lower max_tokens** — same size, simpler shape, to isolate request-shape sensitivity.
7. **Lovable AI Gateway control** — `openai/gpt-5` 50-token call to confirm the gateway path is healthy from the same runtime (sanity baseline).

Returns:

```json
{
  "ts": "...",
  "egress_ip": "...",
  "dns": { "deno_peer": "...", "doh_cloudflare": [...], "doh_google": [...], "match": true },
  "sonnet_small": [ { "attempt": 1, "status": 200, "request_id": "req_...", "elapsed_ms": 1240, "body_chars": 312 }, ... ],
  "haiku_small":  { "status": 200, "request_id": "...", "elapsed_ms": 540 },
  "sonnet_large_full": { ... },
  "sonnet_large_stripped": { ... },
  "gateway_control": { ... }
}
```

I trigger it once via `supabase--curl_edge_functions`, capture the JSON, post the diagnosis back to you in chat. Then **delete** the function (and the `DIAG_TOKEN` secret) before this thread closes.

### Phase C — decision tree (held until Phase B reports)

Same as previously agreed, with one update:

- **C1 (size-dependent)** → MAP/REDUCE chunking change; not a force-GPT-5 toggle.
- **C2 (Supabase-edge-to-Anthropic networking)** → open Supabase support ticket with `request-id`s + egress IP. **Bedrock added as primary contingency** — `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` are already in the secret store, and Bedrock serves Claude Sonnet 4.5 via `anthropic.claude-sonnet-4-5-20250929-v1:0` (and Sonnet 4.6 once GA on Bedrock — currently in preview in some regions). Different egress route from Deno Deploy → AWS, IAM-authed via SigV4. I'll spike a price/latency note as part of Phase C deliverables, not now.
- **C3 (transient)** → keep Phase A rescue, ship nothing else.

Fixes 3 (fast-fail-on-hang) and 4 (force-GPT-5 toggle) remain explicitly **held**.

### Files

- Edit: `supabase/functions/auto-generate-meeting-notes/index.ts` (Phase A only)
- Create: `supabase/functions/diagnose-anthropic-routing/index.ts` (Phase B, transient)
- New secret: `DIAG_TOKEN` (Phase B, transient)

Approve to ship Phase A and run Phase B.
