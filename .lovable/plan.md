

## Fix: Remove auto-scroll/focus after AI response ends

### Root cause
In `AI4GPService.tsx` (lines 450-477), there is a `useEffect` that watches `isLoading`. When it transitions to `false` (response finishes), it calls `window.scrollTo({ top: document.documentElement.scrollHeight })` after a 200ms delay, then focuses the input after another 300ms. This forcibly scrolls the **entire page** to the bottom and steals focus, overriding whatever scroll position the user had in the messages list.

This is the effect that "sends the focus to the bottom of the bubble" after every response.

### Plan
**One change in `AI4GPService.tsx`**: Remove the auto-scroll-to-bottom-and-focus effect (lines 450-477). This `useEffect` block watches `[isLoading, messages.length]` and calls `window.scrollTo` + `inputRef.current?.focus()`. Delete it entirely, along with the now-unused `scrollTimeout1Ref` and `scrollTimeout2Ref` refs (lines 90-91).

No other files need changes. The `MessagesList` internal scroll logic already handles showing the scroll-to-bottom button and re-engaging auto-scroll when the user scrolls back down. The `handleScrollToInput` function (line 438) remains available for explicit button clicks but will no longer fire automatically.

### What this fixes
- After a response finishes, the page stays where the user left it
- Mouse wheel / trackpad scrolling is no longer overridden by a delayed `window.scrollTo`
- Input is not auto-focused (no keyboard popup on mobile, no scroll jump on desktop)

