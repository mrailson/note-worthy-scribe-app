

## Plan: Fix Correction Persistence and Search in CorrectionManager

### Root Cause Analysis

I found three distinct bugs by inspecting the code and database:

**Bug 1 — Corrections reappear after deletion**: The DB still contains "lazy→staff" and "date→data" entries. The `CorrectionManager.loadCorrections()` reads from the singleton's in-memory Map (`medicalTermCorrector.getCorrections()`) instead of querying the database. After delete, `refreshCorrections()` is called **without a userId**, which only reloads global corrections — making it appear deleted in the current session. On next page load, `useApplyMeetingCorrections` reloads with userId, bringing back all corrections from the DB (including ones the user thought were deleted). The delete itself may also be failing due to RLS or the fact the Map stores lowercase keys while the DB may store original case.

**Bug 2 — Search doesn't work**: Because `CorrectionManager.loadCorrections()` builds the list from the in-memory Map (which loses all metadata and may be stale after a no-userId refresh), the corrections list can be incomplete or empty, making search appear broken.

**Bug 3 — Overly broad practice query**: `loadCorrections` uses `practice_id.not.is.null` which loads corrections from ALL practices, not just the user's.

### Changes

#### 1. Fix `CorrectionManager.tsx` — Load from DB directly
- Replace `loadCorrections()` to query `medical_term_corrections` table directly via Supabase (with `user_id = currentUser.id`) instead of reading from the in-memory Map
- This ensures accurate data, proper metadata (usage_count, created_at), and working search
- Pass userId when calling `refreshCorrections()` after add/delete

#### 2. Fix `MedicalTermCorrector.ts` — loadCorrections query
- Change `practice_id.not.is.null` to filter by the user's actual practice_id (look it up first, or pass it in)
- Ensure `deleteCorrection` handles case-insensitive matching properly

#### 3. Fix `useApplyMeetingCorrections.ts` — Add reload mechanism  
- Expose a `reloadCorrections()` function so that after the CorrectionManager modifies corrections, the meeting cards can refresh
- Pass this as a callback to `CorrectionManager` via the parent component

#### 4. Wire up refresh in `MeetingHistoryList.tsx` / `MeetingHistory.tsx`
- When CorrectionManager closes or applies changes, trigger `reloadCorrections()` on the hook so meeting card badges update immediately

### Files to Modify
- `src/components/CorrectionManager.tsx` — Query DB directly, pass userId to refresh
- `src/utils/MedicalTermCorrector.ts` — Fix practice_id filter, case handling in delete
- `src/hooks/useApplyMeetingCorrections.ts` — Add reloadCorrections function
- `src/pages/MeetingHistory.tsx` — Wire reload callback to CorrectionManager

