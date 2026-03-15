

## Plan: Mobile-Friendly Meeting Modal Toolbar

### Problem
The toolbar (line 2878) is a single horizontal flex row with ~12 icons/controls. On iPhone (402px wide), the right-side items (Export Studio, Email, Attendees) get clipped and are inaccessible.

### Solution
Restructure the toolbar into two rows on mobile:
- **Row 1** (primary controls): Zoom -/+, font/detail label, view toggle, corrections, note type selector, meeting type selector
- **Row 2** (actions): Attendees, Email, Export Studio — always visible

Additionally, on small screens, wrap the toolbar with `flex-wrap` so items flow naturally, and add a visible "Export" label next to the Download icon on mobile so it's discoverable.

### Changes

#### `src/components/SafeModeNotesModal.tsx`

1. **Line 2878** — Change the toolbar container from `flex items-center justify-between` to `flex flex-wrap items-center justify-between` so items wrap on narrow screens instead of overflowing hidden.

2. **Lines 3059-3060, 3113-3114** — Hide the dividers before Meeting Type and before Attendees on mobile: add `hidden sm:block` class to the `w-px h-5 bg-border mx-1.5` dividers that are least essential.

3. **Lines 3143-3156** — The right-side `div` containing Export Studio: change from `flex items-center gap-1` to include a mobile-specific styling. Add the Export button with a text label visible on small screens so users can find it even without tooltip hover.

4. **Alternative approach (cleaner)**: Convert the toolbar to use an overflow menu (DropdownMenu with `MoreHorizontal` icon) on mobile for secondary actions (Attendees, Email, Export Studio, View toggle, Corrections). This keeps the toolbar compact.

**Recommended approach**: Use a `DropdownMenu` overflow pattern:
- On `sm:` and above — show all icons as currently
- On mobile (`< sm`) — show only: zoom controls, note type, and a "⋯" overflow menu containing: View toggle, Corrections, Meeting Type, Attendees, Email, Export Studio

#### Implementation Detail

```tsx
// After the zoom controls + note type selector, add:
<div className="sm:hidden">
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="icon" className="h-8 w-8">
        <MoreHorizontal className="h-4 w-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem onClick={() => setViewMode(...)}>
        <ToggleRight /> {viewMode === 'plain' ? 'Formatted' : 'Plain Text'}
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => setShowCorrections(true)}>
        <BookOpen /> Name & Term Corrections
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={() => setShowAttendeeModal(true)}>
        <Users /> Manage Attendees
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => setShowEmailModal(true)}>
        <Mail /> Email Notes
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={() => setShowExportStudio(true)}>
        <Download /> Export Studio
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</div>
```

- Wrap existing individual buttons (view toggle, corrections, dividers, attendees, email, export) with `hidden sm:flex` or `hidden sm:block` so they only show on desktop
- Import `MoreHorizontal` from lucide-react

### Files Modified
1. **`src/components/SafeModeNotesModal.tsx`** — Add overflow dropdown menu for mobile, hide secondary toolbar icons on small screens

