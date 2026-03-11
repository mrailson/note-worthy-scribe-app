

## Problem Diagnosis

The auto-scroll is broken because of a race condition in the `useEffect` at **lines 143-147**:

```typescript
useEffect(() => {
  if (isLoading) {
    autoScrollLocked.current = isNearBottom(); // ← THIS OVERRIDES THE LOCK
  }
}, [isLoading, isNearBottom]);
```

**What happens:**
1. User sends a message → `autoScrollLocked` is set to `true` (line 188) ✅
2. `isLoading` flips to `true` → the effect at line 143 fires and **overwrites** `autoScrollLocked` with `isNearBottom()`, which returns `false` because the virtualizer hasn't finished re-measuring after the new user message was added ❌
3. When the assistant reply arrives, `autoScrollLocked` is `false`, so the scroll at line 192-198 never fires ❌

## Fix

**Remove the problematic `useEffect` (lines 143-147)** that overwrites the lock. The lock is already correctly managed by:
- Line 188: set `true` when user sends a message
- Line 158: set `false` when user scrolls away during streaming  
- Line 163: set `true` when user scrolls back near bottom
- Line 137: set `true` when user clicks the scroll button

Additionally, **increase the setTimeout delay from 50ms to 150ms** at line 195-197 to give the virtualizer more time to render and measure the new assistant message before scrolling to it. Add a second fallback scroll attempt at 300ms for reliability.

### Files to change
- `src/components/ai4gp/MessagesList.tsx` — remove the `isLoading` useEffect (lines 143-147), update the assistant scroll delay (lines 195-197)

