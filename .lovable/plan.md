

# Fix Language Selector Overflow on Mobile

## Problem
The language selector popover uses a fixed width of `350px` and a fixed scroll height of `400px`. On smartphones, especially when the on-screen keyboard is open, this causes the dropdown to bleed off-screen — the list and search input are clipped or hidden behind the keyboard.

## Solution
Make the popover responsive to the available viewport:

### File: `src/components/translation/LanguageSelector.tsx`

1. **Responsive width**: Change the `PopoverContent` class from `w-[350px]` to `w-[calc(100vw-2rem)] max-w-[350px]` so it fits within the screen on mobile whilst retaining its current size on desktop.

2. **Responsive scroll height**: Change the `ScrollArea` class from `h-[400px]` to `max-h-[40vh]` (or similar) so the list shrinks when the keyboard is visible, rather than extending off-screen.

3. **Popover alignment**: Add `sideOffset={4}` and `collisionPadding={16}` props to `PopoverContent` to ensure Radix's collision detection keeps the popover within the viewport bounds.

These are small class/prop changes to a single file — no logic or behaviour changes.

