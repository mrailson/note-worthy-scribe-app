

## Admin-Editable Room Availability Matrix and F2F/Remote Split

### Overview

Add a system-admin-only editing mode to the Estates & Capacity tab. When a system admin views the page, they'll see an "Edit" toggle that reveals inline editing controls for the Room Availability Matrix table and the F2F/Remote split percentage. Normal users see the page exactly as it looks today -- no visual difference whatsoever.

All changes persist in Supabase so they survive browser refreshes and are visible to every user immediately.

### What Becomes Editable

1. **Room Availability Matrix** -- every cell value (rooms per practice per session slot, e.g. "Monday AM / The Parks = 1"). Row and column totals auto-recalculate.
2. **F2F / Remote split percentage** -- currently hardcoded at 50/50. The admin can change it to any split (e.g. 60/40). This cascades to:
   - The "Face-to-Face Sessions Required" and "Remote Sessions Required" cards in Capacity Planning
   - The F2F and Remote columns in the "Sessions Required by Practice" table
   - The column headers (currently showing "F2F (50%)" / "Remote (50%)")
   - The Practice Capacity Breakdown footer (F2F/Remote per season)
   - The summary badges (on-site vs remote session counts)

### Database Changes (Supabase Migration)

**New table: `nres_estates_config`**

| Column | Type | Purpose |
|--------|------|---------|
| id | text (PK) | Single row, value = 'default' |
| room_data | jsonb | The full session matrix as JSON |
| f2f_split_pct | integer | Face-to-face percentage (e.g. 50, 60) |
| updated_at | timestamptz | Last edit timestamp |
| updated_by | uuid (FK auth.users) | Who last edited |

RLS policies:
- **SELECT**: All authenticated users can read
- **UPDATE/INSERT**: Only system admins (via existing `is_system_admin` RPC)

Seeded with current hardcoded values on creation.

### Frontend Changes

**`src/components/sda/SDAEstatesCapacity.tsx`**

1. **New hook `useEstatesConfig()`** -- fetches from `nres_estates_config`, falls back to current hardcoded defaults if no row exists. Returns `{ roomData, f2fSplitPct, isLoading, updateConfig }`.

2. **Admin edit mode** -- when `isSystemAdmin` is true, show a small "Edit Data" button (pencil icon) in the top-right area. Clicking it:
   - Makes matrix cells into number inputs (compact, styled to match current cell colours)
   - Shows a split percentage slider or input (e.g. "F2F: 60% / Remote: 40%")
   - Shows "Save" and "Cancel" buttons
   - On save, writes to Supabase and auto-recalculates all derived values

3. **Auto-recalculation** -- all derived figures (totals, F2F/Remote splits in Capacity Planning, Practice Breakdown table, summary badges) use the stored split percentage instead of the hardcoded `/2` division.

4. **No visual change for normal users** -- the edit controls are gated behind `isSystemAdmin`. The table renders identically using the same styling; data simply comes from Supabase instead of constants.

### Technical Details

- Replace the hardcoded `sessionData` array and `capacityData.f2fRequired/remoteRequired` with values derived from the database config
- The `f2fSplitPct` value (e.g. 50) drives: `f2fRequired = sessionsPerWeek * (f2fSplitPct / 100)` and `remoteRequired = sessionsPerWeek * ((100 - f2fSplitPct) / 100)`
- `practiceCapacityData` F2F/Remote columns recalculate using the same split
- Column headers update dynamically: `F2F (${f2fSplitPct}%)` / `Remote (${100 - f2fSplitPct}%)`
- A "Last updated" timestamp and editor name display subtly below the table when data has been edited
- Input validation: room values must be non-negative integers; split must be 0--100

### Files Affected

| File | Change |
|------|--------|
| Migration SQL | New `nres_estates_config` table + RLS + seed |
| `src/hooks/useEstatesConfig.ts` | New hook for fetch/update |
| `src/components/sda/SDAEstatesCapacity.tsx` | Replace hardcoded data with hook; add admin edit UI |

