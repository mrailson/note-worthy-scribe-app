
# Investigation Report: Mobile App Crashing Every Few Seconds

## Executive Summary

After thorough investigation of the codebase, I've identified **5 likely causes** for the mobile app crashing. The crashes appear to be a combination of **memory exhaustion**, **subscription loops**, and **viewport resize thrashing** that disproportionately affects mobile devices due to their limited resources.

---

## Root Causes Identified

### 1. LiveTranscript Subscription Loop (HIGH SEVERITY)

**Location:** `src/components/LiveTranscript.tsx` (lines 520-525)

The Supabase realtime subscription effect includes `cleanedTranscript` in its dependency array, but the effect *updates* `cleanedTranscript` when chunks arrive. This creates a vicious cycle:

1. Chunk arrives → `setCleanedTranscript()` called
2. State update triggers effect to re-run (due to dependency)
3. Old subscription is torn down, new subscription is created
4. If another chunk is pending, repeat

On mobile where transcription is actively used (e.g., patient translation), this can cause **dozens of subscription tear-down/rebuild cycles per second**, overwhelming the browser.

```typescript
// Line 525 - cleanedTranscript SHOULD NOT be in dependencies
}, [user?.id, isMedicalCorrectionsLoaded, meetingSettings, cleanedTranscript]);
//                                                         ↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑
//                                                         REMOVE THIS
```

---

### 2. Viewport Resize Thrashing on iOS (MEDIUM-HIGH SEVERITY)

**Location:** `src/components/ai4gp/FloatingMobileInput.tsx` (lines 100-126)

The keyboard height calculation updates both React state AND a CSS custom property on every `visualViewport.resize` event. On iOS Safari:

1. Keyboard appears → viewport resizes
2. Handler updates `--iphone-keyboard-height` CSS variable
3. CSS change causes layout recalculation
4. If layout affects viewport height, another resize event fires
5. Potential infinite loop

```typescript
// Lines 108-114 - Setting CSS variable on every resize can cause thrashing
setKeyboardHeight(Math.max(0, keyboardHeight));
document.documentElement.style.setProperty(
  '--iphone-keyboard-height', 
  `${Math.max(0, keyboardHeight)}px`
);
```

**Fix needed:** Debounce the handler and only update if the value actually changed.

---

### 3. Memory Leaks Still Present in Ask AI (MEDIUM SEVERITY)

**Location:** `src/hooks/useAI4GPService.ts`

While the recent fixes added timeout tracking refs, there are still potential issues:

- The `handleSend` callback's dependency array (around line 1154) may still be incomplete
- Large message histories accumulate faster on mobile due to frequent interactions
- The cleanup interval (30s) may be too slow for mobile memory constraints

**Additional concern:** Mobile browsers have much stricter memory limits (~1GB vs 4GB+ on desktop). The 40-message limit may still be too high for mobile.

---

### 4. Global MutationObserver Overhead (LOW-MEDIUM SEVERITY)

**Location:** `src/App.tsx` (lines 128-133) and `src/utils/domSafetyPolyfill.ts`

The `SafeDOMObserver` observes the entire document body with `childList: true, subtree: true, attributes: true`. On mobile:

- Every DOM change triggers the observer
- Processing mutations (even safely) has CPU overhead
- Combined with React's frequent re-renders, this creates constant overhead

While necessary to prevent third-party crashes, it adds to the overall mobile burden.

---

### 5. SessionActivityTracker Event Listeners (LOW SEVERITY)

**Location:** `src/hooks/useSessionActivity.ts` (lines 52-55)

Six global event listeners are attached for activity tracking:
```typescript
const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
```

On mobile, `touchstart` and `scroll` events fire very frequently. While each handler is throttled (1-minute minimum between updates), the *evaluation* of the throttle condition runs on every event.

---

## Recommended Fixes

### Fix 1: Remove `cleanedTranscript` from Subscription Dependencies (CRITICAL)

**File:** `src/components/LiveTranscript.tsx`
**Line:** 525

```typescript
// FROM:
}, [user?.id, isMedicalCorrectionsLoaded, meetingSettings, cleanedTranscript]);

// TO:
}, [user?.id, isMedicalCorrectionsLoaded, meetingSettings]);
```

---

### Fix 2: Debounce Viewport Resize Handler (HIGH)

**File:** `src/components/ai4gp/FloatingMobileInput.tsx`
**Lines:** 100-126

```typescript
// Add debouncing and value comparison
const lastKeyboardHeightRef = useRef(0);

const handleResize = useCallback(
  debounce(() => {
    if (typeof window !== 'undefined') {
      const viewport = window.visualViewport;
      if (viewport && isExpanded) {
        const newKeyboardHeight = Math.max(0, window.innerHeight - viewport.height);
        
        // Only update if changed by more than 5px
        if (Math.abs(newKeyboardHeight - lastKeyboardHeightRef.current) > 5) {
          lastKeyboardHeightRef.current = newKeyboardHeight;
          setKeyboardHeight(newKeyboardHeight);
          document.documentElement.style.setProperty(
            '--iphone-keyboard-height', 
            `${newKeyboardHeight}px`
          );
        }
      }
    }
  }, 100), // 100ms debounce
  [isExpanded]
);
```

---

### Fix 3: Lower Message History Limit for Mobile (MEDIUM)

**File:** `src/hooks/useAI4GPService.ts`
**Near line 13**

```typescript
// Add mobile-specific limits
const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
const MAX_MESSAGES_IN_MEMORY = isMobile ? 20 : 40;
const KEEP_RECENT_MESSAGES_INTACT = isMobile ? 3 : 5;
const CLEANUP_INTERVAL_MS = isMobile ? 15000 : 30000; // 15s on mobile
```

---

### Fix 4: Throttle Session Activity Event Handlers (LOW)

**File:** `src/hooks/useSessionActivity.ts`

```typescript
// Use passive event listeners and reduce event list for mobile
const events = isMobile 
  ? ['touchstart', 'click'] // Reduced set for mobile
  : ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
```

---

## Files to Modify

| File | Priority | Change |
|------|----------|--------|
| `src/components/LiveTranscript.tsx` | Critical | Remove `cleanedTranscript` from dependency array |
| `src/components/ai4gp/FloatingMobileInput.tsx` | High | Debounce viewport resize handler |
| `src/hooks/useAI4GPService.ts` | Medium | Lower limits for mobile devices |
| `src/hooks/useSessionActivity.ts` | Low | Reduce event listeners on mobile |

---

## Testing Recommendations

After implementing fixes:

1. **Memory monitoring**: Open Safari Web Inspector on Mac with iPhone connected, monitor Memory tab
2. **CPU profiling**: Check for sustained high CPU usage in Performance tab
3. **Network monitoring**: Verify Supabase subscription isn't constantly reconnecting
4. **Stress test**: Use Ask AI with large file attachments on mobile for 5+ minutes

---

## Additional Notes

The mobile environment is particularly sensitive because:
- iOS Safari has aggressive memory limits (~1-1.5GB)
- Background tabs are terminated aggressively to save resources
- Viewport resize events fire more frequently due to keyboard/address bar
- Touch events generate more frequent activity than mouse events

The combination of all these factors means what works fine on desktop can cause cascading failures on mobile.
