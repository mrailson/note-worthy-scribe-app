

# Buy-Back Settings Modal — Design Refresh

## Overview

Restyle the Buy-Back Settings modal to look more polished and professional, with white input backgrounds, better edge spacing/padding, improved heading hierarchy, and a cleaner tab navigation style.

## Changes (all in `BuyBackAccessSettingsModal.tsx`)

### 1. Modal Container
- Add generous internal padding (`px-8 sm:px-10`) matching the NRES SDA modal pattern
- Increase max-width slightly to `max-w-5xl` to give the cost breakdown table more room

### 2. Header
- Replace the plain `DialogTitle` with a styled header featuring a subtle bottom border, larger font size (`text-xl font-bold`), and a muted description beneath
- Add a small settings icon alongside the title for visual polish

### 3. Tab Navigation
- Override the default blue pill-style `TabsList` with a clean underline/border-bottom tab style: transparent background, no outer border, with only the active tab getting a bottom border accent (`border-b-2 border-primary`)
- Tabs will have `bg-transparent` with `data-[state=active]:shadow-none` for a flat, professional look

### 4. Section Headings
- Style section headings ("Employer On-Costs", "Role Types", "Cost Breakdown") with a left blue accent border (`border-l-3 border-primary pl-3`) and slightly larger text (`text-sm font-semibold`)

### 5. Input Styling
- Add explicit `bg-white dark:bg-slate-900` to all `Input` fields and `SelectTrigger` elements for clear white backgrounds against the modal
- Slightly increase input heights for better touch targets

### 6. On-Costs Section
- Add a subtle card wrapper (`bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4`) around the NI and Pension inputs
- Style the combined rate summary more prominently with a coloured accent

### 7. Tables
- Add `bg-white dark:bg-slate-900` to table containers
- Use slightly more padding in cells (`px-3 py-2.5`)
- Style header rows with a stronger background (`bg-slate-100 dark:bg-slate-800`)

### 8. Cost Breakdown Footer Note
- Wrap in a subtle info card style rather than plain text

## Technical Details

### File Modified
- `src/components/nres/hours-tracker/BuyBackAccessSettingsModal.tsx`

### Key Class Changes

**DialogContent**: `max-w-5xl max-h-[calc(100vh-8rem)]`

**TabsList**: Override with `bg-transparent border-b border-border rounded-none p-0 h-auto`

**TabsTrigger**: `rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none`

**Section headings**: `border-l-3 border-primary pl-3 text-sm font-semibold`

**Inputs**: `bg-white dark:bg-slate-900`

**Table wrappers**: `bg-white dark:bg-slate-900 border rounded-lg overflow-hidden`

No logic changes — purely visual/CSS class updates.

