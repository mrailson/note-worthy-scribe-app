
# Fix Translation Layout on Smartphone

## Problem
The mobile-optimised translation layout (`MobileTranslationLayout`) is not rendering on smartphones. This is because the condition on line 2488 requires **both** `isMobile` and `embedded` to be true:

```
if (isMobile && embedded) { ... }
```

However, `embedded` was recently set to `false` to restore standalone (full-screen) behaviour. As a result, smartphones now get the **desktop layout** — with wide toolbars, view-mode icon selectors, side panels, and a QR sidebar — which is completely unusable on a small screen, as shown in the screenshots.

## Solution
Change the mobile layout condition from `if (isMobile && embedded)` to `if (isMobile)` so that the purpose-built mobile layout always renders on smartphones, regardless of whether the view is embedded or standalone.

## Technical Details

**File: `src/components/admin-dictate/ReceptionTranslationView.tsx`**
- **Line 2488**: Change `if (isMobile && embedded)` to `if (isMobile)`
- The mobile layout already uses `fixed inset-0`-style full-screen rendering via its own `flex flex-col h-full w-full` container, so removing the `embedded` guard will not break layout
- The standalone wrapper (`fixed inset-0 z-50`) from the desktop branch (line 2615) is not needed because the `MobileTranslationLayout` component handles its own viewport lock

This is a single-line change that restores the dedicated smartphone interface for non-training mode sessions.
