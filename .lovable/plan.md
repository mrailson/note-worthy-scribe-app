

## Analysis: Will the Background Queue Handle Multiple Concurrent Policies?

### Current Architecture Risks

The current plan has the `generate-policy` edge function doing the background job processing via a `process-job` action branch. Here's where concurrency issues arise:

**1. Supabase Edge Function concurrency limits**
Supabase edge functions have a concurrency limit per function. Each background job holds a connection open for ~5 minutes (generate + enhance). If a user queues 3–4 policies, that's 3–4 concurrent invocations of the same `generate-policy` function, each running for minutes. This risks hitting the concurrency cap and blocking new requests — including the user's ability to even start another policy via the normal synchronous flow.

**2. Anthropic API rate limits**
Each job makes 2 Anthropic API calls (generate + enhance). Multiple concurrent jobs multiply the token throughput. On lower-tier Anthropic plans this could trigger rate limiting (429 errors), causing jobs to fail.

**3. No actual queuing — it's parallel, not sequential**
The current plan fires each job independently via fire-and-forget `fetch()`. There's no queue discipline — all jobs run simultaneously, not one at a time. This is "concurrent execution" not a "queue."

### Revised Plan: True Sequential Queue with Concurrency Safety

To make this robust, the approach needs one key change: **jobs should be processed one at a time**, not concurrently. The database table acts as the queue; processing is sequential.

#### How It Works

```text
User submits Policy A → insert job row (status: pending) → fire generate-policy "process-job"
User submits Policy B → insert job row (status: pending) → fire generate-policy "process-job"
User submits Policy C → insert job row (status: pending) → fire generate-policy "process-job"

generate-policy "process-job" handler:
  1. Try to claim the OLDEST pending job (atomic UPDATE ... WHERE status='pending' RETURNING)
  2. If no pending job found → exit (another invocation already claimed it)
  3. Process the claimed job (generate → enhance → save → email)
  4. On completion, check for MORE pending jobs → process next one
  5. Loop until no pending jobs remain
```

This means:
- Multiple fire-and-forget calls are safe — only one will successfully claim a job (atomic SQL claim)
- Jobs process sequentially, avoiding Anthropic rate limits and edge function concurrency issues
- The user can queue as many policies as they like — they just process in order
- If a job fails, it's marked `failed` and the next one proceeds

#### Database Table: `policy_generation_jobs`

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID | Primary key |
| user_id | UUID | Owner |
| policy_reference_id | TEXT | Which policy template |
| policy_title | TEXT | Display name |
| practice_details | JSONB | All practice info for generation |
| custom_instructions | TEXT | Optional extra instructions |
| status | TEXT | pending → generating → enhancing → completed / failed |
| email_when_ready | BOOLEAN | Send email on completion |
| generated_content | TEXT | Final policy content |
| metadata | JSONB | Title, version, dates, references |
| error_message | TEXT | If failed |
| created_at | TIMESTAMPTZ | For queue ordering |
| updated_at | TIMESTAMPTZ | For polling freshness |
| completed_at | TIMESTAMPTZ | When done |

RLS: users can SELECT/INSERT own rows. Edge function uses service role key to UPDATE.

#### Edge Function: `generate-policy/index.ts` — New `process-job` Branch

Added at the top of the request handler, before the existing SSE streaming logic:

```
if (action === "process-job") {
  // Use service role key for DB updates
  // Atomic claim: UPDATE policy_generation_jobs SET status='generating' 
  //   WHERE status='pending' AND user_id=X ORDER BY created_at LIMIT 1 RETURNING *
  // If nothing claimed → return { message: "no pending jobs" }
  // Process job (call Anthropic generate, then enhance)
  // Save to policy_completions
  // Update job status to completed
  // If email_when_ready → invoke send-email-resend
  // Check for more pending jobs → loop
  // Return { processed: N }
}
```

The atomic claim query prevents two concurrent invocations from processing the same job. The loop ensures one invocation drains the entire queue.

#### Frontend Changes

**`PolicyServiceCreate.tsx`**
- Add "Email me when ready" toggle checkbox below the Generate button
- Add "Generate in Background" button (secondary variant)
- Background button: inserts a job row → fires `generate-policy` with `action: "process-job"` (fire-and-forget) → shows toast "Policy queued — track progress on My Policies" → user stays on page or navigates away
- Existing synchronous "Generate Policy" button remains unchanged

**`src/hooks/usePolicyJobs.ts`** (new)
- Queries `policy_generation_jobs` for the current user
- Polls every 15 seconds only when active jobs exist (pending/generating/enhancing)
- Stops polling when all jobs are completed/failed
- Returns `jobs`, `activeJobCount`, `isLoading`

**`PolicyServiceMyPolicies.tsx`**
- "In Progress" section at top showing queued/active jobs
- Each job: title, submitted time (DD/MM/YYYY HH:MM), colour-coded status badge, error if failed
- When status = completed, show download button (generates Word doc from `generated_content`)
- Completed jobs auto-appear in the main "Completed Policies" list (since the edge function saves to `policy_completions`)

**`PolicyService.tsx`**
- Badge on "My Policies" card showing active job count when > 0

#### Files Summary

| File | Action |
|------|--------|
| DB migration | New — `policy_generation_jobs` table with RLS |
| `supabase/functions/generate-policy/index.ts` | Modify — add `process-job` action with sequential queue processing |
| `src/hooks/usePolicyJobs.ts` | New — polling hook |
| `src/pages/PolicyServiceCreate.tsx` | Modify — background generation UI |
| `src/pages/PolicyServiceMyPolicies.tsx` | Modify — in-progress jobs section |
| `src/pages/PolicyService.tsx` | Modify — active jobs badge |

#### Why This Won't Crash

1. **Sequential processing** — only one Anthropic call runs at a time per user, no concurrency pile-up
2. **Atomic job claiming** — duplicate invocations harmlessly exit when there's nothing to claim
3. **Independent of browser** — once the job row exists, the edge function processes it regardless of whether the user is on the page
4. **Graceful failure** — failed jobs are marked and skipped; the queue continues
5. **No extra edge functions** — everything runs inside the existing `generate-policy` function

