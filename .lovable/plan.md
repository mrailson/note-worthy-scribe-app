
# Fix: Presentation Studio Memory Crashes on Quick Pick Switching

## Root Cause Analysis

After investigating the code, I've identified several issues that compound to cause memory pressure and eventual browser crashes when rapidly switching between quick picks:

### 1. Massive Callback Recreation (Primary Cause)
The `generatePresentation` function (~350 lines) has `state` as a dependency (line 722 of `usePresentationStudio.ts`). Since `state` is the entire state object (settings, history, results, etc.), every quick pick click recreates this large closure, capturing all data including potentially large document contents and generation history.

### 2. Synchronous localStorage Writes on Every Change
The `savePersistedSettings` effect (lines 216-238) fires on every settings change with 16+ dependencies. Each quick pick click triggers immediate JSON serialisation and localStorage write of the full settings object.

### 3. Unmemoised Quick Picks Array
In `ContentTab.tsx`, the `quickPicks` array (lines 199-224) is recreated on every render, along with the `handleQuickPick` function, causing unnecessary child re-renders.

### 4. Toast Spam
Each quick pick click shows a toast notification (`toast.success`), which mounts new DOM elements and triggers additional re-renders. Rapid clicking queues multiple toasts simultaneously.

## Proposed Fix

### File 1: `src/hooks/usePresentationStudio.ts`

**A. Use a ref for state access in heavy callbacks**
- Add a `stateRef` that mirrors `state`, allowing `generatePresentation` and `downloadPresentation` to read current state without being in the dependency array
- Change `generatePresentation` dependencies from `[state, practiceContext]` to `[practiceContext]`
- Change `downloadPresentation` dependencies from `[state.currentResult]` to `[]`

**B. Debounce localStorage persistence**
- Wrap `savePersistedSettings` in a debounced timeout (500ms) so rapid quick pick clicks coalesce into a single write
- Clean up the timeout on unmount

### File 2: `src/components/ai4gp/presentation-studio/ContentTab.tsx`

**A. Memoise the quick picks array and handler**
- Wrap `quickPicks` in `useMemo` so it's only created once
- Wrap `handleQuickPick` in `useCallback` with stable dependencies
- Remove the `toast.success` call from quick pick selection (or replace with a lightweight visual indicator) to avoid toast DOM accumulation during rapid switching

## Technical Details

```text
usePresentationStudio.ts changes:
  - Add: const stateRef = useRef(state); 
  - Add: useEffect to sync stateRef.current = state
  - Modify: generatePresentation to read from stateRef.current
  - Modify: downloadPresentation to read from stateRef.current  
  - Add: debounce timer ref for localStorage saves
  - Modify: save effect to use setTimeout with cleanup

ContentTab.tsx changes:
  - Wrap quickPicks in useMemo(() => [...], [])
  - Wrap handleQuickPick in useCallback
  - Remove toast.success from handleQuickPick
```

These changes preserve all existing functionality (generation, download, history, persistence) whilst eliminating the memory pressure from rapid state-driven callback recreation and synchronous storage writes.
