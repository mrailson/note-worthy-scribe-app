
# Revert Modal Headers from Blue to Grey

## Problem
The blue (`bg-primary`) header bar on modals looks poor. The user prefers the previous grey styling.

## Changes

### 1. `src/components/ui/dialog.tsx`
- **DialogHeader**: Change from `bg-primary text-primary-foreground` to `bg-muted/50 border-b` with standard text colours
- **DialogTitle**: Change from `text-primary-foreground` to `text-foreground`
- **DialogDescription**: Change from `text-primary-foreground/80` to `text-muted-foreground`
- **Close button**: Update from white-on-blue (`bg-white/20 text-primary-foreground`) to a standard muted style (`bg-muted hover:bg-muted-foreground/10 text-muted-foreground`)

### 2. `src/components/ui/alert-dialog.tsx`
- **AlertDialogHeader**: Same change -- `bg-muted/50 border-b` instead of `bg-primary text-primary-foreground`
- **AlertDialogTitle**: Change to `text-foreground`

All other spacing improvements (generous padding, white input backgrounds, footer styling) will be preserved.
