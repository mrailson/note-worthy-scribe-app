

## Problem: Overlapping Chat Bubbles

The overlapping messages are caused by **`contain: 'strict'`** on the scroll container (line 234 of `MessagesList.tsx`).

`contain: 'strict'` includes **size containment**, which tells the browser the element's intrinsic size is independent of its children. This interferes with the virtualizer's ability to correctly measure and layout items, because the container stops reporting accurate `scrollHeight` values after content changes (e.g., during streaming or when messages of varying height are rendered).

## Fix

**File: `src/components/ai4gp/MessagesList.tsx`**

1. **Replace `contain: 'strict'` with `contain: 'layout paint'`** (line 234). This keeps the performance benefits of layout and paint containment but drops **size containment**, allowing `scrollHeight` to update correctly as virtualizer items are measured and repositioned.

That single change should resolve the overlap. No other files need modification.

