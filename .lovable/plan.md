

## Problem

The Document Settings modal is rendered via `createPortal` to `document.body`, placing it **outside** the parent Radix Dialog's component tree. Radix Dialog aggressively manages focus traps and sets `pointer-events: none` on `document.body`. The current workaround (MutationObserver + setInterval to force `pointer-events: auto`) is unreliable — Radix re-applies the restriction in ways the observer misses, causing inputs and buttons to become unresponsive.

This has been attempted 4+ times with increasingly complex hacks, none of which work reliably.

## Root Cause

Radix Dialog uses an internal "remove scroll" + pointer-events lock on `<body>`. Any portal rendered outside its tree is blocked. Fighting this with observers is a losing battle.

## Solution: Use a proper nested Radix Dialog

Rewrite `DocumentSettingsModal` to use the project's own `<Dialog>` component (which wraps Radix). This makes it a **nested Radix Dialog**, which Radix handles natively — the inner dialog gets its own focus trap and pointer-events work correctly.

### Changes

**`src/components/meeting-details/DocumentSettingsModal.tsx`** — Full rewrite of the outer wrapper:

1. Remove `createPortal`, `MutationObserver`, `setInterval`, and the escape-key listener hack.
2. Wrap the modal content in `<Dialog open={isOpen} onOpenChange={...}>` with `<DialogContent>` from the project's UI library.
3. Pass `className` to `DialogContent` for `max-w-[420px]` and remove the default close button (we have our own header close button).
4. Keep all internal UI (header, logo grid, toggles, preview strip, footer) exactly as-is — only the outermost container changes.
5. Add a hidden `<DialogTitle>` (via `VisuallyHidden`) to fix the accessibility console error.

This is the correct architectural approach — working **with** Radix instead of against it. No hacks, no timers, no mutation observers.

