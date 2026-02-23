

## Editable Programme Plan with Dynamic Gantt Chart

### Overview
Make the Programme Delivery Schedule fully interactive so users can edit task dates, progress, add new tasks/sections, and remove items -- with the Gantt chart and status indicators updating in real time.

### Changes Required

#### 1. Convert static data to editable state (`ProgrammePlanGantt.tsx`)
- Move `sdaProgrammePlanData` into React state (`useState`) so all modifications trigger re-renders
- The Gantt bars, date range, and status colours will update automatically since they already derive from the data
- Auto-calculate phase/section progress as the average of child task progress values
- Auto-derive status labels: 100% = Completed, >0% = In Progress, 0% = Not Started

#### 2. Add inline editing for task rows (`ProgrammePlanRow.tsx`)
- Add an **Edit** (pencil) icon button on each task row
- Clicking opens an edit dialog/popover with fields for:
  - Task name (text input)
  - Assigned to (text input)
  - Start date (date picker, DD/MM/YY format)
  - End date (date picker, DD/MM/YY format)
  - Progress (slider or number input, 0-100%)
  - Notes (text area)
- Add a **Delete** (trash) icon button with a confirmation prompt
- Show a visible **Status** badge on each task row (Completed / In Progress / Not Started) derived from progress

#### 3. Add new task/section controls
- Add an **"Add Task"** button at the bottom of each expanded section/phase
- Add an **"Add Section"** button at the bottom of each expanded phase
- New items get default values (0% progress, today's date as start, start+14 days as end)
- New items receive a generated unique ID

#### 4. Dynamic date range adjustment (`ProgrammePlanGantt.tsx`)
- Replace the hardcoded `calculateDateRange()` with a function that scans all task start/end dates in state
- Add padding (2 weeks before earliest, 2 weeks after latest) so new tasks outside the original range are visible
- The timeline columns, headers, and today marker will automatically adjust

#### 5. Add status column to the left panel
- Add a narrow "Status" column next to the progress percentage showing a coloured badge:
  - Green badge: "Completed" (100%)
  - Purple/blue badge: "In Progress" (1-99%)
  - Grey badge: "Not Started" (0%)

### Technical Details

**State management**: The `sdaProgrammePlan` import will be spread into a `useState` hook as the initial value. All edits mutate this state via setter functions passed down as props. No database changes needed -- matches the existing in-memory pattern.

**Edit dialog**: Will reuse the existing `Dialog` and form components (Input, Label, Popover with calendar) already in the project.

**Date range recalculation**: A `useMemo` will scan all tasks in the state tree to find the min start date and max end date, replacing the hardcoded Nov 2025 - Apr 2026 range.

**Gantt auto-update**: Since bars are already calculated from `flatRows` which derives from the data, converting the data source to state means edits flow through automatically with no additional wiring.

### Files to Modify
- `src/types/sdaProgrammePlan.ts` -- add optional `status` field and `notes` to types
- `src/components/sda/programme-plan/ProgrammePlanGantt.tsx` -- convert to stateful, dynamic date range, add/remove handlers
- `src/components/sda/programme-plan/ProgrammePlanRow.tsx` -- add edit/delete buttons, status badge
- New file: `src/components/sda/programme-plan/TaskEditDialog.tsx` -- edit dialog for task fields
- `src/components/sda/programme-plan/index.ts` -- export new component
