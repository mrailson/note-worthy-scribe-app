

# Fix: AssemblyAI never committing finals — `end_of_turn` never fires

## Root Cause (from edge function logs)

The logs show 400+ messages from AssemblyAI, **every single one** with `end_of_turn: false` and `end_of_turn_confidence` near zero (0.0, 0.000017, etc.). Audio is streaming perfectly (50 frames/5s, 156KB/5s) and transcription text is accurate — but AssemblyAI's v3 turn detector never fires for continuous multi-speaker meeting audio.

The 30-second fallback timer added previously **resets on every partial** (line 142), so since partials arrive every ~3 seconds, the timer never fires. Both commit paths are broken.

## Fix — two changes in `src/lib/assembly-realtime.ts`

### 1. Track `turn_order` changes — commit previous turn as final

AssemblyAI v3 sends `turn_order` with each message. When `turn_order` increments (e.g. 4 → 5), the previous turn's last accumulated text is complete. The client should:

- Store `currentTurnOrder` and `currentTurnText`
- On each incoming message, if `turn_order` differs from stored value:
  - Commit `currentTurnText` as a final via `cb.onFinal()`
  - Update stored turn to new value
- This gives natural turn boundaries even without `end_of_turn`

### 2. Absolute turn timer — commit after 30s regardless

Instead of resetting on every partial, track when each turn's first partial arrived. If a turn has been accumulating for 30+ seconds without committing (no turn change, no end_of_turn), force-commit the accumulated text and reset.

This handles the case where a single speaker talks for 60+ seconds without a turn change.

## Implementation detail

**File: `src/lib/assembly-realtime.ts`** — Add to the message handler (line 166 area) and reconnect handler (line 324 area):

```text
New instance variables:
  currentTurnOrder: number = -1
  currentTurnText: string = ""
  turnStartTime: number = 0
  turnCommitTimer: NodeJS.Timeout | null = null

Message handler logic (both initial and reconnect):
  if turn_order !== currentTurnOrder:
    if currentTurnText.trim():
      cb.onFinal(currentTurnText)    // commit previous turn
    currentTurnOrder = turn_order
    currentTurnText = text
    turnStartTime = Date.now()
    reset 30s absolute timer
  else:
    currentTurnText = text           // update accumulator (v3 sends full turn text each time)

  if end_of_turn:
    cb.onFinal(text)
    currentTurnText = ""
    currentTurnOrder = -1
  else:
    cb.onPartial(text)
```

**File: `src/hooks/useAssemblyRealtimePreview.ts`** — Remove the partial-reset fallback timer (lines 142-149) since the client now handles turn commits directly.

## Files changed
1. `src/lib/assembly-realtime.ts` — turn tracking + absolute timer
2. `src/hooks/useAssemblyRealtimePreview.ts` — remove redundant fallback timer

