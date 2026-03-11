

# Ask AI "Shaking" Investigation & Fix

## Root Cause

The shaking/oscillation is caused by a **feedback loop between the virtualizer and scroll logic during streaming**:

1. **Streaming content grows** → `lastMessageContentLength` changes → triggers the streaming `useEffect` (line 198)
2. **`virtualizer.measure()` is called** → invalidates all cached item sizes → triggers re-render with new positions
3. **Re-render fires `measureElement` refs** → sizes update again → virtualizer recalculates `totalSize` and `virtualRow.start` positions
4. **`requestAnimationFrame` sets `scrollTop = scrollHeight`** → triggers the scroll event handler → which may toggle `showScrollButton` state → another re-render
5. **Cycle repeats** on every token during streaming, causing rapid position oscillation (the "shaking")

The double `setTimeout` at lines 188-189 (`scrollToLatestAssistant` called at 150ms AND 300ms) can also compound the issue when a new assistant message arrives during active streaming, creating competing scroll targets.

## Fix Plan

### 1. Debounce `virtualizer.measure()` during streaming
Instead of calling `virtualizer.measure()` on every content length change during streaming, throttle it (e.g., once every 300ms) using a ref-tracked timestamp. This breaks the tight re-render loop.

### 2. Remove the double setTimeout scroll
Replace the two competing `setTimeout` calls (lines 188-189) with a single deferred call. The second call at 300ms can fight with streaming scroll logic if tokens are already arriving.

### 3. Suppress `setShowScrollButton` re-renders during streaming
The `handleScroll` callback (line 143) calls `setShowScrollButton(!nearBottom)` on every scroll event. During streaming with auto-scroll locked, this state toggle triggers unnecessary re-renders. Guard it so the setter only fires when the value actually changes.

### 4. Use `scrollTop` assignment instead of `scrollTo` during streaming
The streaming path already does `el.scrollTop = el.scrollHeight` (good — synchronous, no smooth animation). Ensure no other path triggers `smooth` scrolling simultaneously during active streaming, which would cause the browser to animate in one direction while being yanked in another.

### Files to Edit
- `src/components/ai4gp/MessagesList.tsx` — all changes are in this single file

