

## Plan: Use Practice Staff Defaults as Source for Complaint Email Recipients

### Problem
The complaints module currently maintains its own separate `complaint_team_members` table for staff selection. The user wants staff to come from the **Practice User Management** system (`practice_staff_defaults` table) instead, eliminating duplicate maintenance.

### Changes

#### 1. Refactor `RequestInformationPanel.tsx` — Replace team source
- **Replace `fetchTeamMembers`**: Instead of querying `complaint_team_members`, query `practice_staff_defaults` where `practice_id` matches and `is_active = true`.
- **Map fields**: `staff_name` → name, `default_email` → email, `staff_role` → role, `default_phone` → phone.
- **Remove the "Manage Team" tab entirely** (the second tab in the request dialog) — staff management now lives in Practice User Management, not here.
- **Remove the Add/Edit/Delete team member dialogs and handlers** (`showAddTeamDialog`, `showEditDialog`, `handleAddTeamMember`, `handleEditTeamMember`, `handleDeleteTeamMember`, etc.).

#### 2. Simplify the Request Dialog
- The dialog becomes a single-purpose view: **select a staff member → compose email**.
- Keep the "Quick Select from Team" dropdown (now populated from `practice_staff_defaults`).
- Keep the name/email/role fields (auto-populated on selection, still editable).
- Keep the notes field and demo generation.
- Remove the tabs wrapper since there's only one tab now.

#### 3. No database changes needed
The `practice_staff_defaults` table already has all required fields (`staff_name`, `default_email`, `staff_role`, `default_phone`, `practice_id`, `is_active`). No migration required.

### Files to Edit
- `src/components/RequestInformationPanel.tsx` — Main refactor (replace data source, remove team management UI)

