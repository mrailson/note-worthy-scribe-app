

## Plan: Collapsible Column Groups for Allocation Table

### Problem
The 10-column table overflows on most screens, requiring horizontal scrolling.

### Solution
Group columns into expandable sections with toggle buttons above the table. Default view shows only 4 core columns; users can expand additional column groups as needed.

**Default columns (always visible):**
- Practice (with HUB badge)
- Annual Appts
- Weekly Appts
- Hub

**Expandable column groups (toggle buttons):**
- **List & Income** — List Size, Annual Income
- **Winter** — Winter Appts, Weekly Winter
- **Non-Winter** — Non-Winter Appts, Weekly Non-Winter

Each group is toggled via a small pill button above the table (e.g. styled like the existing season/view toggles). Multiple groups can be open simultaneously. All visible columns remain sortable.

### Technical Details

**File:** `src/components/enn/ENNEstatesCapacity.tsx`

- Add state: `expandedGroups: Set<"listIncome" | "winter" | "nonWinter">` — default empty
- Render toggle buttons row above the table with active/inactive styling
- Conditionally render `<TableHead>` and `<TableCell>` elements based on which groups are expanded
- Column order: Practice | [List Size, Annual Income]? | Annual Appts | Weekly Appts | [Winter Appts, Weekly Winter]? | [Non-Winter Appts, Weekly Non-Winter]? | Hub
- All sorting logic remains unchanged — hidden columns simply don't render
- Total row follows the same conditional rendering

