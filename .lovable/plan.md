

## Bug Report: Blank Outcome Letter Modal After Regeneration

### Root Cause

There are **three update paths** in `ComplaintDetails.tsx` that save the outcome letter to the database, and **all three** lack the `.select()` confirmation fix that was applied to `InvestigationDecisionAndLearning.tsx`. This means all three silently fail if RLS blocks the update:

1. **`handleSaveOutcomeLetter`** (line 842) — manual edit save
2. **`handleRegenerateOutcomeLetter`** (line 888) — full regeneration
3. **AI Edit regeneration** (line 1455) — AI-assisted edit

In each case, `setOutcomeLetter()` updates the in-memory state, so the letter *appears* to have saved. But the database update silently returns zero rows (RLS policy blocks it), so when the user navigates away and returns, `fetchComplaintDetails` loads the old (empty) value from the database — resulting in a blank modal.

### Fix

Apply the same `.select().maybeSingle()` confirmation pattern to all three update calls in `ComplaintDetails.tsx`:

**1. `handleSaveOutcomeLetter` (line 842-847)**
- Add `.select().maybeSingle()` after `.eq('complaint_id', complaint.id)`
- Check if data was returned; if not, throw a permissions error
- Show a clear error toast if the save was silently blocked

**2. `handleRegenerateOutcomeLetter` (line 888-891)**
- Same fix: add `.select().maybeSingle()` and verify data returned
- If no data, throw error so the user knows the regeneration didn't persist

**3. AI Edit regeneration (line 1455-1461)**
- Same fix: add `.select().maybeSingle()` and verify data returned

This ensures all three paths either confirm the save succeeded or surface an actionable error message, preventing the "blank modal" experience.

