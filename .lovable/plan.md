
Root cause found
- Your background job is hitting the Edge Function runtime ceiling, not just a prompt issue.
- I can see `POST /functions/v1/generate-policy` returning `504` with `execution_time_ms ≈ 150105` (about 2m30s).
- Phase 1 generation currently runs as one long Anthropic call. If it exceeds that limit, the invocation is killed before it can mark the job failed/completed, so it stays on `generating`.
- Recovery then waits 5 minutes before re-queuing, which is why it appears “stuck”.

Implementation plan (reliability-first for 5–6 minute policies)

1) Convert background processing to a resumable step pipeline
- Keep one queue row per policy.
- Process one short step per invocation (target <110s each), then immediately self-trigger the next step.
- Proposed steps:
  1. `generate_part_1` (header + sections 1–4)
  2. `generate_part_2` (sections 5–8)
  3. `generate_part_3` (sections 9–11 + metadata)
  4. `enhance_final` (compliance pass + mandatory placeholder replacement)
  5. `finalise` (save completion + send email with attachment)
- Store partial outputs in `metadata` so progress survives timeouts/restarts.

2) Add lease-based job control (replace “updated_at stale” guessing)
- Add orchestration fields to `policy_generation_jobs`:
  - `current_step` (text)
  - `progress_pct` (int)
  - `attempt_count` (int)
  - `heartbeat_at` (timestamptz)
  - `lease_expires_at` (timestamptz)
  - `next_retry_at` (timestamptz)
- Worker claims only jobs whose lease is expired (or pending) and renews heartbeat while running.
- This prevents duplicate workers and avoids 5-minute dead windows.

3) Retry/backoff policy per step
- Retry only transient failures (`timeout`, `429`, `5xx`, network) with backoff (eg 20s, 45s, 90s).
- Permanent failures (bad input/prompt parse) fail fast with a clear error.
- Cap retries per step and preserve reason in `error_message`.

4) Reduce model latency without losing quality
- Stop sending the full mega-prompt for every run.
- Build a policy-specific prompt block (based on policy type/category) per step.
- Keep strict rules for:
  - Section 8.1 KPI table
  - Section 11 populated version history
  - placeholder replacement with known practice values
- This reduces per-call token load and helps each step finish within runtime limits.

5) Front-end changes for visibility and less queue spam
- `usePolicyJobs`:
  - Use lease/heartbeat to decide staleness (not raw 60s `updated_at`).
  - Kick queue only when lease expired or pending exists.
- `PolicyServiceMyPolicies`:
  - Show stage text (“Generating part 2/3”, “Enhancing”, “Finalising email”).
  - Show progress percentage and last heartbeat.
  - Keep Restart Queue, but only as manual override.
- Keep email default ON as already implemented.

Files/migrations to update
- `supabase/migrations/...`:
  - add orchestration columns + indexes (`status`, `user_id`, `lease_expires_at`, `next_retry_at`)
- `supabase/functions/generate-policy/index.ts`:
  - refactor `action: process-job` into step-machine with lease/heartbeat/retry
- `src/hooks/usePolicyJobs.ts`:
  - staleness + kick logic based on lease/heartbeat
- `src/pages/PolicyServiceMyPolicies.tsx`:
  - richer in-progress UI with step/progress diagnostics

Recovery + rollout
- One-time data fix for existing stuck jobs: reset old `generating` rows to `pending`, initialise `current_step`.
- Backward compatible handling for rows missing new metadata (default to step 1).
- Deploy background-path hardening first; keep synchronous path unchanged initially.

Validation checklist
- Confirm job lifecycle: `pending → generating(part1/2/3) → enhancing → completed`.
- Confirm no new background `504` events for `generate-policy`.
- Confirm no job remains in `generating` without heartbeat beyond lease.
- Run one full end-to-end test on Cervical Screening and verify:
  - completes in ~5–6 minutes total across multiple short invocations
  - no stuck state
  - email arrives with Word attachment and correct branding/details.
