

## Editable Programme Board Action Log with Audit Trail

### Overview
Convert the static Programme Board Action Log into an interactive, editable table supporting add, edit, and delete operations on action items, with a full audit trail recording who changed what, when, and the before/after values.

### Changes Required

#### 1. Convert static data to editable state (`ActionLogTable.tsx`)
- Import `actionLogData` into a `useState` hook as the initial value
- Accept optional `onDataChange` callback prop so parent components can react to changes
- Add an "Add Action" button next to the existing Export button
- Add Edit (pencil) and Delete (trash) icon buttons on each row, visible on hover
- Delete shows a confirmation dialog before removal

#### 2. Create Action Edit/Add Dialog (`ActionLogEditDialog.tsx`)
- New component with a clean white-background modal (matching the programme plan edit dialog style with `px-8 sm:px-10` padding)
- Fields:
  - **Description** (text input, required)
  - **Owner** (text input)
  - **Date Raised** (date picker, DD/MM/YYYY format)
  - **Due Date** (date picker, DD/MM/YYYY format)
  - **Priority** (select: High / Medium / Low)
  - **Status** (select: Open / Closed)
  - **Notes** (textarea)
- When adding, auto-generate the next Action ID (e.g. "009") based on the highest existing ID
- When editing, pre-populate all fields with the current values

#### 3. Add Audit Log (`ActionLogAuditDialog.tsx`)
- New component reusing the same audit log dialog pattern from `ProgrammeAuditLogDialog.tsx`
- Each audit entry records:
  - Timestamp (DD/MM/YY HH:mm format)
  - User email (from `useAuth()`)
  - Action type (Added / Edited / Deleted)
  - Item name (Action ID + description snippet)
  - Field changed (for edits)
  - Old value and new value
- Audit entries stored in React state within `ActionLogTable`
- Accessible via a History/ClipboardList icon button in the controls row, with a count badge showing number of entries
- For edits: granular field-level diffs (e.g. "Status: Open -> Closed", "Priority: Medium -> High")
- For adds: single entry "Added action 009"
- For deletes: single entry "Deleted action 005"

#### 4. Wire up edit/delete/add handlers in `ActionLogTable.tsx`
- `handleAdd`: push new item to state, log audit entry
- `handleEdit`: update item in state, log field-level diffs to audit
- `handleDelete`: remove item from state after confirmation, log audit entry
- All handlers capture the current user email via `useAuth()`

### Technical Details

**State management**: In-memory `useState` matching the existing pattern used by the Programme Plan Gantt chart. No database changes required.

**Audit log**: Stored as `useState<AuditEntry[]>` within `ActionLogTable`. Uses the same `AuditEntry` interface pattern from `ProgrammeAuditLogDialog.tsx`.

**User identity**: Obtained via `useAuth()` from `@/contexts/AuthContext` -- consistent with the rest of the application.

**ID generation**: Parse existing action IDs as numbers, find the max, increment, and zero-pad to 3 digits.

### Files to Create
- `src/components/sda/ActionLogEditDialog.tsx` -- add/edit dialog for action items
- `src/components/sda/ActionLogAuditDialog.tsx` -- audit trail dialog

### Files to Modify
- `src/components/sda/ActionLogTable.tsx` -- convert to stateful, add CRUD handlers, add audit log state, add action buttons on rows and toolbar

