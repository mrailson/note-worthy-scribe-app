

## Grant Samantha Eggleton Policy Access + Add Separate Policies Toggle

### Problem
Currently, the Practice Policies toggle is bundled with CQC Compliance — toggling CQC on/off also toggles Policies. Samantha Eggleton (`s.eggleton@nhs.net`) has CQC enabled but no `policy_service` activation record, so Policies does not appear for her. There is no independent way for a Practice Manager to grant Policies access separately.

### Changes

**1. Database: Grant Samantha Eggleton policy_service access (immediate fix)**
- Insert a `user_service_activations` record for user_id `9db2022b-f6ac-41eb-85e9-feb9886fa7bf` with service `policy_service`.

**2. UI: Add separate Practice Policies toggle in PracticeUserManagement.tsx**
- Decouple `policy_service_access` from the CQC Compliance toggle (remove line 1134 that auto-sets `policy_service_access: checked` when CQC changes).
- Add a new independent toggle row for "Practice Policies" directly below the CQC Compliance toggle, matching the existing switch + label pattern.
- Update the helper text under CQC to read "Mock CQC Inspection" only (removing "& Practice Policies").
- Ensure the new toggle reads/writes `policy_service_access` in `userFormData.module_access` independently.

**3. Default for new practice_manager users**
- Update the default module access for `practice_manager` role so `policy_service_access` defaults to `true` (currently `false` at line 658).

### Files changed
- `supabase/migrations/` — new migration to insert activation record for Samantha
- `src/components/PracticeUserManagement.tsx` — decouple toggles, add Policies row, update default

### Behaviour
- Existing users are unaffected; their current access state is preserved.
- Practice Managers can now independently grant or revoke Policies access per user.
- New practice_manager users get Policies enabled by default.
- Samantha Eggleton will see Practice Policies immediately after the migration runs.
