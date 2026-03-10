

# Fix: Translation Setup Modal Scrollability for Zoomed-In Screens

## Problem
The `LiveTranslationSetupModal` uses a fixed `DialogContent` without internal scrolling. When users have zoomed-in screens (accessibility zoom, large text settings, or small viewports), the "Start Session" button at the bottom gets cut off and is unreachable.

## Solution
Make the modal's body content scrollable while keeping the header and footer action buttons always visible (sticky). This is a standard pattern: fixed header + scrollable middle + fixed footer.

## Changes

**File: `src/components/admin-dictate/LiveTranslationSetupModal.tsx`**

1. Add `max-h-[85vh] flex flex-col` to `DialogContent` so the modal never exceeds viewport height
2. Wrap the middle `<div className="space-y-6 py-4">` section (lines 150-287) in a `ScrollArea` or use `overflow-y-auto flex-1` so it scrolls when content overflows
3. Keep the footer buttons div (lines 289-311) outside the scrollable area so they're always visible at the bottom
4. Add `min-h-0` to the scrollable section to allow proper flex shrinking

The result: header stays at top, action buttons stay at bottom, and all the content in between (language selector, voice legend, training mode, QR info) scrolls naturally.

