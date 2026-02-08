

# Fix Supabase Rate Throttling — Bulletproof Edition

## Root Cause

The `ThrottlerException: Too Many Requests` error is triggered at the Supabase gateway when too many edge function invocations happen in quick succession. Two main contributors:

1. **Aggressive 5-second polling** -- During PowerPoint generation, the client polls `generate-powerpoint-gamma` every 5 seconds with no backoff. A 10-slide deck produces ~14 poll requests in ~70 seconds, compounding with other concurrent calls.

2. **Ghost cron job `process-pending-auto-notes`** -- A cron job (every 2 minutes) calls a function that does not exist in the codebase. Every invocation returns 401 and wastes rate limit quota (~30 failed calls per hour).

## Changes

### 1. Resilient Polling in All Four Hooks

Replace the flat `pollInterval = 5_000` with a robust polling strategy:

- **Base interval**: 10 seconds (was 5)
- **Pending backoff**: After 3 consecutive "pending" responses, increment by 2 seconds up to 30 seconds
- **Throttle backoff**: On 429/ThrottlerException, double the interval up to 120 seconds, with jitter
- **Auth failure handling**: On 401/403, stop polling immediately and surface a "session expired" error
- **Counter correctness**: Increment `consecutivePending` only when status is `'pending'`; reset on any other status

**Polling pattern (applied identically to all four files):**

```typescript
const basePollInterval = 10_000;
let currentInterval = basePollInterval;
const maxPendingInterval = 30_000;
const maxThrottleInterval = 120_000;
let consecutivePending = 0;

const sleepWithJitter = (ms: number) =>
  new Promise(r => setTimeout(r, ms * (0.9 + Math.random() * 0.2)));

while (Date.now() - pollStart < maxPollDuration) {
  await sleepWithJitter(currentInterval);

  const { data: pollData, error: pollError } = await supabase.functions.invoke(...);

  if (pollError) {
    const errMsg = pollError.message || '';

    // 401/403 -- session expired, stop immediately
    if (errMsg.includes('401') || errMsg.includes('403') ||
        errMsg.includes('Unauthorized') || errMsg.includes('Forbidden')) {
      throw new Error('Session expired or not authorised. Please sign in again.');
    }

    // 429 / ThrottlerException -- aggressive backoff
    if (errMsg.includes('ThrottlerException') || errMsg.includes('Too Many Requests') || errMsg.includes('429')) {
      console.warn('[Poll] Rate limited -- backing off');
      currentInterval = Math.min(currentInterval * 2, maxThrottleInterval);
      continue;
    }

    // Other transient error -- a few retries then give up
    console.warn('[Poll] Request failed, retrying...', pollError);
    continue;
  }

  // Successful poll -- check status
  if (pollData?.status === 'completed') {
    data = pollData;
    break;
  }

  if (pollData?.status === 'failed') {
    throw new Error(pollData.error || 'Generation failed');
  }

  // Status is 'pending' or something else
  if (pollData?.status === 'pending') {
    consecutivePending++;
    if (consecutivePending > 3) {
      currentInterval = Math.min(currentInterval + 2_000, maxPendingInterval);
    }
  } else {
    // Status like 'running', 'queued', etc. -- reset
    consecutivePending = 0;
    currentInterval = basePollInterval;
  }
}
```

**Files to modify:**
- `src/hooks/useGammaPowerPoint.ts` (lines 258-285)
- `src/hooks/useGammaPowerPointWithVoiceover.ts` (lines 117-143)
- `src/hooks/usePresentationStudio.ts` (lines 487-519)
- `src/hooks/useComplaintPowerPoint.ts` (lines 396-432)

### 2. Remove the Ghost Cron Job

The `process-pending-auto-notes` cron job (jobid 5) calls a function that has **no code in the codebase** -- no folder, no `index.ts`, nothing. Every 2-minute invocation returns a 401 error and wastes rate limit quota.

**Action:** Unschedule the cron job via SQL:

```sql
SELECT cron.unschedule('process-pending-auto-notes');
```

No changes to `config.toml` needed (there is nothing to register). This eliminates ~30 wasted edge function invocations per hour.

### 3. No Changes to `config.toml`

The previous plan proposed adding `process-pending-auto-notes` with `verify_jwt = false` to the config. This is **not needed** and would have been a security risk, because:
- The function code does not exist
- Setting `verify_jwt = false` without an alternative auth gate would create a publicly accessible endpoint
- The correct fix is removing the cron job, not creating config for a ghost function

## Impact Summary

| Metric | Before | After |
|--------|--------|-------|
| Poll interval (base) | 5 seconds | 10 seconds |
| Poll requests per minute (PowerPoint) | ~12 | ~5-6 |
| Max backoff on pending | None (fixed 5s) | 30 seconds |
| Max backoff on 429 throttle | None | 120 seconds with jitter |
| Behaviour on 401/403 | Loops forever | Stops immediately |
| Ghost cron invocations per hour | ~30 (all 401) | 0 (cron removed) |
| Wasted edge function calls per hour | ~30+ | 0 |

## Future Improvement (Not in Scope)

For long-term scalability, consider migrating from `functions.invoke()` polling to database status polling:
1. Invoke the edge function once to start the job
2. The function writes progress/status to a `generation_jobs` table
3. The UI polls the table via `supabase.from('generation_jobs').select()` or uses Realtime subscriptions

This is lighter-weight than repeated function invocations and is not subject to the same throttle limits.

## Files Summary

| File | Action |
|------|--------|
| `src/hooks/useGammaPowerPoint.ts` | Edit -- resilient polling with backoff + jitter |
| `src/hooks/useGammaPowerPointWithVoiceover.ts` | Edit -- resilient polling with backoff + jitter |
| `src/hooks/usePresentationStudio.ts` | Edit -- resilient polling with backoff + jitter |
| `src/hooks/useComplaintPowerPoint.ts` | Edit -- resilient polling with backoff + jitter |
| Database (cron.job) | SQL -- unschedule `process-pending-auto-notes` |

