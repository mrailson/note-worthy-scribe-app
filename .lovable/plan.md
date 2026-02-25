
## Editable Workforce Recruitment Tracker with Audit Trail

### What this does
1. NRES admins can add, edit, and delete staff members and buy-back entries directly in the tracker
2. Each staff row retains its existing colour coding based on status (green/amber/red)
3. Each staff entry shows a "Last Updated" date
4. All changes are tracked in an audit trail table (who changed what, when)
5. Staff notes display as a discreet Info hover icon (tooltip) rather than inline text

### Design Details

**Colour Coding (kept as-is)**
- Green: Recruited / Confirmed
- Amber: Offered / Potential / TBC
- Red: Outstanding
- Each `StaffRow` continues to use the `statusConfig` colours for backgrounds, borders, and badge dots

**Last Updated per Staff Member**
- Add an optional `lastUpdated` field to the `StaffMember` interface
- Display as a small muted timestamp beneath each staff member's name (e.g., "Updated: 24/02/26 14:30")
- Auto-set when any field on that staff member is changed

**Notes as Info Tooltip**
- Replace the current inline notes text with a discreet `Info` icon (from lucide-react)
- Hovering shows the note content in a tooltip (using the existing `InfoTooltip` component pattern)
- Only visible when notes exist

**Audit Trail**
- A new Supabase table `nres_recruitment_audit` stores every change with: timestamp, user email, action (Added/Edited/Deleted), staff name, field changed, old value, new value
- An "Audit" button (with count badge) opens a dialog showing the full change history in the same table format used by the Programme Board Action Log audit

### Technical Details

**1. Database: New table `nres_recruitment_config`**
Single-row JSONB config table (mirrors `nres_estates_config`):
```sql
CREATE TABLE nres_recruitment_config (
  id TEXT PRIMARY KEY DEFAULT 'default',
  practices_data JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);
-- RLS: authenticated read/write
```

**2. Database: New table `nres_recruitment_audit`**
```sql
CREATE TABLE nres_recruitment_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_email TEXT NOT NULL,
  action TEXT NOT NULL,       -- Added, Edited, Deleted
  practice_name TEXT,
  staff_name TEXT NOT NULL,
  field TEXT,
  old_value TEXT,
  new_value TEXT
);
-- RLS: authenticated read/write
```

**3. New file: `src/data/nresAdminEmails.ts`**
Shared admin email list used by Estates, Claims, and Recruitment:
```typescript
export const NRES_ADMIN_EMAILS = [
  'm.green28@nhs.net',
  'mark.gray1@nhs.net',
  'amanda.taylor75@nhs.net',
  'carolyn.abbisogni@nhs.net'
];
```

**4. New file: `src/hooks/useRecruitmentConfig.ts`**
Mirrors `useEstatesConfig` pattern:
- Fetches practices data from `nres_recruitment_config`, falls back to hardcoded defaults
- `updateConfig(newPractices)` upserts the data
- Exports `practices`, `isLoading`, `updatedAt`, `updateConfig`

**5. Updated: `src/data/nresRecruitmentData.ts`**
- Add `lastUpdated?: string` to the `StaffMember` interface

**6. Updated: `src/components/sda/workforce/NRESWorkforceRecruitmentTracker.tsx`**
Major changes:
- Import `useRecruitmentConfig` hook instead of static `practices`
- Import `useAuth` and `NRES_ADMIN_EMAILS` for permission check
- Add edit mode state with inline editing of staff fields (name, sessions, status, type, notes)
- Add/delete staff buttons per category (GP, ACP, Buy-Back)
- Each `StaffRow`:
  - Shows `lastUpdated` as small muted text
  - Shows notes via `InfoTooltip` icon instead of inline text
  - In edit mode: inline fields + delete button
- Admin toolbar: "Edit Data" / "Save" / "Cancel" buttons (same pattern as Estates)
- "Audit" button opens `RecruitmentAuditDialog`
- On save: write audit entries to `nres_recruitment_audit` for each detected change

**7. New file: `src/components/sda/workforce/RecruitmentAuditDialog.tsx`**
Reuses the same table layout as `ProgrammeAuditLogDialog` / `ActionLogAuditDialog`:
- Fetches from `nres_recruitment_audit` table
- Shows date/time, user, action (with coloured badge), staff name, field, from, to columns

**8. Updated: `src/components/sda/SDAEstatesCapacity.tsx`**
- Import `NRES_ADMIN_EMAILS` from shared file, remove local constant

**Files created:**
- `src/data/nresAdminEmails.ts`
- `src/hooks/useRecruitmentConfig.ts`
- `src/components/sda/workforce/RecruitmentAuditDialog.tsx`

**Files modified:**
- `src/data/nresRecruitmentData.ts` (add `lastUpdated` to interface)
- `src/components/sda/workforce/NRESWorkforceRecruitmentTracker.tsx` (edit mode, tooltips, audit, permissions)
- `src/components/sda/SDAEstatesCapacity.tsx` (use shared admin list)
