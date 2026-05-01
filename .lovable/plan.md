## Goal

Cut post-stop wait time for short meetings (the common case) by routing them to `gemini-3-flash` by default, while preserving `gemini-3.1-pro` quality for long meetings (≥60 minutes) where the extra reasoning genuinely pays off. Easy to revert later once we have the data.

## Where the change happens

A single, server-side change in `supabase/functions/auto-generate-meeting-notes/index.ts`. No client changes — all existing user UI overrides (Settings dropdown, regenerate menu) continue to win as they do today.

### Today (line 240)

```ts
modelOverride = 'gemini-3.1-pro',  // hard default
```

The client sends no `modelOverride` for normal auto-generation, so this default is what runs.

### Proposed

1. Keep the request-body default as today (so an explicit choice from the client still flows through unchanged).
2. **After the meeting record is loaded** and we know `meeting.duration_minutes`, apply a duration-based default *only when the caller did not specify a model*:

```ts
// Duration-based default (only when caller didn't pick a model explicitly)
const callerSpecifiedModel = Object.prototype.hasOwnProperty.call(requestBody, 'modelOverride');
if (!callerSpecifiedModel) {
  const mins = Number(meeting.duration_minutes) || 0;
  modelOverride = mins >= 60 ? 'gemini-3.1-pro' : 'gemini-3-flash';
  console.log(`🎯 Duration-based default: ${mins} min → ${modelOverride}`);
}
```

3. The existing fallback chain stays intact — if flash itself fails for any reason it still escalates to `gemini-2.5-pro` → `gpt-5` (lines 1781–1797).

## Why this is safe

- **Fallback chain unchanged.** `getFallbackChain()` (line 1784) only swaps the chain when the *primary* is Pro. When primary is Flash it keeps Flash's existing chain, so behaviour for explicit Flash users today is unchanged.
- **Per-attempt timeout already differentiates.** Line 1797: Flash has a 60 s timeout, Pro has 120 s — so if Flash ever stalls we lose at most 60 s before fallback (vs the 120 s we just lost on this meeting).
- **User overrides win.** Anyone who explicitly chose Pro (or anything else) in Settings still gets exactly that — we only change the *unspecified* path.
- **Long meetings keep Pro.** ≥60 min is where Pro's extra reasoning matters most for synthesis across many agenda items.

## Expected impact (based on this meeting's logs)

The 4 min / 694-word meeting that took 2 min 23 s to finalise:
- Pro attempt 1 burned 120 s on a timeout
- Flash fallback then produced notes in ~7 s
- Overview added ~14 s

With this change that same meeting would have gone Flash-first, finishing notes in ~7 s instead of ~127 s — roughly **2 minutes faster** end to end.

## Tracking — how we'll know it's working

Already in the logs (no extra instrumentation needed):
- `📊 Word count:` and `Duration:` lines tell us the meeting size
- `🔁 Attempt N/4: <model>` lines tell us which model ran and how many fallbacks were needed
- `⚡ Fallback succeeded with…` flags every escalation
- The new `🎯 Duration-based default:` log line will let us grep how often each branch fires

After ~48 hours we can run a quick log query to compare:
- Average end-to-end time, short vs long meetings
- Fallback rate on Flash (should stay low)
- Whether any user manually re-runs notes on Pro after a short meeting (signal that quality dropped)

## Files to edit

- `supabase/functions/auto-generate-meeting-notes/index.ts` — single insertion just after the meeting record is fetched, ~10 lines.

## Memory update

Update `mem://index.md` Core line for the meeting notes default to:
`Meeting notes default model: duration-based — gemini-3-flash for <60 min, gemini-3.1-pro for ≥60 min. Fallback chain unchanged. User UI overrides always win.`

## Out of scope (deliberately)

- No client-side changes
- No change to fallback chain order
- No change to user-visible Settings dropdown labels
- No change to Best-of-All transcript merging