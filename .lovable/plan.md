
# Meeting Service Performance Analysis & Optimisation Plan

## Executive Summary

After a comprehensive review of the meeting service codebase (MeetingRecorder, MeetingHistoryList, FullPageNotesModal, SafeModeNotesModal, and related components), I've identified several performance issues similar to those fixed in the Ask AI service, along with some additional concerns specific to meeting components.

---

## Issues Identified

### 1. Multiple TooltipProvider Instances (Medium Impact)

**Locations:**
- `MeetingHistoryList.tsx` line 2229 - Wraps entire component
- `SafeModeNotesModal.tsx` - Uses Tooltip without explicit Provider
- `MeetingGridView.tsx` - No TooltipProvider but uses components that may need one

**Impact:** Each TooltipProvider creates its own context, causing overhead when multiple are nested. Unlike the AI4GP service fix where we consolidated providers, the meeting components still have scattered tooltip usage.

**Recommendation:** Add a single TooltipProvider at the MeetingRecorder component level that wraps all child components, similar to what was done for AI4GPService.

---

### 2. Exit Animations Already Fixed ✅

The dropdown-menu.tsx exit animations were already removed in the previous optimisation. The meeting components will benefit from this fix automatically since they use the same shared UI components.

---

### 3. Transition-All Usage (Low-Medium Impact)

**Locations found in meeting components:**
- `MeetingHistoryList.tsx` line 2239: `hover:shadow-medium transition-shadow` (acceptable - specific property)
- `MeetingGridView.tsx` line 124: `transition-all hover:shadow-md` (should be optimised)
- Various hover states using `transition-all` throughout

**Recommendation:** Replace `transition-all` with specific property transitions like `transition-shadow`, `transition-colors`, or `transition-[width,opacity]` to prevent layout thrashing.

---

### 4. Large Component File Sizes (High Impact on Maintainability)

As noted in the memory context, this is a known issue:
- `MeetingRecorder.tsx`: ~7,334 lines
- `MeetingHistory.tsx`: ~2,877 lines  
- `MeetingHistoryList.tsx`: ~3,431 lines
- `FullPageNotesModal.tsx`: ~3,794 lines
- `SafeModeNotesModal.tsx`: ~4,013 lines

**Impact:** These monolithic files cause:
- Slower hot module replacement during development
- Larger bundle chunks to parse on load
- More difficult to optimise individual features

**Note:** This is already tracked in the refactoring plan (memory: architecture/meeting-history-refactoring-plan).

---

### 5. Real-time Subscription Debouncing (Already Implemented) ✅

The `MeetingHistoryList.tsx` already implements proper debouncing (2-second cooldown, 500ms batch delay) as noted in memory: architecture/system-performance-leak-mitigation.

---

### 6. Potential Memory Leak in Modal State Refs

**Location:** `MeetingHistoryList.tsx` line 489
```tsx
const safeModeModalOpenRef = useRef(false);
```

**Issue:** The ref is used to prevent real-time updates while modal is open, but there's no corresponding cleanup if the component unmounts while modal is open.

**Recommendation:** Add cleanup in useEffect to ensure ref is reset on unmount.

---

## Recommended Fixes

### Fix 1: Add TooltipProvider Consolidation to MeetingRecorder

Wrap the main MeetingRecorder component with a single TooltipProvider at the top level to provide tooltip context to all child components.

**File:** `src/components/MeetingRecorder.tsx`

**Change:** Add TooltipProvider import and wrap the return JSX.

---

### Fix 2: Optimise MeetingGridView Transition

**File:** `src/components/meeting-history/MeetingGridView.tsx`

**Change Line 124:**
```tsx
// Before:
"transition-all hover:shadow-md"

// After:
"transition-shadow hover:shadow-md"
```

---

### Fix 3: Add Cleanup to Modal Ref State

**File:** `src/components/MeetingHistoryList.tsx`

**Add to the component near line 489:**
```tsx
// Cleanup ref on unmount
useEffect(() => {
  return () => {
    safeModeModalOpenRef.current = false;
  };
}, []);
```

---

### Fix 4: Lazy Load Heavy Modals in MeetingHistoryList

The SafeModeNotesModal (~4,000 lines) and other heavy modals are imported synchronously.

**File:** `src/components/MeetingHistoryList.tsx`

**Change imports to use React.lazy:**
```tsx
const SafeModeNotesModal = React.lazy(() => 
  import("@/components/SafeModeNotesModal").then(m => ({ default: m.SafeModeNotesModal }))
);
```

This will defer loading the 4,000+ line modal until it's actually needed.

---

## Summary of Changes

| Change | File(s) | Impact | Effort |
|--------|---------|--------|--------|
| Consolidate TooltipProvider | MeetingRecorder.tsx | Medium | Low |
| Optimise transition-all | MeetingGridView.tsx | Low | Low |
| Add cleanup to modal ref | MeetingHistoryList.tsx | Low | Low |
| Lazy load SafeModeNotesModal | MeetingHistoryList.tsx | Medium | Low |

---

## Already Working Well

1. **Dropdown exit animations** - Already removed globally
2. **Real-time subscription debouncing** - 2-second cooldown implemented
3. **Lazy loading** - FullPageNotesModal already uses `Suspense` for TranscriptTabContent
4. **Memory cleanup** - Recording resources properly cleaned up on unmount
5. **Supabase real-time channels** - Properly using user-specific channel names

---

## Technical Notes

The meeting service has some inherent complexity due to:
- Real-time transcription with multiple audio sources
- Live meeting state synchronisation across tabs/devices  
- Large transcript handling (some meetings have 50K+ word transcripts)
- Multiple note generation styles and formats

The proposed optimisations focus on reducing initial load time and improving responsiveness without changing core functionality. The larger refactoring work (breaking up monolithic files) is tracked separately as a multi-phase project.
