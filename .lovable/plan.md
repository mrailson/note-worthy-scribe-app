
I’ve re-investigated this and the evidence now points to a different root cause than backend latency.

What I found:
- Deletions are actually succeeding server-side (recent `delete_file` audit entries are written, and `get-client-info` is also responding).
- That means the lock is most likely front-end interaction lock, not a failed delete query.
- Your exact symptom (page becomes unclickable until refresh) aligns closely with known Radix `Dialog`/`DropdownMenu`/`ContextMenu` layer cleanup bugs where `body` can be left with `pointer-events: none`.
- The console error (`A listener indicated an asynchronous response...`) is commonly extension/runtime message noise and is often unrelated to app business logic. It can still be filtered so it stops obscuring real faults.

Implementation plan:

1) Fix the modal/menu interaction race in Document Vault delete flow
- File: `src/components/nres/vault/VaultContentView.tsx`
- Replace the current “open delete dialog directly from menu item” pattern with a safer sequence:
  1. Close menu first
  2. Open delete confirmation on next tick
- For menu actions that open delete confirmation, use `onSelect` + `event.preventDefault()` (rather than `onClick`) to avoid overlapping dismissable layers.
- Set `modal={false}` on the relevant `DropdownMenu`/`ContextMenu` roots in this component to reduce global body-lock side effects from nested overlays.

2) Add explicit body-lock cleanup when delete dialog closes
- File: `src/components/nres/vault/VaultContentView.tsx`
- Add a small `cleanupBodyInteractionLocks()` helper called on every delete-dialog close path (Cancel, successful delete, outside close):
  - remove `pointer-events` from `document.body` if no open dialog remains
  - clear stale `overflow` and `data-scroll-locked` only when safe
- Run cleanup in `requestAnimationFrame` + short timeout to catch animation-end races.

3) Reduce synchronous work during delete click (further hardening)
- File: `src/components/nres/vault/VaultContentView.tsx`
- Keep the immediate-close behaviour already added.
- Optimise tree cache update so it no longer scans every cached node on delete:
  - include parent context in `deleteTarget`
  - update only the affected branch/root list
- This reduces any remaining main-thread spikes when deleting in tree mode.

4) Keep server-side delete path non-blocking, but protect UX if refetch is slow
- File: `src/hooks/useNRESVaultData.ts`
- Keep async invalidation/audit decoupling.
- Ensure UI never depends on mutation completion to stay interactive.
- (No database schema changes required.)

5) Filter known extension-only promise noise without hiding real errors
- File: `src/App.tsx`
- In the global `unhandledrejection` handler, if the message contains:
  - `A listener indicated an asynchronous response by returning true...`
  then `preventDefault()` and return early (no error spam).
- Preserve logging for all other promise rejections.

6) Stop shipping the development postMessage shim to production
- File: `src/main.tsx` (and/or shim import strategy)
- `postmessage-dev-guard` is labelled a development guard but is imported unconditionally.
- Gate it to development builds only (`import.meta.env.DEV`) to avoid production message-channel side effects.

Validation plan (end-to-end):
- Repeat delete flow from:
  - kebab menu in details view
  - right-click context menu in tree view
- Confirm after each delete:
  - page remains fully clickable (no “frozen” UI)
  - item is removed and stays removed after refresh
  - no stale `body` lock (`pointer-events`, `data-scroll-locked`)
  - audit row is still written (`delete_file`)
- Run this several times consecutively on `/NRESDashboard` and `/nres` to verify no cumulative lock state.
