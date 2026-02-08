
# Use Complaint's Own Practice Name in PowerPoint

## Problem

The complaint Training PowerPoint currently uses `practiceContext.practiceName` — which is the logged-in user's assigned practice from their profile (e.g., "Oak Lane Medical Practice"). It should instead use the practice name recorded against the complaint itself (e.g., "The Brooke Health Centre" or "Bugbrooke Medical Practice").

## Solution

Modify `useComplaintPowerPoint.ts` to look up the complaint's own practice name from the database, rather than relying on the user's profile context.

## Technical Details

### File: `src/hooks/useComplaintPowerPoint.ts`

**1. Add a complaint practice name lookup**

Inside the existing `useEffect` that loads persisted data (which already queries by `complaintId`), add a second query to fetch the complaint's `practice_id` and join to `gp_practices` to get the practice name. Store it in a new state variable `complaintPracticeName`.

```typescript
const [complaintPracticeName, setComplaintPracticeName] = useState<string>('');

// Inside the existing load effect:
const { data: complaintRow } = await supabase
  .from('complaints')
  .select('practice_id, gp_practices(name)')
  .eq('id', complaintId)
  .maybeSingle();

if (complaintRow?.gp_practices?.name) {
  setComplaintPracticeName(complaintRow.gp_practices.name);
}
```

**2. Replace all `practiceContext.practiceName` references**

In both `formatComplaintContent` and `generatePowerPoint`, replace:
```typescript
const practiceName = practiceContext?.practiceName || '';
```
with:
```typescript
const practiceName = complaintPracticeName || '';
```

This ensures the title slide, final slide, and all branding instructions reference the complaint's own practice (e.g., "The Brooke Health Centre") rather than the user's profile practice.

**3. Update dependency arrays**

Update the `useCallback` dependency arrays for `formatComplaintContent` and `generatePowerPoint` to reference `complaintPracticeName` instead of `practiceContext`.

The `usePracticeContext` import can optionally be removed if no other code in the hook references it.

## Impact

| Area | Before | After |
|------|--------|-------|
| Title slide | User's profile practice name | Complaint's assigned practice name |
| Final slide | User's profile practice name | Complaint's assigned practice name |
| Branding instructions | User's profile practice name | Complaint's assigned practice name |
| Data source | `practice_details` table (user profile) | `gp_practices` table (complaint record) |

## Files Changed

| File | Change |
|------|--------|
| `src/hooks/useComplaintPowerPoint.ts` | Fetch complaint's practice name from DB; replace `practiceContext` usage |
