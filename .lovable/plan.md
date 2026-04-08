

## Plan: Add CUCC Attendance Tab to ENN Dashboard

### What We're Building
A new "CUCC" tab on the ENN dashboard showing a stacked bar chart of monthly patient attendance at Corby Urgent Care Centre, broken down by practice. Users can view neighbourhood totals with practice breakdown on hover, and also filter to a single practice via a dropdown.

### Data Source
The data from the uploaded spreadsheet (11 months, April–February, 10 practices) will be hardcoded as a constant array — matching the exact figures provided.

### Changes

**1. New component: `src/components/enn/ENNCUCCAttendance.tsx`**
- Stacked `BarChart` (recharts, already in project) — one bar per month, stacked by practice with distinct colours matching existing `ennPopulationData` palette
- Custom tooltip on hover shows each practice's count and the monthly total
- Practice filter dropdown (default "All Practices") — selecting a single practice shows only that practice's bars (simple bar, not stacked)
- Summary cards at top: Total Attendance (11,294), Average Monthly (1,027), Highest Month, Lowest Month
- A data table below the chart showing the raw monthly figures per practice (sortable, matching the spreadsheet layout)
- SDA allocation column showing each practice's annual appointment allocation (74,846 total) for context

**2. Update `src/pages/ENNDashboard.tsx`**
- Add new tab entry: `{ value: "cucc", label: "CUCC Attendance", shortLabel: "CUCC", icon: Hospital }` (using `Hospital` from lucide-react)
- Add lazy-loaded `TabsContent` for the new component
- Position after "Estates & Capacity" tab (logical grouping)

### What Does NOT Change
- All other tabs, data, and components remain untouched
- No database changes — purely frontend with hardcoded data
- ENN Document Vault, NRES dashboard — completely unaffected

