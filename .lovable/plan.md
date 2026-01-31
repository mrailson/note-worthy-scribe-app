

# Ask AI Service Performance Investigation - Findings & Optimisation Plan

## Overview
Investigation into the reported slow loading and menu "hanging" behaviour in the Ask AI (AI4GP) service has identified several contributing factors.

---

## Root Causes Identified

### 1. Dropdown Menu Exit Animations
The dropdown menus use Radix UI's animate-out classes which create visible fade and zoom-out effects when closing. These animations, while visually smooth, can make menus appear to "hang" for ~200-300ms before disappearing.

**Location:** `src/components/ui/dropdown-menu.tsx`
- Lines 51-52 and 72-73 contain: `data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95`

### 2. Multiple TooltipProvider Instances
The sidebar and home screens create multiple separate `<TooltipProvider>` components, each with their own delay settings. This causes overhead and can lead to inconsistent tooltip behaviour.

**Affected files:**
- `src/components/ai4gp/AI4GPSidebar.tsx` - 4 separate TooltipProvider instances
- `src/components/ai4gp/PMHomeScreen.tsx` - 2 TooltipProvider instances
- `src/components/ai4gp/GPHomeScreen.tsx` - 2 TooltipProvider instances

### 3. Practice Context Data Fetches on Mount
The `usePracticeContext` hook performs multiple sequential Supabase queries (profiles, user_roles, gp_practices, practice_details, PCN data) which can take 500ms-1s to complete.

**Location:** `src/hooks/usePracticeContext.ts`

### 4. Sidebar Width Transition
The sidebar has a `transition-all duration-200` class that animates all CSS properties, potentially causing layout thrashing during initial render.

**Location:** `src/components/ai4gp/AI4GPSidebar.tsx` line 156

---

## Recommended Fixes

### Fix 1: Remove or Reduce Dropdown Exit Animation Duration (High Impact)
Remove the closing animation to make menus disappear instantly when closed.

**File:** `src/components/ui/dropdown-menu.tsx`

**Change:** Remove or reduce the exit animation classes:
```tsx
// Before (lines 51 and 72-73):
"data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"

// After - Remove exit animations for instant close:
// Simply remove these classes from both DropdownMenuSubContent and DropdownMenuContent
```

This will make dropdown menus close instantly rather than animating out.

---

### Fix 2: Consolidate TooltipProviders (Medium Impact)
Wrap the entire AI4GPService component in a single `<TooltipProvider>` rather than having multiple nested instances.

**Files to modify:**
- `src/components/AI4GPService.tsx` - Add single TooltipProvider at top level
- `src/components/ai4gp/AI4GPSidebar.tsx` - Remove individual TooltipProviders, use single Tooltip components
- `src/components/ai4gp/PMHomeScreen.tsx` - Remove individual TooltipProviders
- `src/components/ai4gp/GPHomeScreen.tsx` - Remove individual TooltipProviders

---

### Fix 3: Optimise Sidebar Transition (Low Impact)
Change from `transition-all` to specific property transitions to avoid animating unnecessary properties.

**File:** `src/components/ai4gp/AI4GPSidebar.tsx`

**Change:**
```tsx
// Before (line 156):
"transition-all duration-200 ease-in-out"

// After - Only animate width:
"transition-[width] duration-150 ease-out"
```

---

### Fix 4: Add Loading State Skeleton (UX Improvement)
Show a lightweight skeleton/placeholder while practice context loads rather than blocking render.

**File:** `src/components/AI4GPService.tsx`

Add a quick skeleton state for the first ~500ms while data loads, so users see the interface shape immediately.

---

## Summary of Changes

| Change | File(s) | Impact | Effort |
|--------|---------|--------|--------|
| Remove dropdown exit animations | `dropdown-menu.tsx` | High - eliminates menu "hang" | Low |
| Consolidate TooltipProviders | AI4GPService, Sidebar, HomeScreens | Medium - reduces overhead | Medium |
| Optimise sidebar transition | AI4GPSidebar.tsx | Low - smoother open/close | Low |
| Add loading skeleton | AI4GPService.tsx | Medium - better perceived perf | Medium |

---

## Technical Notes

The dropdown exit animation is the most likely cause of the "menu hanging" issue. The Radix UI animation classes use CSS animations that take ~150-200ms to complete before the element is removed from the DOM. During this time, the menu remains visible but non-interactive, which feels like a "hang".

The TooltipProvider consolidation will reduce React context overhead and ensure consistent tooltip behaviour across the service.

