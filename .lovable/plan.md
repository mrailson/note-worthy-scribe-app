

# Diagnosis: Why Whisper and AssemblyAI are dropping ~half the words

## AssemblyAI — CONFIRMED BUG in v3 message handling

The logs prove the issue. Looking at the actual v3 messages from AssemblyAI:

```text
msg #360: {"turn_order":38, "turn_is_formatted":true, "end_of_turn":false, "transcript":"Just the", ...}
msg #340: {"turn_order":36, "turn_is_formatted":true, "end_of_turn":false, "transcript":"But", ...}
msg #320: {"turn_order":34, "turn_is_formatted":true, "end_of_turn":false, "transcript":"No he was saying I need to", ...}
msg #180: {"turn_order":22, "turn_is_formatted":true, "end_of_turn":true,  "transcript":"I.", ...}
```

**Critical finding**: `turn_is_formatted` is `true` on ALL messages — both interim partials AND end-of-turn finals. In v3, `turn_is_formatted` does NOT distinguish partial from final. It just means the text has punctuation/casing applied (because `format_turns=true` is set in the URL).

Current client logic:
```typescript
if (data?.turn_is_formatted) {
  this.cb.onFinal?.(text);    // ← fires on EVERY message, even 2-word partials
} else if (data?.end_of_turn) {
  return;                      // ← never reached because turn_is_formatted is always true
} else {
  this.cb.onPartial?.(text);   // ← never reached
}
```

**Result**: Every interim partial ("Just the", "But", "No he was saying I need to") fires `onFinal`. The `shouldReplaceLastFinal` dedup in the hook then REPLACES the previous final with the new tiny fragment, destroying content. Full sentences get overwritten by 2-word partials from the next turn.

### Fix (assembly-realtime.ts — both handlers)

Use `end_of_turn` as the primary signal, not `turn_is_formatted`:

```typescript
if ('turn_order' in data || ('transcript' in data && 'end_of_turn' in data)) {
  const text = String(data?.transcript ?? "").trim();
  if (!text) return;
  if (data?.end_of_turn) {
    // End of turn — this IS the final (already formatted since format_turns=true)
    this.cb.onFinal?.(text);
  } else {
    // Interim update — show as live preview
    this.cb.onPartial?.(text);
  }
  return;
}
```

This fixes the core issue: only complete turns become finals, interim updates show as partials.

## Whisper — TWO likely causes

### Cause A: gpt-4o-mini-transcribe for single recordings

The NoteWellRecorder sync calls `standalone-whisper` without specifying `responseFormat`, so it defaults to `json` → model becomes `gpt-4o-mini-transcribe`. This model is newer but may behave differently with webm/opus audio from browser MediaRecorder. The original whisper-1 was battle-tested with this format.

**Fix**: For the initial rollout, revert to `whisper-1` as default model and make `gpt-4o-mini-transcribe` opt-in via an explicit `model` parameter. This is safer — test the new model separately before making it default.

### Cause B: Transcode preprocessing dropping audio

The standalone-whisper function preprocesses ALL audio through `transcode-audio` (line 189). If the transcode step silently truncates or corrupts the audio, Whisper would transcribe less content. The fallback is in place (line 104) but only triggers on HTTP errors, not on silent truncation.

**Fix**: Add a size sanity check — if preprocessed audio is less than 50% of original size AND the original wasn't a lossy format being converted to FLAC, log a warning and skip preprocessing.

## Files to change

1. **`src/lib/assembly-realtime.ts`** — Fix v3 message detection in both handlers (main + reconnect): use `end_of_turn` as the final signal, not `turn_is_formatted`

2. **`src/lib/assembly-realtime-worklet.ts`** — Same fix for the worklet variant

3. **`supabase/functions/standalone-whisper/index.ts`** — Revert model default to `whisper-1` (make gpt-4o-mini-transcribe opt-in via explicit `model` param); add size sanity check after preprocessing

## Summary

The AssemblyAI bug is the confirmed primary cause — the logs prove every message has `turn_is_formatted: true` regardless of whether it's a partial or final. The Whisper issue is likely the model change to `gpt-4o-mini-transcribe` which hasn't been validated with browser-recorded webm/opus.

