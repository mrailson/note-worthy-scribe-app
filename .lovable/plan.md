

## Problem

Priority badges (High/Medium/Low) are showing by default across three views:
1. **Mobile/iOS meeting detail** - priority badges on action item cards
2. **SafeModeNotesModal** - `InlineActionItemsTable` always renders the Priority column
3. **Export Studio** - already has `priority_column_on` defaulting to `false` (this one is already correct)

The Export Studio already respects the `priority_column_on` setting (defaults to `false`), so no change needed there. The issue is the other two views.

## Plan

### 1. Hide priority column in InlineActionItemsTable by default

- Add an optional `showPriority?: boolean` prop (default `false`) to `InlineActionItemsTable`
- Conditionally render the Priority `<TableHead>` and `<TableCell>` (containing `PriorityDropdown`) based on this prop
- Adjust the Action column width from 40% to ~55% when priority is hidden

This affects both the SafeModeNotesModal (which uses `<InlineActionItemsTable>`) and the desktop meeting details view.

### 2. Hide priority badges in mobile meeting detail

- In `MobileMeetingDetail.tsx`, remove the priority badge rendering block (`item.priority && ...`) from the action items cards

### 3. Hide priority from MobileResponsiveTable

- In `MobileResponsiveTable.tsx`, skip the priority badge at top of cards and the priority column in table mode by default

### Files changed

- `src/components/meeting-details/InlineActionItemsTable.tsx` - add `showPriority` prop, conditionally render column
- `src/components/mobile-meetings/MobileMeetingDetail.tsx` - remove priority badge from action cards
- `src/components/meeting/MobileResponsiveTable.tsx` - skip priority rendering

